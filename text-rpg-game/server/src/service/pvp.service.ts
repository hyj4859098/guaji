/**
 * PVP 竞技场服务
 *
 * 异步 PVP：挑战对手的快照数据（对手不需要在线）
 * 复用 battle/core 的伤害/命中公式
 * 每日限次、积分排名
 */
import { PlayerService } from './player.service';
import { SkillService } from './skill.service';
import { Uid } from '../types/index';
import { isVipActive } from '../types/player';
import { BattleResultEnum } from '../types/enum';
import { wsManager } from '../event/ws-manager';
import { logger } from '../utils/logger';
import { dataStorageService } from './data-storage.service';
import { calculateHit, calcPhysicalDamage, calcMagicDamage, calcElementBonus } from '../battle/core';

const MAX_ROUNDS = 30;
const MAX_DAILY_ATTACKS = 10;
const VIP_EXTRA_ATTACKS = 5;
const PVP_COOLDOWN = 60; // 60s between fights
const WIN_GOLD = 200;
const WIN_REPUTATION = 50;
const WIN_SCORE = 10;
const LOSE_SCORE = -5;

interface PvpBattleResult {
  result: BattleResultEnum;
  rounds: number;
  gold: number;
  reputation: number;
  score_change: number;
  opponent_name: string;
  logs: any[];
}

const pvpLockMap = new Map<string, boolean>();

export class PvpService {
  private playerService = new PlayerService();
  private skillService = new SkillService();
  private _seq = 0;

  /** 获取可挑战的对手列表（排除自己，按等级接近排序） */
  async getOpponents(uid: Uid): Promise<any[]> {
    const players = await this.playerService.list(uid);
    if (!players.length) return [];
    const me = players[0];

    const allPlayers = await dataStorageService.list('player', {});
    const uidStr = String(uid);

    const opponents = allPlayers
      .filter((p: any) => String(p.uid) !== uidStr)
      .map((p: any) => ({
        uid: p.uid,
        player_id: p.id,
        name: p.name,
        level: p.level,
        hp: p.max_hp || p.hp,
        phy_atk: p.phy_atk,
        mag_atk: p.mag_atk,
        phy_def: p.phy_def,
        mag_def: p.mag_def,
      }))
      .sort((a: any, b: any) => Math.abs(a.level - me.level) - Math.abs(b.level - me.level))
      .slice(0, 20);

    return opponents;
  }

  /** 获取 PVP 排行榜 */
  async getRanking(): Promise<any[]> {
    const rankings = await dataStorageService.list('pvp_ranking', {});
    return rankings.sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 50);
  }

  /** 获取自己的 PVP 信息（今日次数、积分） */
  async getMyPvpInfo(uid: Uid): Promise<any> {
    const uidStr = String(uid);
    const today = this.todayStr();

    const dailyRecs = await dataStorageService.list('pvp_daily', { uid: uidStr, date: today });
    const daily = dailyRecs.length ? dailyRecs[0] : null;

    const rankRecs = await dataStorageService.list('pvp_ranking', { uid: uidStr });
    const rank = rankRecs.length ? rankRecs[0] : null;

    const players = await this.playerService.list(uid);
    const isVip = players.length ? isVipActive(players[0]) : false;
    const maxAttacks = MAX_DAILY_ATTACKS + (isVip ? VIP_EXTRA_ATTACKS : 0);

    const cdRemain = daily?.last_attack_time
      ? Math.max(0, PVP_COOLDOWN - Math.floor(Date.now() / 1000 - daily.last_attack_time))
      : 0;

    return {
      attacks_used: daily?.attacks || 0,
      attacks_max: maxAttacks,
      cooldown_remain: cdRemain,
      can_fight: (daily?.attacks || 0) < maxAttacks && cdRemain === 0,
      wins: rank?.wins || 0,
      losses: rank?.losses || 0,
      score: rank?.score || 1000,
    };
  }

  /** 挑战指定对手 */
  async challenge(uid: Uid, targetUid: Uid): Promise<PvpBattleResult> {
    const key = String(uid);
    if (pvpLockMap.get(key)) {
      return this.loseResult('');
    }
    if (String(uid) === String(targetUid)) {
      throw new Error('不能挑战自己');
    }
    pvpLockMap.set(key, true);

    try {
      const players = await this.playerService.list(uid);
      if (!players.length) throw new Error('角色不存在');
      let attacker = players[0];

      const defenders = await this.playerService.list(targetUid);
      if (!defenders.length) throw new Error('对手不存在');
      const defender = defenders[0];

      // daily limit
      const isVip = isVipActive(attacker);
      const maxAttacks = MAX_DAILY_ATTACKS + (isVip ? VIP_EXTRA_ATTACKS : 0);
      const today = this.todayStr();
      const dailyRecs = await dataStorageService.list('pvp_daily', { uid: key, date: today });
      const daily = dailyRecs.length ? dailyRecs[0] : null;
      const used = daily?.attacks || 0;
      if (used >= maxAttacks) throw new Error('今日挑战次数已用完');

      const lastTime = daily?.last_attack_time || 0;
      if (Date.now() / 1000 - lastTime < PVP_COOLDOWN) throw new Error('冷却中，请稍后');

      const result = await this.runPvpBattle(uid, attacker, defender);

      // update daily record
      const now = Math.floor(Date.now() / 1000);
      if (daily) {
        await dataStorageService.update('pvp_daily', daily.id, {
          attacks: used + 1,
          last_attack_time: now,
        });
      } else {
        await dataStorageService.insert('pvp_daily', {
          uid: key,
          date: today,
          attacks: 1,
          last_attack_time: now,
        });
      }

      // update rankings
      await this.updateRanking(uid, attacker.name, attacker.level, result.result === BattleResultEnum.WIN);
      await this.updateRanking(targetUid, defender.name, defender.level, result.result !== BattleResultEnum.WIN);

      // settle rewards for winner
      if (result.result === BattleResultEnum.WIN) {
        await this.playerService.addGold(uid, WIN_GOLD);
        await this.playerService.addReputation(uid, WIN_REPUTATION);

        this.push(uid, 'pvp_reward', '竞技场奖励', {
          gold: WIN_GOLD, reputation: WIN_REPUTATION, score_change: WIN_SCORE,
        });

        try {
          const [pList] = await Promise.all([this.playerService.list(uid)]);
          if (pList.length) wsManager.sendToUser(uid, { type: 'player', data: pList[0] });
        } catch {}
      }

      // save battle record
      await dataStorageService.insert('pvp_record', {
        attacker_uid: String(uid),
        defender_uid: String(targetUid),
        attacker_name: attacker.name,
        defender_name: defender.name,
        winner_uid: result.result === BattleResultEnum.WIN ? String(uid) : String(targetUid),
        rounds: result.rounds,
        reward_gold: result.result === BattleResultEnum.WIN ? WIN_GOLD : 0,
        reward_reputation: result.result === BattleResultEnum.WIN ? WIN_REPUTATION : 0,
        create_time: now,
      });

      // notify defender if online
      if (wsManager.isUserConnected(targetUid)) {
        wsManager.sendToUser(targetUid, {
          type: 'pvp_notify',
          data: {
            message: result.result === BattleResultEnum.WIN
              ? `${attacker.name} 在竞技场挑战了你并获胜`
              : `${attacker.name} 在竞技场挑战了你但失败了`,
            attacker_name: attacker.name,
            result: result.result === BattleResultEnum.WIN ? 'attacker_win' : 'defender_win',
          },
        });
      }

      this.push(uid, 'pvp_battle_end', '竞技场战斗结束', {
        result: result.result === BattleResultEnum.WIN ? 'win' : 'lose',
      });
      return result;
    } catch (e: any) {
      logger.error('PVP 挑战异常', { uid, targetUid, err: e?.message });
      this.push(uid, 'pvp_battle_end', e?.message || '挑战异常', { result: 'error' });
      return this.loseResult('');
    } finally {
      pvpLockMap.delete(key);
    }
  }

  /** 获取战斗记录 */
  async getRecords(uid: Uid): Promise<any[]> {
    const uidStr = String(uid);
    const records = await dataStorageService.list('pvp_record', {});
    return records
      .filter((r: any) => r.attacker_uid === uidStr || r.defender_uid === uidStr)
      .sort((a: any, b: any) => (b.create_time || 0) - (a.create_time || 0))
      .slice(0, 20);
  }

  private async runPvpBattle(uid: Uid, rawAttacker: any, rawDefender: any): Promise<PvpBattleResult> {
    let attacker = { ...rawAttacker };
    let defender = { ...rawDefender };

    // apply % bonuses for attacker
    if (attacker.phy_def_pct) attacker.phy_def = Math.floor((attacker.phy_def || 0) * (1 + attacker.phy_def_pct / 100));
    if (attacker.mag_def_pct) attacker.mag_def = Math.floor((attacker.mag_def || 0) * (1 + attacker.mag_def_pct / 100));
    if (attacker.max_hp_pct) {
      const b = Math.floor((attacker.max_hp || attacker.hp) * attacker.max_hp_pct / 100);
      attacker.hp += b; attacker.max_hp = (attacker.max_hp || attacker.hp) + b;
    }
    // apply for defender too
    if (defender.phy_def_pct) defender.phy_def = Math.floor((defender.phy_def || 0) * (1 + defender.phy_def_pct / 100));
    if (defender.mag_def_pct) defender.mag_def = Math.floor((defender.mag_def || 0) * (1 + defender.mag_def_pct / 100));
    if (defender.max_hp_pct) {
      const b = Math.floor((defender.max_hp || defender.hp) * defender.max_hp_pct / 100);
      defender.hp += b; defender.max_hp = (defender.max_hp || defender.hp) + b;
    }

    // PVP uses max_hp for both sides (full health)
    let atkHP = attacker.max_hp || attacker.hp;
    let defHP = defender.max_hp || defender.hp;
    const atkMaxHp = atkHP;
    const defMaxHp = defHP;

    this.push(uid, 'pvp_battle_start', `竞技场战斗开始！对阵【${defender.name}】`, {
      player_hp: atkHP, player_max_hp: atkMaxHp,
      opponent_hp: defHP, opponent_max_hp: defMaxHp,
      opponent_name: defender.name, opponent_level: defender.level,
    });

    let round = 1;
    const logs: any[] = [];

    while (atkHP > 0 && defHP > 0 && round <= MAX_ROUNDS) {
      const roundEvents: any[] = [];
      const add = (ev: string, msg: string, d?: any) => roundEvents.push({ event: ev, message: msg, ...d });

      add('round_start', `回合 ${round}`);

      const aElemMul = 1 + calcElementBonus(attacker, defender) / 100;
      const dElemMul = 1 + calcElementBonus(defender, attacker) / 100;

      // attacker normal attack
      const aPhyHit = calculateHit(attacker, defender);
      const aPhyR = aPhyHit ? calcPhysicalDamage(attacker, defender) : { damage: 0, isCrit: false };
      const aPhy = { damage: Math.floor(aPhyR.damage * aElemMul), isCrit: aPhyR.isCrit };
      const aMagHit = calculateHit(attacker, defender);
      const aMagR = aMagHit ? calcMagicDamage(attacker, defender) : { damage: 0, isCrit: false };
      const aMag = { damage: Math.floor(aMagR.damage * aElemMul), isCrit: aMagR.isCrit };

      // defender attack back
      const dPhyHit = calculateHit(defender, attacker);
      const dPhyR = dPhyHit ? calcPhysicalDamage(defender, attacker) : { damage: 0, isCrit: false };
      const dPhy = { damage: Math.floor(dPhyR.damage * dElemMul), isCrit: dPhyR.isCrit };
      const dMagHit = calculateHit(defender, attacker);
      const dMagR = dMagHit ? calcMagicDamage(defender, attacker) : { damage: 0, isCrit: false };
      const dMag = { damage: Math.floor(dMagR.damage * dElemMul), isCrit: dMagR.isCrit };

      const newDefHP = Math.max(0, defHP - aPhy.damage - aMag.damage);
      const newAtkHP = Math.max(0, atkHP - dPhy.damage - dMag.damage);

      const ct = (c: boolean) => c ? '【暴击】' : '';
      add('player_phy_attack', aPhyHit
        ? `你使用了 物理攻击${ct(aPhy.isCrit)} ${defender.name} 掉血 ${aPhy.damage}`
        : `你使用了 物理攻击 ${defender.name} 掉血 未命中`, {
        damage: aPhy.damage, player_hp: newAtkHP, player_max_hp: atkMaxHp,
        monster_hp: newDefHP, monster_max_hp: defMaxHp,
      });
      add('player_mag_attack', aMagHit
        ? `你使用了 魔法攻击${ct(aMag.isCrit)} ${defender.name} 掉血 ${aMag.damage}`
        : `你使用了 魔法攻击 ${defender.name} 掉血 未命中`, {
        damage: aMag.damage, player_hp: newAtkHP, player_max_hp: atkMaxHp,
        monster_hp: newDefHP, monster_max_hp: defMaxHp,
      });
      add('monster_phy_attack', dPhyHit
        ? `${defender.name} 使用了 物理攻击${ct(dPhy.isCrit)} 你 掉血 ${dPhy.damage}`
        : `${defender.name} 使用了 物理攻击 你 掉血 未命中`, {
        damage: dPhy.damage, player_hp: newAtkHP, player_max_hp: atkMaxHp,
        monster_hp: newDefHP, monster_max_hp: defMaxHp,
      });
      add('monster_mag_attack', dMagHit
        ? `${defender.name} 使用了 魔法攻击${ct(dMag.isCrit)} 你 掉血 ${dMag.damage}`
        : `${defender.name} 使用了 魔法攻击 你 掉血 未命中`, {
        damage: dMag.damage, player_hp: newAtkHP, player_max_hp: atkMaxHp,
        monster_hp: newDefHP, monster_max_hp: defMaxHp,
      });

      this.pushBatch(uid, roundEvents);
      logs.push(...roundEvents);

      atkHP = newAtkHP;
      defHP = newDefHP;
      round++;

      await this.delay(600);
    }

    const won = atkHP > 0 && defHP <= 0;
    if (won) {
      this.push(uid, 'pvp_battle_win', `竞技场胜利！击败了【${defender.name}】`);
    } else if (atkHP <= 0) {
      this.push(uid, 'pvp_battle_lose', `竞技场失败！被【${defender.name}】击败`);
    } else {
      this.push(uid, 'pvp_battle_draw', `回合耗尽，竞技场平局`);
    }

    return {
      result: won ? BattleResultEnum.WIN : BattleResultEnum.LOSE,
      rounds: round - 1,
      gold: won ? WIN_GOLD : 0,
      reputation: won ? WIN_REPUTATION : 0,
      score_change: won ? WIN_SCORE : LOSE_SCORE,
      opponent_name: rawDefender.name,
      logs,
    };
  }

  private async updateRanking(uid: Uid, name: string, level: number, won: boolean): Promise<void> {
    const uidStr = String(uid);
    const recs = await dataStorageService.list('pvp_ranking', { uid: uidStr });
    if (recs.length) {
      const r = recs[0];
      await dataStorageService.update('pvp_ranking', r.id, {
        name,
        level,
        wins: (r.wins || 0) + (won ? 1 : 0),
        losses: (r.losses || 0) + (won ? 0 : 1),
        score: Math.max(0, (r.score || 1000) + (won ? WIN_SCORE : LOSE_SCORE)),
      });
    } else {
      await dataStorageService.insert('pvp_ranking', {
        uid: uidStr,
        name,
        level,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        score: 1000 + (won ? WIN_SCORE : LOSE_SCORE),
      });
    }
  }

  private loseResult(opponentName: string): PvpBattleResult {
    return {
      result: BattleResultEnum.LOSE, rounds: 0,
      gold: 0, reputation: 0, score_change: LOSE_SCORE,
      opponent_name: opponentName, logs: [],
    };
  }

  private push(uid: Uid, type: string, message: string, data?: any): void {
    this._seq++;
    wsManager.sendToUser(uid, { type: 'pvp_battle', data: { event: type, message, _seq: this._seq, ...data } });
  }

  private pushBatch(uid: Uid, events: any[]): void {
    if (!events.length) return;
    const seq = ++this._seq;
    const withSeq = events.map((e, i) => ({ ...e, _seq: seq * 1000 + i }));
    wsManager.sendToUser(uid, { type: 'pvp_battle', data: { batch: true, events: withSeq } });
  }

  private delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

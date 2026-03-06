/**
 * Boss 战斗服务
 *
 * 与怪物战斗流程一致，但：
 * - Boss 血量全局共享，多人同时攻击
 * - 仅击杀者获得奖励
 * - 死亡后 30 秒刷新
 * - 不支持自动战斗
 */
import { PlayerService } from './player.service';
import { SkillService } from './skill.service';
import { EquipInstanceService } from './equip_instance.service';
import { BagService } from './bag.service';
import { BoostService } from './boost.service';
import { Uid } from '../types/index';
import { isVipActive } from '../types/player';
import { BattleResultEnum } from '../types/enum';
import { wsManager } from '../event/ws-manager';
import { sendBossRespawnToSubscribers } from '../event/boss-subscription';
import { logger } from '../utils/logger';
import { dataStorageService } from './data-storage.service';
import { findOneAndUpdate } from '../config/db';
import { createError, ErrorCode } from '../utils/error';
import { applyBattleBonuses } from '../utils/combat-bonus';
import { createAutoHealHandler, processDropList, settleBattleRewards } from '../utils/battle-shared';
import { toUidKey } from '../utils/uid-key';
import { BossModel } from '../model/boss.model';
import { runBattle } from '../battle/runner';

const MAX_ROUNDS = 100;
const RESPAWN_SECONDS = 30;

interface BossResult {
  result: BattleResultEnum;
  rounds: number;
  exp: number;
  gold: number;
  reputation: number;
  items: any[];
  logs: any[];
}

const bossLockMap = new Map<string, boolean>();
const bossBattleState = new Map<string, { stopRequested: boolean }>();
const respawnTimers = new Map<number, NodeJS.Timeout>();

export class BossService {
  private playerService = new PlayerService();
  private bossModel = new BossModel();
  private skillService = new SkillService();
  private equipInstanceService = new EquipInstanceService();
  private bagService = new BagService();
  private _seq = 0;

  async getBoss(id: number): Promise<any | null> {
    const boss = await dataStorageService.getById('boss', id);
    if (!boss) return null;
    let dropList = await dataStorageService.list('boss_drop', { boss_id: id });
    if (!dropList?.length) dropList = await dataStorageService.list('monster_drop', { monster_id: id });
    const items = await dataStorageService.list('item', undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const dropsWithName = dropList.map((d: any) => ({
      item_id: d.item_id,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
      quantity: d.quantity ?? 1,
      probability: d.probability ?? 0,
    }));
    return { ...boss, drops: dropsWithName };
  }

  async getBossList(uid: Uid, mapId?: number): Promise<any[]> {
    const filter = mapId != null ? { map_id: mapId } : {};
    const bosses = await dataStorageService.list('boss', filter);
    if (!bosses.length) return [];

    const states = await dataStorageService.list('boss_state', {});
    const stateMap = new Map(states.map((s: any) => [s.boss_id, s]));

    const now = Math.floor(Date.now() / 1000);
    const result: any[] = [];

    for (const boss of bosses) {
      let state = stateMap.get(boss.id);
      if (!state) {
        state = { boss_id: boss.id, current_hp: boss.hp, max_hp: boss.hp, last_death_time: 0 };
        await this.ensureBossState(boss);
      }

      if (state.last_death_time > 0 && now - state.last_death_time >= RESPAWN_SECONDS) {
        await this.respawnBoss(boss.id, boss.hp);
        sendBossRespawnToSubscribers(boss.map_id || 1, boss.id, boss.name || '未知Boss');
        state = { boss_id: boss.id, current_hp: boss.hp, max_hp: boss.hp, last_death_time: 0 };
      }

      const currentHp = state.last_death_time > 0 ? 0 : state.current_hp;
      const respawnRemain = state.last_death_time > 0
        ? Math.max(0, RESPAWN_SECONDS - (now - state.last_death_time))
        : 0;

      result.push({
        ...boss,
        current_hp: currentHp,
        max_hp: state.max_hp || boss.hp,
        can_fight: currentHp > 0,
        respawn_remain: respawnRemain,
      });
    }

    return result.sort((a, b) => (a.level || 0) - (b.level || 0));
  }

  async challenge(uid: Uid, bossId: number, autoHeal?: any): Promise<BossResult> {
    const key = toUidKey(uid);
    if (bossLockMap.get(key)) return this.loseResult();

    bossLockMap.set(key, true);
    bossBattleState.set(key, { stopRequested: false });

    try {
      const boss = await this.getBoss(bossId);
      if (!boss) throw createError(ErrorCode.BOSS_NOT_FOUND, 'Boss 不存在');

      const players = await this.playerService.list(uid);
      if (!players.length) throw createError(ErrorCode.PLAYER_NOT_FOUND, '角色不存在');

      await this.ensureBossState(boss);
      const state = await this.getBossState(bossId);
      if (!state || state.current_hp <= 0) {
        if (state?.last_death_time && Math.floor(Date.now() / 1000) - state.last_death_time < RESPAWN_SECONDS) {
          throw createError(ErrorCode.BOSS_DEAD, `Boss 已死亡，${RESPAWN_SECONDS - (Math.floor(Date.now() / 1000) - state.last_death_time)} 秒后刷新`);
        }
        throw createError(ErrorCode.BOSS_DEAD, 'Boss 不可挑战');
      }

      const result = await this.runBossBattle(uid, players[0], boss, autoHeal);

      this.pushEvent(uid, 'battle_end', '战斗结束', { result: result.result === BattleResultEnum.WIN ? 'win' : 'lose' });
      return result;
    } catch (e: any) {
      logger.error('Boss 挑战异常', { uid, bossId, err: e?.message });
      this.pushEvent(uid, 'battle_end', e?.message || '挑战异常', { result: 'error' });
      return this.loseResult();
    } finally {
      bossLockMap.delete(key);
      bossBattleState.delete(key);
    }
  }

  stopBattle(uid: Uid): boolean {
    const s = bossBattleState.get(toUidKey(uid));
    if (!s) return false;
    s.stopRequested = true;
    return true;
  }

  private async ensureBossState(boss: any): Promise<void> {
    const existing = await dataStorageService.list('boss_state', { boss_id: boss.id });
    if (existing.length) return;

    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert('boss_state', {
      boss_id: boss.id,
      current_hp: boss.hp,
      max_hp: boss.hp,
      last_death_time: 0,
      create_time: now,
      update_time: now,
    });
  }

  private async getBossState(bossId: number): Promise<any | null> {
    const list = await dataStorageService.list('boss_state', { boss_id: bossId });
    return list.length ? list[0] : null;
  }

  private async respawnBoss(bossId: number, maxHp: number): Promise<void> {
    const list = await dataStorageService.list('boss_state', { boss_id: bossId });
    if (list.length) {
      await dataStorageService.update('boss_state', list[0].id, {
        current_hp: maxHp,
        max_hp: maxHp,
        last_death_time: 0,
      });
    }
  }

  /** Boss 死亡后 30 秒复活，并推送给已订阅的玩家 */
  private scheduleBossRespawn(bossId: number, mapId: number, bossName: string, maxHp: number): void {
    const existing = respawnTimers.get(bossId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      respawnTimers.delete(bossId);
      try {
        await this.respawnBoss(bossId, maxHp);
        sendBossRespawnToSubscribers(mapId, bossId, bossName || '未知Boss');
      } catch (e) {
        logger.error('Boss 复活推送失败', { bossId, error: e instanceof Error ? e.message : String(e) });
      }
    }, RESPAWN_SECONDS * 1000);
    respawnTimers.set(bossId, timer);
  }

  private async atomicDamageBoss(bossId: number, damage: number): Promise<{ newHp: number; isKill: boolean } | null> {
    const list = await dataStorageService.list('boss_state', { boss_id: bossId });
    if (!list.length) return null;

    const state = list[0];
    if (state.current_hp <= 0) return null;

    const doc = await findOneAndUpdate(
      'boss_state',
      { boss_id: bossId, current_hp: { $gt: 0 } },
      { $inc: { current_hp: -Math.max(0, damage) } },
      { returnDocument: 'after' }
    );

    if (!doc) return null;

    const newHp = doc.current_hp ?? 0;
    const isKill = newHp <= 0;

    if (isKill) {
      await dataStorageService.update('boss_state', state.id, {
        current_hp: 0,
        last_death_time: Math.floor(Date.now() / 1000),
      });
    }

    return { newHp: Math.max(0, newHp), isKill };
  }

  private async runBossBattle(uid: Uid, rawPlayer: any, boss: any, autoHeal?: any): Promise<BossResult> {
    const key = toUidKey(uid);
    let player = { ...rawPlayer };
    const bossCopy = { ...boss, max_hp: boss.hp };

    player = applyBattleBonuses(player);

    const state = await this.getBossState(boss.id);
    const bossCopyWithHp = { ...bossCopy, hp: state?.current_hp ?? boss.hp };

    const runResult = await runBattle(player, bossCopyWithHp, {
      maxRounds: MAX_ROUNDS,
      vipSkillBonus: isVipActive(rawPlayer) ? 20 : 0,
      delayMs: 800,
      pushEvent: (ev, msg, d) => this.pushEvent(uid, ev, msg, d),
      pushBatch: (events) => this.pushBatch(uid, events),
      shouldStop: () => !!bossBattleState.get(key)?.stopRequested,
      beforeEachRound: autoHeal
        ? createAutoHealHandler(uid, autoHeal, { bagService: this.bagService, playerService: this.playerService }, 'Boss ')
        : undefined,
      getAttackerSkills: () => this.skillService.getEquippedSkills(uid),
      consumeAttackerMp: async (attacker, amount) => {
        await this.playerService.update(rawPlayer.id, { mp: (attacker.mp ?? 0) - amount });
      },
      applyDamageToDefender: async (damage) => {
        if (damage <= 0) {
          const s = await this.getBossState(boss.id);
          return s?.current_hp ?? 0;
        }
        const result = await this.atomicDamageBoss(boss.id, damage);
        if (!result) return null;
        if (result.isKill) {
          this.scheduleBossRespawn(boss.id, boss.map_id || 1, boss.name || '未知Boss', boss.hp || 0);
        }
        return result.newHp;
      },
    });

    if (runResult.winner === 'defender' || runResult.winner === 'draw') {
      return this.loseResult();
    }

    const boostSvc = new BoostService();
    const bCfg = await boostSvc.getBoostConfig(uid);
    const pList = await this.playerService.list(uid);
    const vipDropMult = (pList.length && isVipActive(pList[0])) ? 2 : 1;
    const items = await this.processDrop(uid, bossCopy, BoostService.calcMultipliers(bCfg).drop * vipDropMult);
    await this.settle(uid, {
      result: BattleResultEnum.WIN,
      rounds: runResult.rounds,
      exp: boss.exp || 0,
      gold: boss.gold || 0,
      reputation: boss.reputation || 0,
      items,
      logs: [],
    });
    return {
      result: BattleResultEnum.WIN,
      rounds: runResult.rounds,
      exp: boss.exp || 0,
      gold: boss.gold || 0,
      reputation: boss.reputation || 0,
      items,
      logs: [],
    };
  }

  private settle(uid: Uid, result: BossResult): Promise<void> {
    return settleBattleRewards(uid, result, {
      playerService: this.playerService,
      bagService: this.bagService,
      pushEvent: (u, ev, msg, data) => this.pushEvent(u, ev, msg, data),
    });
  }

  private processDrop(uid: Uid, boss: any, dropMultiplier: number = 1): Promise<any[]> {
    return processDropList(uid, boss, dropMultiplier, {
      bagService: this.bagService,
      equipInstanceService: this.equipInstanceService,
    }, 'boss_drop', 'monster_drop');
  }

  private loseResult(): BossResult {
    return {
      result: BattleResultEnum.LOSE, rounds: 0,
      exp: 0, gold: 0, reputation: 0, items: [], logs: [],
    };
  }

  private pushEvent(uid: Uid, type: string, message: string, data?: any): void {
    this._seq++;
    wsManager.sendToUser(uid, { type: 'boss_battle', data: { event: type, message, _seq: this._seq, ...data } });
  }

  private pushBatch(uid: Uid, events: any[]): void {
    if (!events.length) return;
    const seq = ++this._seq;
    const withSeq = events.map((e, i) => ({ ...e, _seq: seq * 1000 + i }));
    wsManager.sendToUser(uid, { type: 'boss_battle', data: { batch: true, events: withSeq } });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // ==================== GM 管理 ====================
  async add(data: any): Promise<number> {
    return await this.bossModel.insert(data);
  }

  async update(id: number, data: any): Promise<boolean> {
    return await this.bossModel.update(id, data);
  }

  async delete(id: number): Promise<boolean> {
    return await this.bossModel.delete(id);
  }
}

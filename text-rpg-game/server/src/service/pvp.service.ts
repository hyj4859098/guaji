/**
 * PVP 服务：地图玩家列表、强制 PK 挑战
 */
import { Uid } from '../types/index';
import { PlayerService } from './player.service';
import { SkillService } from './skill.service';
import { runBattle } from '../battle/runner';
import { getMapSubscriberUids } from '../event/boss-subscription';
import { setInBattle, clearInBattle, isInBattle, setMapBan } from '../event/pvp-presence';
import { wsManager } from '../event/ws-manager';
import { logger } from '../utils/logger';

function toKey(uid: Uid): string {
  return String(uid);
}

export interface MapPlayer {
  uid: string;
  name: string;
  level: number;
  in_battle: boolean;
}

export class PvpService {
  private playerService = new PlayerService();
  private skillService = new SkillService();

  /** 获取对手完整战斗属性，用于 PVP 战斗页展示（含已装备技能） */
  async getOpponentForDisplay(targetUid: Uid): Promise<any | null> {
    const [players, equippedSkills] = await Promise.all([
      this.playerService.list(targetUid),
      this.skillService.getEquippedSkills(targetUid),
    ]);
    const p = players[0];
    if (!p) return null;
    const { physical = [], magic = [] } = equippedSkills || {};
    const skills = [...physical, ...magic].filter((s: any) => s?.name != null);
    return {
      name: p.name || '对手',
      level: p.level || 1,
      hp: p.hp ?? 0,
      max_hp: p.max_hp || p.hp || 1,
      mp: p.mp ?? 0,
      max_mp: p.max_mp ?? p.mp ?? 0,
      phy_atk: p.phy_atk ?? 0,
      mag_atk: p.mag_atk ?? 0,
      phy_def: p.phy_def ?? 0,
      mag_def: p.mag_def ?? 0,
      hit_rate: p.hit_rate ?? 0,
      dodge_rate: p.dodge_rate ?? 0,
      crit_rate: p.crit_rate ?? 0,
      elem_metal: p.elem_metal ?? 0,
      elem_wood: p.elem_wood ?? 0,
      elem_water: p.elem_water ?? 0,
      elem_fire: p.elem_fire ?? 0,
      elem_earth: p.elem_earth ?? 0,
      skills,
    };
  }

  async getPlayersInMap(mapId: number, excludeUid?: Uid): Promise<MapPlayer[]> {
    const exclude = excludeUid != null && excludeUid !== '' ? toKey(excludeUid) : null;
    const uids = exclude
      ? getMapSubscriberUids(mapId).filter((uid) => uid !== exclude)
      : getMapSubscriberUids(mapId);
    if (!uids.length) return [];

    const playersList = await Promise.all(
      uids.map((uidStr) => this.playerService.list(Number(uidStr) || uidStr))
    );

    return uids
      .map((uidStr, i) => {
        const p = playersList[i]?.[0];
        if (!p) return null;
        const uid = Number(uidStr) || uidStr;
        return {
          uid: toKey(uid),
          name: p.name || '玩家',
          level: p.level || 1,
          in_battle: isInBattle(uid),
        };
      })
      .filter((x): x is MapPlayer => x != null);
  }

  async challenge(challengerUid: Uid, targetUid: Uid, mapId: number): Promise<{ ok: boolean; error?: string }> {
    if (toKey(challengerUid) === toKey(targetUid)) {
      return { ok: false, error: '不能挑战自己' };
    }

    if (isInBattle(targetUid)) {
      return { ok: false, error: '对方正在战斗中' };
    }

    if (isInBattle(challengerUid)) {
      return { ok: false, error: '您正在战斗中' };
    }

    const [challengerPlayers, targetPlayers] = await Promise.all([
      this.playerService.list(challengerUid),
      this.playerService.list(targetUid),
    ]);

    const challenger = challengerPlayers[0];
    const target = targetPlayers[0];

    if (!challenger || !target) {
      return { ok: false, error: '玩家不存在' };
    }

    setInBattle(challengerUid, targetUid, mapId);
    this.notifyMapPlayersChanged(mapId);

    wsManager.sendToUser(targetUid, {
      type: 'pvp_challenged',
      data: {
        challenger_uid: toKey(challengerUid),
        challenger_name: challenger.name || '玩家',
        challenger_level: challenger.level || 1,
        map_id: mapId,
      },
    });

    // 先返回成功，让双方客户端进入战斗页；延迟 3 秒后开战，与前端倒计时同步
    setTimeout(() => this.runPvpBattle(challenger, target, challengerUid, targetUid, mapId), 3000);
    return { ok: true };
  }

  /** 将发起方视角的消息转换为被挑战方视角（你 <-> 对手 互换）；使用私有区占位符避免与名字冲突 */
  private toTargetViewMessage(msg: string, challengerName: string, defenderName: string): string {
    const PLACEHOLDER = '\uE000';
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return msg
      .replace(/你/g, PLACEHOLDER)
      .replace(defenderName ? new RegExp(esc(defenderName), 'g') : /(?!)/, '你')
      .split(PLACEHOLDER)
      .join(challengerName);
  }

  /** 被挑战方视角：交换 player_* 与 monster_*（左=自己=防守方，右=对手=攻击方） */
  private swapForTargetView(d: Record<string, any>): Record<string, any> {
    const out = { ...d };
    const swap = (a: string, b: string) => {
      const va = out[a]; const vb = out[b];
      if (va !== undefined || vb !== undefined) { out[a] = vb; out[b] = va; }
    };
    swap('player_hp', 'monster_hp');
    swap('player_max_hp', 'monster_max_hp');
    swap('player_mp', 'monster_mp');
    swap('player_max_mp', 'monster_max_mp');
    return out;
  }

  private async runPvpBattle(
    challenger: any,
    target: any,
    challengerUid: Uid,
    targetUid: Uid,
    mapId: number
  ): Promise<void> {
    const challengerName = challenger.name || '对手';
    const defenderName = target.name || '对手';
    let eventSeq = 0;
    const pushEvent = (ev: string, msg: string, d?: any) => {
      eventSeq++;
      const base = { event: ev, _seq: eventSeq, ...d };
      const challengerPayload = { type: 'pvp_battle', data: { ...base, message: msg } };
      const targetPayload = { type: 'pvp_battle', data: { ...this.swapForTargetView(base), message: this.toTargetViewMessage(msg, challengerName, defenderName) } };
      wsManager.sendToUser(challengerUid, challengerPayload);
      wsManager.sendToUser(targetUid, targetPayload);
    };

    const pushBatch = (events: Array<{ event: string; message: string; [k: string]: any }>) => {
      if (!events.length) return;
      const seq = ++eventSeq;
      const challengerEvents = events.map((e, i) => ({ ...e, _seq: seq * 1000 + i }));
      const targetEvents = events.map((e, i) => ({ ...this.swapForTargetView(e), message: this.toTargetViewMessage(e.message, challengerName, defenderName), _seq: seq * 1000 + i }));
      wsManager.sendToUser(challengerUid, { type: 'pvp_battle', data: { batch: true, events: challengerEvents } });
      wsManager.sendToUser(targetUid, { type: 'pvp_battle', data: { batch: true, events: targetEvents } });
    };

    try {
      const maxChallengerHp = challenger.max_hp || challenger.hp || 100;
      const maxTargetHp = target.max_hp || target.hp || 100;
      const challengerCopy = {
        ...challenger,
        hp: maxChallengerHp,
        max_hp: maxChallengerHp,
        max_mp: challenger.max_mp ?? challenger.mp ?? 0,
        mp: challenger.mp ?? 0,
      };
      const targetCopy = {
        ...target,
        hp: maxTargetHp,
        max_hp: maxTargetHp,
        max_mp: target.max_mp ?? target.mp ?? 0,
        mp: target.mp ?? 0,
        name: target.name || '对手',
      };

      const [attackerSkills, defenderSkills] = await Promise.all([
        this.skillService.getEquippedSkills(challengerUid),
        this.skillService.getEquippedSkills(targetUid),
      ]);

      const runResult = await runBattle(challengerCopy, targetCopy, {
        maxRounds: 100,
        pushEvent,
        pushBatch,
        delayMs: 1000,
        attackerSkills,
        defenderSkills,
        consumeAttackerMp: async () => { /* PVP 满血满蓝对决，不消耗真实 MP */ },
        consumeDefenderMp: async () => { /* PVP 满血满蓝对决，不消耗真实 MP */ },
      });

      /* PVP 不修改玩家真实血量蓝量，避免残血时被偷袭 */

      let loserUid: Uid | null = null;
      let winnerUid: Uid;

      if (runResult.winner === 'attacker') {
        winnerUid = challengerUid;
        loserUid = targetUid;
      } else if (runResult.winner === 'defender') {
        winnerUid = targetUid;
        loserUid = challengerUid;
      } else {
        loserUid = null;
        winnerUid = challengerUid;
      }

      if (runResult.winner === 'draw') {
        setMapBan(challengerUid, mapId, 30);
        setMapBan(targetUid, mapId, 30);
      } else if (loserUid) {
        setMapBan(loserUid, mapId, 30);
      }

      clearInBattle(challengerUid);
      this.notifyMapPlayersChanged(mapId);

      const challengerRedirect = runResult.winner === 'attacker' ? 'boss-list' : 'map';
      const targetRedirect = runResult.winner === 'defender' ? 'boss-list' : 'map';

      const getBanUntil = (uid: Uid) => {
        const until = Math.floor(Date.now() / 1000) + 30;
        return { map_id: mapId, ban_until: until };
      };

      const baseData = {
        winner_uid: toKey(winnerUid),
        loser_uid: loserUid ? toKey(loserUid) : null,
        draw: runResult.winner === 'draw',
      };
      const challengerData = { ...baseData, redirect: challengerRedirect };
      const targetData = { ...baseData, redirect: targetRedirect };
      if (runResult.winner === 'defender') Object.assign(challengerData, getBanUntil(challengerUid));
      if (runResult.winner === 'attacker') Object.assign(targetData, getBanUntil(targetUid));
      if (runResult.winner === 'draw') {
        Object.assign(challengerData, getBanUntil(challengerUid));
        Object.assign(targetData, getBanUntil(targetUid));
      }
      wsManager.sendToUser(challengerUid, { type: 'pvp_result', data: challengerData });
      wsManager.sendToUser(targetUid, { type: 'pvp_result', data: targetData });
    } catch (e) {
      logger.error('PVP 战斗异常', { challengerUid, targetUid, e: e instanceof Error ? e.message : String(e) });
      clearInBattle(challengerUid);
      this.notifyMapPlayersChanged(mapId);
      const errPayload = { type: 'pvp_result', data: { error: '战斗异常', redirect: 'boss-list' } };
      wsManager.sendToUser(challengerUid, errPayload);
      wsManager.sendToUser(targetUid, errPayload);
    }
  }

  /** 广播地图玩家列表变化（供 boss-subscription 在订阅/取消时调用） */
  notifyMapPlayersChanged(mapId: number): void {
    this.getPlayersInMap(mapId).then((players) => {
      const uids = getMapSubscriberUids(mapId);
      const payload = { type: 'pvp_map_players', data: { map_id: mapId, players } };
      uids.forEach((uidStr) => {
        const uid = Number(uidStr) || uidStr;
        wsManager.sendToUser(uid, payload);
      });
    });
  }
}

export const pvpService = new PvpService();

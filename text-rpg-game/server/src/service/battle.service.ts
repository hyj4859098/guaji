/**
 * 战斗服务
 *
 * 单场战斗：startBattle() — 同步执行一场，返回结果
 * 自动战斗：startAutoBattle() — 后台持久循环，API 立即返回
 * 离线恢复：resumeAutoBattle() — 快速模拟离线期间战斗 + 恢复在线自动战斗
 */
import { PlayerService } from './player.service';
import { MonsterService } from './monster.service';
import { SkillService } from './skill.service';
import { EquipInstanceService } from './equip_instance.service';
import { BagService } from './bag.service';
import { OfflineBattleService } from './offline-battle.service';
import { Uid } from '../types/index';
import { AutoBattleConfig, isVipActive } from '../types/player';
import { BoostService } from './boost.service';
import { BattleResultEnum } from '../types/enum';
import { wsManager } from '../event/ws-manager';
import { logger } from '../utils/logger';
import { applyBattleBonuses } from '../utils/combat-bonus';
import { createAutoHealHandler, processDropList, settleBattleRewards } from '../utils/battle-shared';
import { toUidKey } from '../utils/uid-key';
import { runBattle } from '../battle/runner';

interface BattleResult {
  result: BattleResultEnum;
  rounds: number;
  exp: number;
  gold: number;
  reputation: number;
  items: any[];
  logs: any[];
  create_time: number;
}

const MAX_ROUNDS_PER_BATTLE = 100;

const battleState = new Map<string, { running: boolean; stopRequested: boolean }>();

export class BattleService {
  private playerService = new PlayerService();
  private monsterService = new MonsterService();
  private skillService = new SkillService();
  private equipInstanceService = new EquipInstanceService();
  private bagService = new BagService();
  private offlineBattleService = new OfflineBattleService();
  private _eventSeq = 0;

  // ==================== 单场战斗（不变） ====================

  async startBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<BattleResult> {
    const key = toUidKey(uid);
    if (battleState.get(key)?.running) {
      return this.createLoseResult();
    }

    battleState.set(key, { running: true, stopRequested: false });
    let result: BattleResult;

    try {
      result = await this.runOneBattle(uid, enemyId, autoHeal);
      if (result.result === BattleResultEnum.WIN) {
        await this.settle(uid, result);
      }
      this.pushEvent(uid, 'battle_end', '战斗结束', { result: 'completed' });
    } catch (e) {
      logger.error('战斗异常', { uid, e: e instanceof Error ? e.message : String(e) });
      this.pushEvent(uid, 'battle_end', '战斗异常结束', { result: 'error' });
      result = this.createLoseResult();
    } finally {
      battleState.delete(key);
    }

    return result;
  }

  // ==================== 自动战斗（后台持久循环） ====================

  async startAutoBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<boolean> {
    const key = toUidKey(uid);
    if (battleState.get(key)?.running) return false;

    await this.saveAutoBattleConfig(uid, enemyId, autoHeal);
    battleState.set(key, { running: true, stopRequested: false });

    this._autoBattleLoop(uid, enemyId, autoHeal).catch(e => {
      logger.error('自动战斗循环异常', { uid, e: e instanceof Error ? e.message : String(e) });
    });

    return true;
  }

  private async _autoBattleLoop(uid: Uid, enemyId: number, autoHeal?: any): Promise<void> {
    const key = toUidKey(uid);

    try {
      // 短暂延迟，给「自动战斗中再次 start」等 API 调用留出检测窗口（无 WS 的集成测试场景）
      await this.delay(150);

      while (true) {
        if (battleState.get(key)?.stopRequested) {
          await this.clearAutoBattleConfig(uid);
          this.pushEvent(uid, 'battle_end', '战斗已手动停止', { result: 'stopped' });
          break;
        }

        if (!wsManager.isUserConnected(uid)) {
          const players = await this.playerService.list(uid);
          if (players.length && isVipActive(players[0])) {
            await this.updateLastBattleTime(uid);
            logger.info('VIP玩家掉线，保留自动战斗配置', { uid });
          } else {
            await this.clearAutoBattleConfig(uid);
            logger.info('非VIP玩家掉线，清除自动战斗配置', { uid });
          }
          break;
        }

        const result = await this.runOneBattle(uid, enemyId, autoHeal);

        if (result.result === BattleResultEnum.WIN) {
          await this.settle(uid, result);
          await this.updateLastBattleTime(uid);
        } else {
          await this.clearAutoBattleConfig(uid);
          this.pushEvent(uid, 'battle_end', '战斗结束', { result: 'completed' });
          break;
        }

        await this.delay(2000);
      }
    } catch (e) {
      logger.error('自动战斗异常', { uid, e: e instanceof Error ? e.message : String(e) });
      this.pushEvent(uid, 'battle_end', '战斗异常结束', { result: 'error' });
    } finally {
      battleState.delete(key);
    }
  }

  // ==================== 离线恢复 ====================

  async resumeAutoBattle(uid: Uid): Promise<{ offlineBattles: number; died: boolean; resumed: boolean }> {
    const players = await this.playerService.list(uid);
    if (!players.length) return { offlineBattles: 0, died: false, resumed: false };
    const player = players[0];
    const config = player.auto_battle_config;
    if (!config) return { offlineBattles: 0, died: false, resumed: false };

    let offlineBattles = 0;
    let died = false;

    if (isVipActive(player) && config.last_battle_time) {
      const simResult = await this.offlineBattleService.simulate(uid, config);
      offlineBattles = simResult.totalBattles;
      died = simResult.died;
    }

    if (died) {
      return { offlineBattles, died: true, resumed: false };
    }

    const freshPlayers = await this.playerService.list(uid);
    const freshConfig = freshPlayers[0]?.auto_battle_config;
    if (!freshConfig) return { offlineBattles, died: false, resumed: false };

    const autoHeal = freshConfig.auto_heal ? {
      hp_enabled: freshConfig.auto_heal.hp_enabled,
      hp_potion_bag_id: await this.resolveItemToBagId(uid, freshConfig.auto_heal.hp_item_id),
      hp_threshold: freshConfig.auto_heal.hp_threshold,
      mp_enabled: freshConfig.auto_heal.mp_enabled,
      mp_potion_bag_id: await this.resolveItemToBagId(uid, freshConfig.auto_heal.mp_item_id),
      mp_threshold: freshConfig.auto_heal.mp_threshold,
    } : undefined;

    const started = await this.startAutoBattle(uid, freshConfig.enemy_id, autoHeal);
    return { offlineBattles, died: false, resumed: started };
  }

  // ==================== 停止 & 状态 ====================

  async stopBattle(uid: Uid): Promise<boolean> {
    const s = battleState.get(toUidKey(uid));
    if (!s?.running) return false;
    s.stopRequested = true;
    return true;
  }

  async getBattleStatus(uid: Uid): Promise<{ isFighting: boolean; state: string; config?: any }> {
    const s = battleState.get(toUidKey(uid));
    if (s?.running) {
      return { isFighting: true, state: 'battle' };
    }

    const players = await this.playerService.list(uid);
    if (players.length) {
      const config = players[0].auto_battle_config;
      if (config) {
        return { isFighting: false, state: 'offline_battle', config };
      }
    }

    return { isFighting: false, state: 'idle' };
  }

  // ==================== 单场战斗逻辑（在线版，有 WS 推送） ====================

  private async runOneBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<BattleResult> {
    const key = toUidKey(uid);
    const players = await this.playerService.list(uid);
    if (!players.length) return this.createLoseResult();
    let player = players[0];

    const monster = await this.monsterService.get(enemyId);
    if (!monster) return this.createLoseResult();

    player = applyBattleBonuses(player);

    const monsterCopy = { ...monster, max_hp: monster.hp };
    const _maxHp = player.max_hp || player.hp;
    const _maxMp = player.max_mp || player.mp;

    const runResult = await runBattle(player, monsterCopy, {
      maxRounds: MAX_ROUNDS_PER_BATTLE,
      vipSkillBonus: isVipActive(player) ? 20 : 0,
      pushEvent: (ev, msg, d) => this.pushEvent(uid, ev, msg, d),
      pushBatch: (events) => this.pushBatch(uid, events),
      shouldStop: () => !!battleState.get(key)?.stopRequested,
      delayMs: 1000,
      beforeEachRound: autoHeal
        ? createAutoHealHandler(uid, autoHeal, { bagService: this.bagService, playerService: this.playerService })
        : undefined,
      getAttackerSkills: () => this.skillService.getEquippedSkills(uid),
      consumeAttackerMp: async (attacker, amount) => {
        await this.playerService.update(player.id, { mp: (attacker.mp ?? 0) - amount });
      },
    });

    if (runResult.winner === 'attacker' && runResult.attackerHp > 0) {
      await this.playerService.update(player.id, { hp: runResult.attackerHp });
    }

    if (runResult.winner === 'defender' || runResult.winner === 'draw') {
      return this.createLoseResult();
    }

    const boostSvc = new BoostService();
    const bCfg = await boostSvc.getBoostConfig(uid);
    const pList = await this.playerService.list(uid);
    const vipDropMult = (pList.length && isVipActive(pList[0])) ? 2 : 1;
    const dropMult = BoostService.calcMultipliers(bCfg).drop * vipDropMult;
    const items = await this.processDrop(uid, monsterCopy, dropMult);
    return {
      result: BattleResultEnum.WIN,
      rounds: runResult.rounds,
      exp: monsterCopy.exp || 0,
      gold: monsterCopy.gold || 0,
      reputation: monsterCopy.reputation || 0,
      items,
      logs: [],
      create_time: Math.floor(Date.now() / 1000),
    };
  }

  // ==================== 结算 ====================

  private settle(uid: Uid, result: BattleResult): Promise<void> {
    return settleBattleRewards(uid, result, {
      playerService: this.playerService,
      bagService: this.bagService,
      pushEvent: (u, ev, msg, data) => this.pushEvent(u, ev, msg, data),
    });
  }

  // ==================== 掉落 ====================

  private processDrop(uid: Uid, monster: any, dropMultiplier: number = 1): Promise<any[]> {
    return processDropList(uid, monster, dropMultiplier, {
      bagService: this.bagService,
      equipInstanceService: this.equipInstanceService,
    });
  }

  // ==================== 持久化配置 ====================

  private async saveAutoBattleConfig(uid: Uid, enemyId: number, autoHeal?: any): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length) return;

    let healConfig: AutoBattleConfig['auto_heal'] = null;
    if (autoHeal) {
      let hpItemId = 0;
      let mpItemId = 0;
      if (autoHeal.hp_potion_bag_id) {
        const bag = await this.bagService.get(autoHeal.hp_potion_bag_id);
        if (bag) hpItemId = bag.item_id;
      }
      if (autoHeal.mp_potion_bag_id) {
        const bag = await this.bagService.get(autoHeal.mp_potion_bag_id);
        if (bag) mpItemId = bag.item_id;
      }
      healConfig = {
        hp_enabled: !!autoHeal.hp_enabled,
        hp_item_id: hpItemId,
        hp_threshold: autoHeal.hp_threshold || 50,
        mp_enabled: !!autoHeal.mp_enabled,
        mp_item_id: mpItemId,
        mp_threshold: autoHeal.mp_threshold || 50,
      };
    }

    const config: AutoBattleConfig = {
      enemy_id: enemyId,
      auto_heal: healConfig,
      last_battle_time: Math.floor(Date.now() / 1000),
    };
    await this.playerService.update(players[0].id, { auto_battle_config: config } as any);
  }

  private async updateLastBattleTime(uid: Uid): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length || !players[0].auto_battle_config) return;
    const config = { ...players[0].auto_battle_config, last_battle_time: Math.floor(Date.now() / 1000) };
    await this.playerService.update(players[0].id, { auto_battle_config: config } as any);
  }

  private async clearAutoBattleConfig(uid: Uid): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length) return;
    await this.playerService.update(players[0].id, { auto_battle_config: null } as any);
  }

  private async resolveItemToBagId(uid: Uid, itemId: number): Promise<number | undefined> {
    if (!itemId) return undefined;
    const bags = await this.bagService.list(uid);
    const match = bags.find((b: any) => b.item_id === itemId && !b.equipment_uid);
    return match ? (match.original_id || match.id) : undefined;
  }

  // ==================== 工具 ====================

  private createLoseResult(): BattleResult {
    return {
      result: BattleResultEnum.LOSE,
      rounds: 0, exp: 0, gold: 0, reputation: 0,
      items: [], logs: [],
      create_time: Math.floor(Date.now() / 1000),
    };
  }

  private pushEvent(uid: Uid, type: string, message: string, data?: any): void {
    this._eventSeq++;
    wsManager.sendToUser(uid, {
      type: 'battle',
      data: { event: type, message, _seq: this._eventSeq, ...data },
    });
  }

  private pushBatch(uid: Uid, events: Array<{ event: string; message: string; [k: string]: any }>): void {
    if (!events.length) return;
    const seq = ++this._eventSeq;
    const withSeq = events.map((e, i) => ({ ...e, _seq: seq * 1000 + i }));
    wsManager.sendToUser(uid, { type: 'battle', data: { batch: true, events: withSeq } });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

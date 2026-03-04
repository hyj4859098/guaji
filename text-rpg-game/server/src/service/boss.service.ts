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
import { WealthTitleService } from './wealth-title.service';
import { LevelTitleService } from './level-title.service';
import { Uid } from '../types/index';
import { isVipActive } from '../types/player';
import { BattleResultEnum } from '../types/enum';
import { wsManager } from '../event/ws-manager';
import { sendBossRespawnToSubscribers } from '../event/boss-subscription';
import { logger } from '../utils/logger';
import { dataStorageService } from './data-storage.service';
import { findOneAndUpdate } from '../config/db';
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

function toKey(uid: Uid): string {
  return String(uid);
}

export class BossService {
  private playerService = new PlayerService();
  private bossModel = new BossModel();
  private skillService = new SkillService();
  private wealthTitleService = new WealthTitleService();
  private levelTitleService = new LevelTitleService();
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
    const key = toKey(uid);
    if (bossLockMap.get(key)) return this.loseResult();

    bossLockMap.set(key, true);
    bossBattleState.set(key, { stopRequested: false });

    try {
      const boss = await this.getBoss(bossId);
      if (!boss) throw new Error('Boss 不存在');

      const players = await this.playerService.list(uid);
      if (!players.length) throw new Error('角色不存在');

      await this.ensureBossState(boss);
      const state = await this.getBossState(bossId);
      if (!state || state.current_hp <= 0) {
        if (state?.last_death_time && Math.floor(Date.now() / 1000) - state.last_death_time < RESPAWN_SECONDS) {
          throw new Error(`Boss 已死亡，${RESPAWN_SECONDS - (Math.floor(Date.now() / 1000) - state.last_death_time)} 秒后刷新`);
        }
        throw new Error('Boss 不可挑战');
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
    const s = bossBattleState.get(toKey(uid));
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
    const key = toKey(uid);
    let player = { ...rawPlayer };
    const bossCopy = { ...boss, max_hp: boss.hp };

    const phyDefPct = player.phy_def_pct || 0;
    const magDefPct = player.mag_def_pct || 0;
    const maxHpPct = player.max_hp_pct || 0;
    if (phyDefPct) player.phy_def = Math.floor((player.phy_def || 0) * (1 + phyDefPct / 100));
    if (magDefPct) player.mag_def = Math.floor((player.mag_def || 0) * (1 + magDefPct / 100));
    if (maxHpPct) {
      const bonus = Math.floor((player.max_hp || player.hp) * maxHpPct / 100);
      player.hp += bonus;
      player.max_hp = (player.max_hp || player.hp) + bonus;
    }

    const state = await this.getBossState(boss.id);
    const bossCopyWithHp = { ...bossCopy, hp: state?.current_hp ?? boss.hp };

    const runResult = await runBattle(player, bossCopyWithHp, {
      maxRounds: MAX_ROUNDS,
      vipSkillBonus: isVipActive(rawPlayer) ? 20 : 0,
      delayMs: 800,
      pushEvent: (ev, msg, d) => this.pushEvent(uid, ev, msg, d),
      pushBatch: (events) => this.pushBatch(uid, events),
      shouldStop: () => !!bossBattleState.get(key)?.stopRequested,
      beforeEachRound: autoHeal ? async (attacker) => {
        const roundEvents: any[] = [];
        const maxHp = attacker.max_hp || attacker.hp;
        const maxMp = attacker.max_mp ?? attacker.mp ?? 0;
        const hpPct = maxHp > 0 ? (attacker.hp / maxHp) * 100 : 100;
        const mpPct = maxMp > 0 ? ((attacker.mp ?? 0) / maxMp) * 100 : 100;
        let curPlayer = attacker;
        if (autoHeal.hp_enabled && autoHeal.hp_potion_bag_id && hpPct < (autoHeal.hp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.hp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              curPlayer = pList[0];
              roundEvents.push({ event: 'auto_heal', message: `自动使用补血药水，HP: ${curPlayer.hp}/${maxHp}`, player_hp: curPlayer.hp, player_max_hp: maxHp, player_mp: curPlayer.mp, player_max_mp: maxMp });
            }
          } catch { logger.warn('Boss 自动补血失败', { uid }); }
        }
        if (autoHeal.mp_enabled && autoHeal.mp_potion_bag_id && mpPct < (autoHeal.mp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.mp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              curPlayer = pList[0];
              roundEvents.push({ event: 'auto_heal', message: `自动使用补蓝药水，MP: ${curPlayer.mp}/${maxMp}`, player_hp: curPlayer.hp, player_max_hp: maxHp, player_mp: curPlayer.mp, player_max_mp: maxMp });
            }
          } catch { logger.warn('Boss 自动补蓝失败', { uid }); }
        }
        return { attacker: curPlayer, attackerHp: curPlayer.hp, roundEvents };
      } : undefined,
      getAttackerSkills: () => this.skillService.getEquippedSkills(uid),
      consumeAttackerMp: async (attacker, amount) => {
        await this.playerService.update(attacker.id, { mp: (attacker.mp ?? 0) - amount });
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

  private async settle(uid: Uid, result: BossResult): Promise<void> {
    const boostService = new BoostService();
    const boostConfig = await boostService.getBoostConfig(uid);
    const mult = BoostService.calcMultipliers(boostConfig);

    const players = await this.playerService.list(uid);
    const vipMult = (players.length && isVipActive(players[0])) ? 2 : 1;

    let finalExp = result.exp * mult.exp * vipMult;
    let finalGold = result.gold * mult.gold * vipMult;
    const [wealthBonus, expBonus] = await Promise.all([
      this.wealthTitleService.getGoldBonus(uid),
      this.levelTitleService.getExpBonus(uid),
    ]);
    finalExp = Math.floor(finalExp * expBonus);
    finalGold = Math.floor(finalGold * wealthBonus);
    const finalRep = result.reputation * mult.reputation * vipMult;

    try {
      await this.playerService.addExp(uid, finalExp);
      await this.playerService.addGold(uid, finalGold);
      await this.playerService.addReputation(uid, finalRep);
      await boostService.consumeCharges(uid);
    } catch { logger.warn('Boss 结算失败', { uid }); }

    this.pushEvent(uid, 'battle_reward', '战斗奖励结算', {
      exp: finalExp, gold: finalGold, reputation: finalRep,
      items: result.items || [],
    });

    try {
      const [pList, bagPayload] = await Promise.all([
        this.playerService.list(uid),
        this.bagService.getListPayload(uid),
      ]);
      if (pList.length) wsManager.sendToUser(uid, { type: 'player', data: pList[0] });
      wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
    } catch { logger.warn('Boss 推送 player/bag 失败', { uid }); }
  }

  private async processDrop(uid: Uid, boss: any, dropMultiplier: number = 1): Promise<any[]> {
    let dropList = boss?.drops;
    if (!dropList?.length) {
      dropList = await dataStorageService.list('boss_drop', { boss_id: boss.id });
      if (!dropList?.length) dropList = await dataStorageService.list('monster_drop', { monster_id: boss.id });
      const items = await dataStorageService.list('item', undefined);
      const itemMap = new Map(items.map((i: any) => [i.id, i]));
      dropList = dropList.map((d: any) => ({
        item_id: d.item_id,
        item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
        quantity: d.quantity ?? 1,
        probability: d.probability ?? 0,
      }));
    }
    const result: any[] = [];
    for (const d of dropList) {
      const prob = Number(d.probability ?? 0) || 0;
      if (prob <= 0) continue;
      const effectiveProb = prob * dropMultiplier;
      let times = Math.floor(effectiveProb / 100);
      const remain = effectiveProb % 100;
      if (remain > 0 && Math.random() * 100 < remain) times++;
      if (times <= 0) continue;
      const itemId = Number(d.item_id);
      const qty = Math.max(1, Number(d.quantity) || 1) * times;
      if (!itemId) continue;
      const itemInfo = await dataStorageService.getByCondition('item', { id: itemId }, undefined);
      const itemType = itemInfo?.type ?? 2;
      if (itemType === 2) {
        for (let i = 0; i < qty; i++) {
          const canAdd = await this.bagService.canAddEquipment(uid);
          if (!canAdd) continue;
          const equipId = await this.equipInstanceService.createFromDrop(uid, itemId);
          if (equipId) {
            try {
              await this.bagService.addEquipInstanceToBag(uid, itemId, String(equipId));
              result.push({ item_id: itemId, name: itemInfo?.name || `物品${itemId}`, count: 1, equipment_uid: String(equipId) });
            } catch {
              await this.equipInstanceService.deleteInstance(equipId);
            }
          }
        }
      } else {
        await this.bagService.addItem(uid, itemId, qty);
        result.push({ item_id: itemId, name: itemInfo?.name || `物品${itemId}`, count: qty });
      }
    }
    return result;
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

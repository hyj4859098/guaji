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
import { calculateHit, calcPhysicalDamage, calcMagicDamage, calcElementBonus } from '../battle/core';

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
    let player = { ...rawPlayer };
    const bossCopy = { ...boss };

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

    let playerHP = player.hp;
    const maxHp = player.max_hp || player.hp;
    const maxMp = player.max_mp || player.mp;

    const state = await this.getBossState(boss.id);
    let bossHP = state?.current_hp ?? boss.hp;

    this.pushEvent(uid, 'battle_start', `战斗开始！对阵${bossCopy.name}`, {
      player_hp: playerHP, player_max_hp: maxHp,
      monster_hp: bossHP, monster_max_hp: boss.hp,
    });

    let round = 1;
    let iGotKill = false;

    while (playerHP > 0 && round <= MAX_ROUNDS) {
      const key = toKey(uid);
      if (bossBattleState.get(key)?.stopRequested) {
        this.pushEvent(uid, 'battle_end', '战斗已手动停止', { result: 'stopped' });
        return this.loseResult();
      }

      const roundEvents: any[] = [];
      const add = (ev: string, msg: string, d?: any) => roundEvents.push({ event: ev, message: msg, ...d });

      if (autoHeal) {
        const hpPct = maxHp > 0 ? (playerHP / maxHp) * 100 : 100;
        const mpPct = maxMp > 0 ? (player.mp / maxMp) * 100 : 100;
        if (autoHeal.hp_enabled && autoHeal.hp_potion_bag_id && hpPct < (autoHeal.hp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.hp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              player = pList[0];
              playerHP = player.hp;
              add('auto_heal', `自动使用补血药水，HP: ${playerHP}/${maxHp}`, {
                player_hp: playerHP, player_max_hp: maxHp, player_mp: player.mp, player_max_mp: maxMp,
              });
            }
          } catch { logger.warn('Boss 自动补血失败', { uid }); }
        }
        if (autoHeal.mp_enabled && autoHeal.mp_potion_bag_id && mpPct < (autoHeal.mp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.mp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              player = pList[0];
              playerHP = player.hp;
              add('auto_heal', `自动使用补蓝药水，MP: ${player.mp}/${maxMp}`, {
                player_hp: playerHP, player_max_hp: maxHp, player_mp: player.mp, player_max_mp: maxMp,
              });
            }
          } catch { logger.warn('Boss 自动补蓝失败', { uid }); }
        }
      }

      add('round_start', `回合 ${round}`);

      const pElemMul = 1 + calcElementBonus(player, bossCopy) / 100;
      const mElemMul = 1 + calcElementBonus(bossCopy, player) / 100;

      // 技能
      const skills = await this.skillService.getEquippedSkills(uid);
      const vipBonus = isVipActive(rawPlayer) ? 20 : 0;
      const skillDmgMul = player.skill_dmg_pct ? (1 + player.skill_dmg_pct / 100) : 1;

      let totalDamage = 0;

      if (skills.physical?.length) {
        const s = skills.physical[0];
        const prob = s.probability + (player.phy_skill_prob || 0) + vipBonus;
        if (Math.random() * 100 < prob && player.mp >= s.cost) {
          const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
          totalDamage += dmg;
          player.mp -= s.cost;
          await this.playerService.update(player.id, { mp: player.mp });
          add('player_skill_attack', `你使用了 ${s.name} ${bossCopy.name} 掉血 ${dmg}`, {
            damage: dmg, player_hp: playerHP, player_max_hp: maxHp,
            monster_hp: bossHP - totalDamage, monster_max_hp: boss.hp,
          });
        }
      }
      if (skills.magic?.length) {
        const s = skills.magic[0];
        const prob = s.probability + (player.mag_skill_prob || 0) + vipBonus;
        if (Math.random() * 100 < prob && player.mp >= s.cost) {
          const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
          totalDamage += dmg;
          player.mp -= s.cost;
          await this.playerService.update(player.id, { mp: player.mp });
          add('player_skill_attack', `你使用了 ${s.name} ${bossCopy.name} 掉血 ${dmg}`, {
            damage: dmg, player_hp: playerHP, player_max_hp: maxHp,
            monster_hp: bossHP - totalDamage, monster_max_hp: boss.hp,
          });
        }
      }

      const pPhyHit = calculateHit(player, bossCopy);
      const pPhyR = pPhyHit ? calcPhysicalDamage(player, bossCopy) : { damage: 0, isCrit: false };
      totalDamage += Math.floor(pPhyR.damage * pElemMul);
      const pMagHit = calculateHit(player, bossCopy);
      const pMagR = pMagHit ? calcMagicDamage(player, bossCopy) : { damage: 0, isCrit: false };
      totalDamage += Math.floor(pMagR.damage * pElemMul);

      const pPhy = { damage: Math.floor(pPhyR.damage * pElemMul), isCrit: pPhyR.isCrit };
      const pMag = { damage: Math.floor(pMagR.damage * pElemMul), isCrit: pMagR.isCrit };

      const bPhyHit = calculateHit(bossCopy, player);
      const bPhyR = bPhyHit ? calcPhysicalDamage(bossCopy, player) : { damage: 0, isCrit: false };
      const bPhy = { damage: Math.floor(bPhyR.damage * mElemMul), isCrit: bPhyR.isCrit };
      const bMagHit = calculateHit(bossCopy, player);
      const bMagR = bMagHit ? calcMagicDamage(bossCopy, player) : { damage: 0, isCrit: false };
      const bMag = { damage: Math.floor(bMagR.damage * mElemMul), isCrit: bMagR.isCrit };

      const newPlayerHP = Math.max(0, playerHP - bPhy.damage - bMag.damage);

      const damageResult = totalDamage > 0 ? await this.atomicDamageBoss(boss.id, totalDamage) : null;

      if (damageResult === null) {
        add('battle_lose', 'Boss 已被其他玩家击杀');
        this.pushBatch(uid, roundEvents);
        return this.loseResult();
      }

      bossHP = damageResult.newHp;
      iGotKill = damageResult.isKill;

      const ct = (c: boolean) => c ? '【暴击】' : '';
      add('player_phy_attack', pPhyHit
        ? `你使用了 物理攻击${ct(pPhy.isCrit)} Boss 掉血 ${pPhy.damage}`
        : `你使用了 物理攻击 Boss 掉血 未命中`, {
        damage: pPhy.damage, player_hp: newPlayerHP, player_max_hp: maxHp,
        monster_hp: bossHP, monster_max_hp: boss.hp,
      });
      add('player_mag_attack', pMagHit
        ? `你使用了 魔法攻击${ct(pMag.isCrit)} Boss 掉血 ${pMag.damage}`
        : `你使用了 魔法攻击 Boss 掉血 未命中`, {
        damage: pMag.damage, player_hp: newPlayerHP, player_max_hp: maxHp,
        monster_hp: bossHP, monster_max_hp: boss.hp,
      });
      add('monster_phy_attack', bPhyHit
        ? `${bossCopy.name} 使用了 物理攻击${ct(bPhy.isCrit)} 你 掉血 ${bPhy.damage}`
        : `${bossCopy.name} 使用了 物理攻击 你 掉血 未命中`, {
        damage: bPhy.damage, player_hp: newPlayerHP, player_max_hp: maxHp,
        monster_hp: bossHP, monster_max_hp: boss.hp,
      });
      add('monster_mag_attack', bMagHit
        ? `${bossCopy.name} 使用了 魔法攻击${ct(bMag.isCrit)} 你 掉血 ${bMag.damage}`
        : `${bossCopy.name} 使用了 魔法攻击 你 掉血 未命中`, {
        damage: bMag.damage, player_hp: newPlayerHP, player_max_hp: maxHp,
        monster_hp: bossHP, monster_max_hp: boss.hp,
      });

      this.pushBatch(uid, roundEvents);
      await this.delay(800);

      playerHP = newPlayerHP;

      if (playerHP <= 0) {
        this.pushEvent(uid, 'battle_lose', '战斗失败');
        return this.loseResult();
      }

      if (iGotKill) {
        this.scheduleBossRespawn(bossCopy.id, bossCopy.map_id || 1, bossCopy.name || '未知Boss', bossCopy.hp || 0);
        this.pushEvent(uid, 'battle_win', `战斗胜利！击败了${bossCopy.name}`);
        const boostSvc = new BoostService();
        const bCfg = await boostSvc.getBoostConfig(uid);
        const dropMult = BoostService.calcMultipliers(bCfg).drop;
        const pList = await this.playerService.list(uid);
        const vipDropMult = (pList.length && isVipActive(pList[0])) ? 2 : 1;
        const items = await this.processDrop(uid, bossCopy, dropMult * vipDropMult);
        await this.settle(uid, {
          result: BattleResultEnum.WIN,
          rounds: round,
          exp: boss.exp || 0,
          gold: boss.gold || 0,
          reputation: boss.reputation || 0,
          items,
          logs: [],
        });
        return {
          result: BattleResultEnum.WIN,
          rounds: round,
          exp: boss.exp || 0,
          gold: boss.gold || 0,
          reputation: boss.reputation || 0,
          items,
          logs: [],
        };
      }

      round++;
    }

    this.pushEvent(uid, 'battle_draw', `战斗超过${MAX_ROUNDS}回合，回合耗尽`);
    return this.loseResult();
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
      const [pList, bags] = await Promise.all([
        this.playerService.list(uid),
        this.bagService.list(uid),
      ]);
      if (pList.length) wsManager.sendToUser(uid, { type: 'player', data: pList[0] });
      wsManager.sendToUser(uid, { type: 'bag', data: bags });
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
          const equipId = await this.equipInstanceService.createFromDrop(uid, itemId);
          if (equipId) {
            await this.bagService.addEquipInstanceToBag(uid, itemId, String(equipId));
            result.push({ item_id: itemId, name: itemInfo?.name || `物品${itemId}`, count: 1, equipment_uid: String(equipId) });
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

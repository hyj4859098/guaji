/**
 * 离线战斗模拟引擎
 *
 * 复用 battle/core.ts 的命中/伤害公式，纯内存运算：
 * - 无 WebSocket 推送
 * - 无 delay 等待
 * - 一次加载数据 → 内存循环 → 批量写回 DB
 */
import { calculateHit, calcPhysicalDamage, calcMagicDamage } from '../battle/core';
import { PlayerService } from './player.service';
import { MonsterService } from './monster.service';
import { SkillService } from './skill.service';
import { BagService } from './bag.service';
import { EquipInstanceService } from './equip_instance.service';
import { LevelExpService } from './level_exp.service';
import { Collections } from '../config/collections';
import { dataStorageService } from './data-storage.service';
import { isEquipment, getHpRestore, getMpRestore } from '../utils/item-type';
import { logger } from '../utils/logger';
import { Uid } from '../types/index';
import { AutoBattleConfig, isVipActive, BoostConfig, getDefaultBoostConfig } from '../types/player';
import { BoostService } from './boost.service';
import { WealthTitleService } from './wealth-title.service';
import { LevelTitleService } from './level-title.service';
import { applyBattleBonuses } from '../utils/combat-bonus';
import { writeDropToDb } from '../utils/drop-handler';

interface PotionInfo {
  count: number;
  originalCount: number;
  hp_restore: number;
  mp_restore: number;
}

interface SimState {
  hp: number;
  mp: number;
  max_hp: number;
  max_mp: number;
  level: number;
  exp: number;
  phy_atk: number;
  mag_atk: number;
  phy_def: number;
  mag_def: number;
  hit_rate: number;
  dodge_rate: number;
  crit_rate: number;
  gold: number;
  reputation: number;

  potions: Map<number, PotionInfo>;
  pendingDrops: Map<number, { count: number; isEquip: boolean }>;
  boostConfig: BoostConfig;
  vipExpireTime: number;

  totalBattles: number;
  wins: number;
  totalExp: number;
  totalGold: number;
  totalReputation: number;
  potionsUsed: { hp: number; mp: number };
  elapsedSeconds: number;
  died: boolean;
}

const SECONDS_PER_ROUND = 3;
const GAP_BETWEEN_BATTLES = 2;
const MAX_ROUNDS = 100;

export class OfflineBattleService {
  private playerService = new PlayerService();
  private monsterService = new MonsterService();
  private skillService = new SkillService();
  private bagService = new BagService();
  private equipInstanceService = new EquipInstanceService();
  private levelExpService = new LevelExpService();
  private wealthTitleService = new WealthTitleService();
  private levelTitleService = new LevelTitleService();

  async simulate(uid: Uid, config: AutoBattleConfig): Promise<{ totalBattles: number; died: boolean }> {
    const now = Math.floor(Date.now() / 1000);

    const players = await this.playerService.list(uid);
    if (!players.length) return { totalBattles: 0, died: false };
    const player = players[0];

    if (!isVipActive(player)) return { totalBattles: 0, died: false };

    const vipEnd = player.vip_expire_time && player.vip_expire_time > 0
      ? Math.min(now, player.vip_expire_time)
      : now;
    const maxSeconds = vipEnd - config.last_battle_time;
    if (maxSeconds <= 0) return { totalBattles: 0, died: false };

    const monster = await this.monsterService.get(config.enemy_id);
    if (!monster) return { totalBattles: 0, died: false };

    const skills = await this.skillService.getEquippedSkills(uid);
    const bags = await this.bagService.list(uid);
    const levelExpList = await this.levelExpService.list();
    const levelExpMap = new Map(levelExpList.map(le => [le.level, le.exp]));
    const allItems = await dataStorageService.list(Collections.ITEM, undefined);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));

    const buffed = applyBattleBonuses(player);

    const state: SimState = {
      hp: buffed.hp, mp: buffed.mp,
      max_hp: buffed.max_hp, max_mp: buffed.max_mp,
      level: buffed.level, exp: buffed.exp,
      phy_atk: buffed.phy_atk, mag_atk: buffed.mag_atk,
      phy_def: buffed.phy_def, mag_def: buffed.mag_def,
      hit_rate: player.hit_rate, dodge_rate: player.dodge_rate,
      crit_rate: player.crit_rate,
      gold: player.gold, reputation: player.reputation || 0,
      potions: new Map(),
      pendingDrops: new Map(),
      boostConfig: player.boost_config || getDefaultBoostConfig(),
      vipExpireTime: player.vip_expire_time || 0,
      totalBattles: 0, wins: 0,
      totalExp: 0, totalGold: 0, totalReputation: 0,
      potionsUsed: { hp: 0, mp: 0 },
      elapsedSeconds: 0, died: false,
    };

    for (const bag of bags) {
      const itemDef = itemMap.get(bag.item_id);
      const hpR = getHpRestore(itemDef);
      const mpR = getMpRestore(itemDef);
      if ((hpR > 0 || mpR > 0) && !bag.equipment_uid) {
        const existing = state.potions.get(bag.item_id);
        const cnt = bag.count || 1;
        if (existing) {
          existing.count += cnt;
          existing.originalCount += cnt;
        } else {
          state.potions.set(bag.item_id, {
            count: cnt, originalCount: cnt,
            hp_restore: hpR, mp_restore: mpR,
          });
        }
      }
    }

    const [wealthBonus, expBonus] = await Promise.all([
      this.wealthTitleService.getGoldBonus(uid),
      this.levelTitleService.getExpBonus(uid),
    ]);

    let batchCounter = 0;
    while (state.elapsedSeconds < maxSeconds) {
      const result = this.simulateOneBattle(state, monster, skills, config.auto_heal);
      state.elapsedSeconds += result.rounds * SECONDS_PER_ROUND + GAP_BETWEEN_BATTLES;
      state.totalBattles++;

      if (result.win) {
        state.wins++;
        const mult = BoostService.calcMultipliersFromMemory(state.boostConfig);
        const simTime = config.last_battle_time + state.elapsedSeconds;
        const vipMult = (state.vipExpireTime > 0 && state.vipExpireTime > simTime) ? 2 : 1;
        this.processDrops(state, monster, itemMap, mult.drop * vipMult);
        const mExp = (monster.exp || 0) * mult.exp * vipMult * expBonus;
        const mGold = (monster.gold || 0) * mult.gold * vipMult;
        const mRep = (monster.reputation || 0) * mult.reputation * vipMult;
        state.totalExp += mExp;
        state.totalGold += mGold;
        state.totalReputation += mRep;
        state.exp += mExp;
        state.gold += mGold;
        state.reputation += mRep;
        BoostService.consumeChargesInMemory(state.boostConfig);
        this.checkLevelUp(state, levelExpMap);
      } else {
        state.died = true;
        break;
      }

      batchCounter++;
      if (batchCounter >= 10000) {
        batchCounter = 0;
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    state.gold = Math.floor(state.gold * wealthBonus);
    state.totalGold = state.gold;

    await this.writeResults(uid, player, state);

    logger.info('离线战斗模拟完成', {
      uid, battles: state.totalBattles, wins: state.wins, died: state.died,
      exp: state.totalExp, gold: state.totalGold, seconds: state.elapsedSeconds,
    });

    return { totalBattles: state.totalBattles, died: state.died };
  }

  // ==================== 单场模拟 ====================

  private simulateOneBattle(
    state: SimState, monster: any, skills: any,
    healCfg: AutoBattleConfig['auto_heal']
  ): { win: boolean; rounds: number } {
    let mHP = monster.hp;
    let round = 0;

    while (state.hp > 0 && mHP > 0 && round < MAX_ROUNDS) {
      round++;
      if (healCfg) this.tryAutoHeal(state, healCfg);

      if (skills?.physical?.length) {
        const s = skills.physical[0];
        if (Math.random() * 100 < s.probability && state.mp >= s.cost) {
          state.mp -= s.cost;
          mHP = Math.max(0, mHP - s.damage);
        }
      }
      if (skills?.magic?.length) {
        const s = skills.magic[0];
        if (Math.random() * 100 < s.probability && state.mp >= s.cost) {
          state.mp -= s.cost;
          mHP = Math.max(0, mHP - s.damage);
        }
      }

      const pPhyHit = calculateHit(state, monster);
      const pPhy = pPhyHit ? calcPhysicalDamage(state, monster) : { damage: 0, isCrit: false };
      const pMagHit = calculateHit(state, monster);
      const pMag = pMagHit ? calcMagicDamage(state, monster) : { damage: 0, isCrit: false };
      const mPhyHit = calculateHit(monster, state);
      const mPhy = mPhyHit ? calcPhysicalDamage(monster, state) : { damage: 0, isCrit: false };
      const mMagHit = calculateHit(monster, state);
      const mMag = mMagHit ? calcMagicDamage(monster, state) : { damage: 0, isCrit: false };

      mHP = Math.max(0, mHP - pPhy.damage - pMag.damage);
      state.hp = Math.max(0, state.hp - mPhy.damage - mMag.damage);
    }

    if (state.hp > 0 && mHP <= 0) return { win: true, rounds: round };
    return { win: false, rounds: round };
  }

  // ==================== 自动喝药 ====================

  private tryAutoHeal(state: SimState, cfg: NonNullable<AutoBattleConfig['auto_heal']>) {
    if (cfg.hp_enabled && cfg.hp_item_id) {
      const pct = state.max_hp > 0 ? (state.hp / state.max_hp) * 100 : 100;
      if (pct < (cfg.hp_threshold || 50)) {
        const p = state.potions.get(cfg.hp_item_id);
        if (p && p.count > 0 && p.hp_restore > 0) {
          state.hp = Math.min(state.hp + p.hp_restore, state.max_hp);
          p.count--;
          state.potionsUsed.hp++;
        }
      }
    }
    if (cfg.mp_enabled && cfg.mp_item_id) {
      const pct = state.max_mp > 0 ? (state.mp / state.max_mp) * 100 : 100;
      if (pct < (cfg.mp_threshold || 50)) {
        const p = state.potions.get(cfg.mp_item_id);
        if (p && p.count > 0 && p.mp_restore > 0) {
          state.mp = Math.min(state.mp + p.mp_restore, state.max_mp);
          p.count--;
          state.potionsUsed.mp++;
        }
      }
    }
  }

  // ==================== 掉落累积 ====================

  private processDrops(state: SimState, monster: any, itemMap: Map<number, any>, dropMultiplier: number = 1) {
    const dropList = monster.drops || [];
    for (const d of dropList) {
      const baseProb = Number(d.probability ?? 0);
      if (baseProb <= 0) continue;
      const effectiveProb = baseProb * dropMultiplier;
      let dropTimes = Math.floor(effectiveProb / 100);
      const remainProb = effectiveProb % 100;
      if (remainProb > 0 && Math.random() * 100 < remainProb) dropTimes++;
      if (dropTimes <= 0) continue;
      const itemId = Number(d.item_id);
      const qty = Math.max(1, Number(d.quantity) || 1) * dropTimes;
      if (!itemId) continue;
      const itemInfo = itemMap.get(itemId);
      if (!itemInfo) continue; // 物品不存在或已删除，跳过
      const isEquip = isEquipment(itemInfo);

      const existing = state.pendingDrops.get(itemId);
      if (existing && !isEquip) {
        existing.count += qty;
      } else if (isEquip) {
        const key = itemId * 100000 + state.pendingDrops.size;
        state.pendingDrops.set(key, { count: qty, isEquip: true });
      } else {
        state.pendingDrops.set(itemId, { count: qty, isEquip: false });
      }
    }
  }

  // ==================== 升级检测 ====================

  private checkLevelUp(state: SimState, levelExpMap: Map<number, number>) {
    while (true) {
      const need = levelExpMap.get(state.level);
      if (!need || state.exp < need) break;
      state.exp -= need;
      state.level++;
    }
  }

  // ==================== 批量写回 DB ====================

  private async writeResults(uid: Uid, player: any, state: SimState) {
    await this.playerService.update(player.id, {
      hp: state.hp,
      mp: state.mp,
      exp: state.exp,
      level: state.level,
      gold: state.gold,
      reputation: state.reputation,
      boost_config: state.boostConfig,
      ...(state.died ? { auto_battle_config: null } : {}),
    } as any);

    for (const [key, drop] of state.pendingDrops) {
      const itemId = drop.isEquip ? Math.floor(key / 100000) : key;
      const itemInfo = drop.isEquip ? { type: 2 } : { type: 1 };
      await writeDropToDb(uid, itemId, drop.count, itemInfo, this.bagService, this.equipInstanceService);
    }

    for (const [itemId, potion] of state.potions) {
      const consumed = potion.originalCount - potion.count;
      if (consumed <= 0) continue;
      const rawBags = await dataStorageService.list(Collections.BAG, { uid, item_id: itemId });
      for (const bag of rawBags) {
        if (bag.equipment_uid) continue;
        const newCount = Math.max(0, (bag.count || 0) - consumed);
        if (newCount <= 0) {
          await dataStorageService.delete(Collections.BAG, bag.id);
        } else {
          await dataStorageService.update(Collections.BAG, bag.id, { count: newCount });
        }
        break;
      }
    }
  }
}

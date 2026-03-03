import { IUserBase } from './index';

export interface AutoBattleConfig {
  enemy_id: number;
  auto_heal: {
    hp_enabled: boolean;
    hp_item_id: number;
    hp_threshold: number;
    mp_enabled: boolean;
    mp_item_id: number;
    mp_threshold: number;
  } | null;
  last_battle_time: number;
}

export interface BoostSlot {
  charges: number;
  enabled: boolean;
}

export interface BoostCategory {
  x2: BoostSlot;
  x4: BoostSlot;
  x8: BoostSlot;
}

export interface BoostConfig {
  exp: BoostCategory;
  gold: BoostCategory;
  drop: BoostCategory;
  reputation: BoostCategory;
}

export const EMPTY_BOOST_SLOT: BoostSlot = { charges: 0, enabled: false };

export const EMPTY_BOOST_CATEGORY: BoostCategory = {
  x2: { ...EMPTY_BOOST_SLOT },
  x4: { ...EMPTY_BOOST_SLOT },
  x8: { ...EMPTY_BOOST_SLOT },
};

export function getDefaultBoostConfig(): BoostConfig {
  return {
    exp: { x2: { charges: 0, enabled: false }, x4: { charges: 0, enabled: false }, x8: { charges: 0, enabled: false } },
    gold: { x2: { charges: 0, enabled: false }, x4: { charges: 0, enabled: false }, x8: { charges: 0, enabled: false } },
    drop: { x2: { charges: 0, enabled: false }, x4: { charges: 0, enabled: false }, x8: { charges: 0, enabled: false } },
    reputation: { x2: { charges: 0, enabled: false }, x4: { charges: 0, enabled: false }, x8: { charges: 0, enabled: false } },
  };
}

export type BoostCategoryKey = 'exp' | 'gold' | 'drop' | 'reputation';
export type BoostMultiplierKey = 'x2' | 'x4' | 'x8';
export const BOOST_MULTIPLIER_VALUES: Record<BoostMultiplierKey, number> = { x2: 2, x4: 4, x8: 8 };

export interface Player extends IUserBase {
  name: string;
  level: number;
  exp: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  gold: number;
  phy_atk: number;
  mag_atk: number;
  phy_def: number;
  mag_def: number;
  hit_rate: number;
  dodge_rate: number;
  crit_rate: number;
  /** 物理技能释放概率加成（来自祝福/宝石等） */
  phy_skill_prob: number;
  /** 魔法技能释放概率加成 */
  mag_skill_prob: number;
  /** 全技能伤害%加成 */
  skill_dmg_pct: number;
  /** 物理防御%加成 */
  phy_def_pct: number;
  /** 魔法防御%加成 */
  mag_def_pct: number;
  /** 生命上限%加成 */
  max_hp_pct: number;
  /** 五行属性 */
  elem_metal: number;
  elem_wood: number;
  elem_water: number;
  elem_fire: number;
  elem_earth: number;
  reputation: number;
  vip_level?: number;
  vip_expire_time?: number;
  auto_battle_config?: AutoBattleConfig | null;
  boost_config?: BoostConfig | null;
}

export function isVipActive(player: Player): boolean {
  if (!player.vip_expire_time || player.vip_expire_time === 0) return false;
  return player.vip_expire_time > Math.floor(Date.now() / 1000);
}

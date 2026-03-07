/**
 * MongoDB 集合名常量。
 * 所有 dataStorageService 调用统一引用此处，避免硬编码字符串。
 */
export const Collections = {
  AUCTION: 'auction',
  AUCTION_RECORD: 'auction_record',
  BAG: 'bag',
  BOOST_CONFIG: 'boost_config',
  BOSS: 'boss',
  BOSS_DROP: 'boss_drop',
  BOSS_STATE: 'boss_state',
  CONFIG: 'config',
  EQUIP_BASE: 'equip_base',
  EQUIP_INSTANCE: 'equip_instance',
  ITEM: 'item',
  ITEM_EFFECT: 'item_effect',
  LEVEL_EXP: 'level_exp',
  MAP: 'map',
  MONSTER: 'monster',
  MONSTER_DROP: 'monster_drop',
  PLAYER: 'player',
  PLAYER_SKILL: 'player_skill',
  SHOP: 'shop',
  SKILL: 'skill',
  USER: 'user',
  USER_EQUIP: 'user_equip',
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];

import { z } from 'zod';

const positiveInt = z.coerce.number().int().min(1);
const nonNegativeInt = z.coerce.number().int().min(0);

// ── Battle ──
export const battleStartBody = z.object({
  enemy_id: positiveInt,
  auto_heal: z.any().optional(),
});

export const battleAutoBody = z.object({
  enemy_id: positiveInt,
  auto_heal: z.any().optional(),
});

// ── Shop ──
export const shopListQuery = z.object({
  type: z.enum(['gold', 'points', 'reputation']).default('gold'),
});

export const shopBuyBody = z.object({
  shop_item_id: positiveInt,
  count: z.coerce.number().int().min(1).max(9999),
});

// ── Map ──
const safeNameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5\s\-]+$/;
const safeName = z.string().min(1).max(32).regex(safeNameRegex, '仅支持中英文数字下划线');

export const mapGetQuery = z.object({
  id: positiveInt,
});

export const mapAddBody = z.object({
  name: safeName,
});

export const mapUpdateBody = z.object({
  id: positiveInt,
  name: safeName,
});

export const mapDeleteBody = z.object({
  id: positiveInt,
});

// ── Monster ──
export const monsterGetQuery = z.object({
  id: positiveInt,
});

export const monsterLevelQuery = z.object({
  min: nonNegativeInt,
  max: nonNegativeInt,
}).refine(d => d.max >= d.min, { message: '最大等级不能小于最小等级' });

export const monsterMapQuery = z.object({
  map_id: positiveInt,
});

// ── Player ──
export const playerGetQuery = z.object({
  id: positiveInt,
});

export const playerAddBody = z.object({
  name: safeName,
});

export const playerDeleteBody = z.object({
  id: positiveInt,
});

// ── Bag ──
export const bagUseBody = z.object({
  id: z.union([z.string().min(1), positiveInt]),
  count: z.coerce.number().int().min(1).max(9999).default(1),
});

export const bagDeleteBody = z.object({
  id: z.union([z.string().min(1), positiveInt]),
});

export const bagWearBody = z.object({
  id: z.union([z.string().min(1), positiveInt]),
});

// ── Equip ──
export const equipWearBody = z.object({
  id: z.union([z.string().min(1), positiveInt]),
});

export const equipRemoveBody = z.object({
  id: z.union([z.string().min(1), positiveInt]),
});

export const equipEnhanceBody = z.object({
  instance_id: positiveInt,
  use_lucky_charm: z.any().optional(),
  use_anti_explode: z.any().optional(),
});

export const equipBlessBody = z.object({
  instance_id: positiveInt,
});

export const equipTradeBody = z.object({
  instance_id: positiveInt,
  buyer_uid: positiveInt,
});

// ── Auction ──
export const auctionListQuery = z.object({
  type: z.coerce.number().int().optional(),
  keyword: z.string().max(50).optional(),
  pos: z.coerce.number().int().optional(),
  min_level: z.coerce.number().int().optional(),
  max_level: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
});

export const auctionListBody = z.object({
  bag_id: positiveInt,
  count: z.coerce.number().int().min(1).optional(),
  price: z.coerce.number().int().min(0),
});

export const auctionBuyBody = z.object({
  auction_id: positiveInt,
  count: z.coerce.number().int().min(1).max(9999),
});

export const auctionOffShelfBody = z.object({
  auction_id: positiveInt,
});

// ── Item ──
export const itemGetQuery = z.object({
  id: positiveInt,
});

export const itemUseBody = z.object({
  bagItemId: z.union([z.string().min(1), positiveInt]),
});

export const itemUsageQuery = z.object({
  itemId: positiveInt,
});

// ── User ──
const safeUsername = z.string().min(2).max(32).regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '仅支持字母数字中文下划线');

export const userLoginBody = z.object({
  username: safeUsername,
  password: z.string().min(6).max(128),
});

export const userRegisterBody = z.object({
  username: safeUsername,
  password: z.string().min(6).max(128),
});

// ── Boss ──
export const bossChallengeBody = z.object({
  boss_id: positiveInt,
  auto_heal: z.any().optional(),
});

// ── Skill ──
export const skillLearnBody = z.object({
  book_id: z.union([z.string().min(1), positiveInt]),
});

export const skillEquipBody = z.object({
  skill_id: positiveInt,
});

export const skillUnequipBody = z.object({
  skill_id: positiveInt,
});

// ── Admin User ──
export const adminUnbindIpBody = z.object({
  username: safeUsername,
});

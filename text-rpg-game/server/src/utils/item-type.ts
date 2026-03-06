/**
 * 物品类型映射（与 init-mongodb.js、GM 工具、前端 Helper 一致）
 * type 1 → consumable（消耗品）
 * type 2 → equipment（装备）
 * type 3 → material（材料）
 * type 4 → tool（道具）
 * type 5/6 → tool（多倍卡/VIP 卡）
 */
import type { Item } from '../types/item';

export type ItemTypeKey = 'consumable' | 'equipment' | 'material' | 'tool';

export enum ItemType {
  CONSUMABLE = 1,
  EQUIP = 2,
  MATERIAL = 3,
  TOOL = 4,
  BOOST = 5,
  VIP = 6,
}

type ItemLike = Partial<Item> | null | undefined;

export function getItemType(item: ItemLike): ItemTypeKey {
  const t = item?.type ?? 0;
  if (t === 1) return 'consumable';
  if (t === 2) return 'equipment';
  if (t === 3) return 'material';
  if (t === 4 || t === 5 || t === 6) return 'tool';
  return 'tool';
}

export function isEquipment(item: (ItemLike & { equipment_uid?: string | number }) | null | undefined): boolean {
  return (item?.type === 2 || !!item?.equipment_uid);
}

export function getHpRestore(item: ItemLike): number {
  return Number(item?.hp_restore ?? item?.hp) || 0;
}

export function getMpRestore(item: ItemLike): number {
  return Number(item?.mp_restore ?? item?.mp) || 0;
}

export function isBoostCard(item: ItemLike): boolean {
  return item?.type === 5;
}

export function isVipCard(item: ItemLike): boolean {
  return item?.type === 6;
}

export function isConsumable(item: ItemLike): boolean {
  return item?.type === 1;
}

export function isMaterial(item: ItemLike): boolean {
  return item?.type === 3;
}

export function isTool(item: ItemLike): boolean {
  const t = item?.type ?? 0;
  return t === 4 || t === 5 || t === 6;
}

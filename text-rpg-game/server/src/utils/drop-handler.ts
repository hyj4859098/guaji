/**
 * 掉落物品入库：装备 vs 非装备的统一处理
 * battle.service、boss.service、offline-battle.service 共用，避免重复实现。
 */
import { Uid } from '../types';
import type { Item } from '../types/item';
import { isEquipment } from './item-type';

export interface DropResult {
  item_id: number;
  name: string;
  count: number;
  equipment_uid?: string;
}

export interface DropBagService {
  canAddEquipment: (uid: Uid) => Promise<boolean>;
  addEquipInstanceToBag: (uid: Uid, itemId: number, equipUid: string) => Promise<void>;
  addItem: (uid: Uid, itemId: number, count: number) => Promise<void>;
}

export interface DropEquipService {
  createFromDrop: (uid: Uid, itemId: number) => Promise<number | null>;
  deleteInstance: (id: number) => Promise<boolean>;
}

export async function writeDropToDb(
  uid: Uid,
  itemId: number,
  qty: number,
  itemInfo: Partial<Item>,
  bagService: DropBagService,
  equipInstanceService: DropEquipService,
): Promise<DropResult[]> {
  const result: DropResult[] = [];
  const itemName = itemInfo?.name || `物品${itemId}`;

  if (isEquipment(itemInfo)) {
    for (let i = 0; i < qty; i++) {
      const canAdd = await bagService.canAddEquipment(uid);
      if (!canAdd) continue;
      const equipId = await equipInstanceService.createFromDrop(uid, itemId);
      if (equipId) {
        try {
          await bagService.addEquipInstanceToBag(uid, itemId, String(equipId));
          result.push({ item_id: itemId, name: itemName, count: 1, equipment_uid: String(equipId) });
        } catch {
          await equipInstanceService.deleteInstance(equipId);
        }
      }
    }
  } else {
    await bagService.addItem(uid, itemId, qty);
    result.push({ item_id: itemId, name: itemName, count: qty });
  }

  return result;
}

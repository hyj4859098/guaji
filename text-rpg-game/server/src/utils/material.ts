/**
 * 材料操作：查询数量、消耗材料
 * equip_upgrade.service 和 equip_blessing.service 共用，避免重复实现。
 */
import { dataStorageService } from '../service/data-storage.service';
import { Uid } from '../types';
import { Collections } from '../config/collections';

export async function getMaterialCount(uid: Uid, itemId: number): Promise<number> {
  const rows = await dataStorageService.list(Collections.BAG, { uid, item_id: itemId, equipment_uid: null });
  return rows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
}

export async function consumeMaterial(uid: Uid, itemId: number, count: number): Promise<boolean> {
  const total = await getMaterialCount(uid, itemId);
  if (total < count) return false;
  const rows = await dataStorageService.list(Collections.BAG, { uid, item_id: itemId, equipment_uid: null });
  let remain = count;
  for (const row of rows) {
    if (remain <= 0) break;
    const c = Math.min(remain, row.count || 0);
    if (c <= 0) continue;
    if (row.count === c) {
      await dataStorageService.delete(Collections.BAG, row.id);
    } else {
      await dataStorageService.update(Collections.BAG, row.id, { count: row.count - c });
    }
    remain -= c;
  }
  return remain <= 0;
}

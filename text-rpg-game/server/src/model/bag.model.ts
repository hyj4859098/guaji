import { dataStorageService } from '../service/data-storage.service';
import { Bag } from '../types/bag';
import { IBaseModel, Id, Uid } from '../types/index';

export class BagModel implements IBaseModel<Bag> {
  async get(id: Id, ctx?: any): Promise<Bag | null> {
    return await dataStorageService.getById('bag', id, ctx);
  }

  async listByUid(uid: Uid, ctx?: any): Promise<Bag[]> {
    return await dataStorageService.list('bag', { uid }, ctx);
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    const insertData = {
      ...data,
      count: data.count || 1,
      equipment_uid: data.equipment_uid || null
    };
    return await dataStorageService.insert('bag', insertData, ctx);
  }

  async addItem(uid: Uid, item_id: number, count: number, equipment_uid?: string, ctx?: any): Promise<void> {
    let existing;
    if (equipment_uid) {
      // 对于有equipment_uid的物品（装备），使用equipment_uid来查找
      existing = await dataStorageService.getByCondition('bag', { 
        uid, 
        item_id, 
        equipment_uid 
      }, ctx);
    } else {
      // 对于没有equipment_uid的物品，使用equipment_uid为null来查找
      existing = await dataStorageService.getByCondition('bag', { 
        uid, 
        item_id, 
        equipment_uid: null 
      }, ctx);
    }

    if (existing) {
      await this.update(existing.id, {
        count: existing.count + count
      }, ctx);
    } else {
      await this.insert({
        uid,
        item_id,
        count,
        equipment_uid: equipment_uid || null
      }, ctx);
    }
  }

  async removeItem(uid: Uid, item_id: number, count: number, ctx?: any): Promise<boolean> {
    const existing = await dataStorageService.getByCondition('bag', { 
      uid, 
      item_id, 
      equipment_uid: null 
    }, ctx);

    if (!existing) return false;

    if (existing.count < count) return false;

    if (existing.count === count) {
      return await this.delete(existing.id, ctx);
    } else {
      return await this.update(existing.id, {
        count: existing.count - count
      }, ctx);
    }
  }

  async update(id: Id, data: Partial<Bag>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('bag', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('bag', id, ctx);
  }

  async deleteByUid(uid: Uid, ctx?: any): Promise<void> {
    await dataStorageService.deleteMany('bag', { uid }, ctx);
  }
}

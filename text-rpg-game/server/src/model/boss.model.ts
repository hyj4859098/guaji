import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Boss } from '../types/boss';
import { IBaseModel, Id } from '../types/index';
import { Collections } from '../config/collections';

export class BossModel implements IBaseModel<Boss> {
  async get(id: Id, ctx?: any): Promise<Boss | null> {
    return await dataStorageService.getById(Collections.BOSS, id, ctx);
  }

  async list(_ctx?: any): Promise<Boss[]> {
    const collection = getCollection(Collections.BOSS);
    const result = await collection.find().sort({ level: 1 }).toArray();
    return result as unknown as Boss[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert(Collections.BOSS, data, ctx);
  }

  async update(id: Id, data: Partial<Boss>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.BOSS, id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.BOSS, id, ctx);
  }
}

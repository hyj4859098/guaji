import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Boss } from '../types/boss';
import { IBaseModel, Id } from '../types/index';

export class BossModel implements IBaseModel<Boss> {
  async get(id: Id, ctx?: any): Promise<Boss | null> {
    return await dataStorageService.getById('boss', id, ctx);
  }

  async list(ctx?: any): Promise<Boss[]> {
    const collection = getCollection('boss');
    const result = await collection.find().sort({ level: 1 }).toArray();
    return result as unknown as Boss[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert('boss', data, ctx);
  }

  async update(id: Id, data: Partial<Boss>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('boss', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('boss', id, ctx);
  }
}

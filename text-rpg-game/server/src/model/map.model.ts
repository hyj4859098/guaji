import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Map } from '../types/map';
import { IBaseModel, Id } from '../types/index';

export class MapModel implements IBaseModel<Map> {
  async get(id: Id, ctx?: any): Promise<Map | null> {
    return await dataStorageService.getById('map', id, ctx);
  }

  async list(ctx?: any): Promise<Map[]> {
    // MongoDB查询，按id字段升序排序
    const collection = getCollection('map');
    const result = await collection.find().sort({ id: 1 }).toArray();
    return result as unknown as Map[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert('map', data, ctx);
  }

  async update(id: Id, data: Partial<Map>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('map', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('map', id, ctx);
  }
}

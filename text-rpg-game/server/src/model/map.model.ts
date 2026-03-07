import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Map } from '../types/map';
import { IBaseModel, Id } from '../types/index';
import { Collections } from '../config/collections';

export class MapModel implements IBaseModel<Map> {
  async get(id: Id, ctx?: any): Promise<Map | null> {
    return await dataStorageService.getById(Collections.MAP, id, ctx);
  }

  async list(_ctx?: any): Promise<Map[]> {
    // MongoDB查询，按id字段升序排序
    const collection = getCollection(Collections.MAP);
    const result = await collection.find().sort({ id: 1 }).toArray();
    return result as unknown as Map[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert(Collections.MAP, data, ctx);
  }

  async update(id: Id, data: Partial<Map>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.MAP, id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.MAP, id, ctx);
  }
}

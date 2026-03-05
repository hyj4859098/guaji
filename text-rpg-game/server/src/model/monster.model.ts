import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Monster } from '../types/monster';
import { IBaseModel, Id } from '../types/index';

export class MonsterModel implements IBaseModel<Monster> {
  async get(id: Id, ctx?: any): Promise<Monster | null> {
    return await dataStorageService.getById('monster', id, ctx);
  }

  async list(_ctx?: any): Promise<Monster[]> {
    // MongoDB查询，按level字段升序排序
    const collection = getCollection('monster');
    const result = await collection.find().sort({ level: 1 }).toArray();
    return result as unknown as Monster[];
  }

  async listByLevel(minLevel: number, maxLevel: number, _ctx?: any): Promise<Monster[]> {
    // MongoDB查询，按level字段范围查询并升序排序
    const collection = getCollection('monster');
    const result = await collection.find({ level: { $gte: minLevel, $lte: maxLevel } }).sort({ level: 1 }).toArray();
    return result as unknown as Monster[];
  }

  async listByMapId(mapId: number, _ctx?: any): Promise<Monster[]> {
    // MongoDB查询，按map_id字段查询并按level升序排序
    const collection = getCollection('monster');
    const result = await collection.find({ map_id: mapId }).sort({ level: 1 }).toArray();
    return result as unknown as Monster[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert('monster', data, ctx);
  }

  async update(id: Id, data: Partial<Monster>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('monster', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('monster', id, ctx);
  }
}

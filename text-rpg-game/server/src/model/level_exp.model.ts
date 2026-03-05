import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { LevelExp } from '../types/level_exp';
import { IBaseModel, Id } from '../types/index';

export class LevelExpModel implements IBaseModel<LevelExp> {
  async get(id: Id, ctx?: any): Promise<LevelExp | null> {
    return await dataStorageService.getById('level_exp', id, ctx);
  }

  async getByLevel(level: number, ctx?: any): Promise<LevelExp | null> {
    return await dataStorageService.getByCondition('level_exp', { level }, ctx);
  }

  async list(_ctx?: any): Promise<LevelExp[]> {
    // MongoDB查询，按level字段升序排序
    const collection = getCollection('level_exp');
    const result = await collection.find().sort({ level: 1 }).toArray();
    return result as unknown as LevelExp[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert('level_exp', data, ctx);
  }

  async update(id: Id, data: Partial<LevelExp>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('level_exp', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('level_exp', id, ctx);
  }
}
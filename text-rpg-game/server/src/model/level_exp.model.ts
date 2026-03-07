import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { LevelExp } from '../types/level_exp';
import { IBaseModel, Id } from '../types/index';
import { Collections } from '../config/collections';

export class LevelExpModel implements IBaseModel<LevelExp> {
  async get(id: Id, ctx?: any): Promise<LevelExp | null> {
    return await dataStorageService.getById(Collections.LEVEL_EXP, id, ctx);
  }

  async getByLevel(level: number, ctx?: any): Promise<LevelExp | null> {
    return await dataStorageService.getByCondition(Collections.LEVEL_EXP, { level }, ctx);
  }

  async list(_ctx?: any): Promise<LevelExp[]> {
    // MongoDB查询，按level字段升序排序
    const collection = getCollection(Collections.LEVEL_EXP);
    const result = await collection.find().sort({ level: 1 }).toArray();
    return result as unknown as LevelExp[];
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert(Collections.LEVEL_EXP, data, ctx);
  }

  async update(id: Id, data: Partial<LevelExp>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.LEVEL_EXP, id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.LEVEL_EXP, id, ctx);
  }
}
import { MonsterModel } from '../model/monster.model';
import { Monster } from '../types/monster';
import { IBaseService, Id } from '../types/index';
import { dataStorageService } from './data-storage.service';
import { cacheService } from './cache.service';

export class MonsterService implements IBaseService<Monster> {
  private model: MonsterModel;

  constructor() {
    this.model = new MonsterModel();
  }

  async get(id: Id): Promise<Monster | null> {
    const cached = cacheService.monster.get(id);
    if (cached) return cached;
    const monster = await this.model.get(id);
    if (!monster) return null;
    const drops = await dataStorageService.list('monster_drop', { monster_id: Number(id) });
    const items = await dataStorageService.list('item', undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const dropsWithName = drops.map((d: any) => ({
      item_id: d.item_id,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
      quantity: d.quantity ?? 1,
      probability: d.probability ?? 0
    }));
    const result = { ...monster, drops: dropsWithName } as Monster & { drops: any[] };
    cacheService.monster.set(id, result);
    return result;
  }

  async list(): Promise<Monster[]> {
    // 从数据库获取
    const monsters = await this.model.list();
    return monsters;
  }

  async listByLevel(minLevel: number, maxLevel: number): Promise<Monster[]> {
    // 从数据库获取
    const monsters = await this.model.listByLevel(minLevel, maxLevel);
    return monsters;
  }

  async listByMapId(mapId: number): Promise<Monster[]> {
    // 从数据库获取
    const monsters = await this.model.listByMapId(mapId);
    return monsters;
  }

  async add(data: Omit<Monster, 'id' | 'create_time' | 'update_time'>): Promise<Id> {
    const id = await this.model.insert(data);
    return id;
  }

  async update(id: Id, data: Partial<Monster>): Promise<boolean> {
    const success = await this.model.update(id, data);
    if (success) cacheService.monster.invalidate(id);
    return success;
  }

  async delete(id: Id): Promise<boolean> {
    const success = await this.model.delete(id);
    if (success) cacheService.monster.invalidate(id);
    return success;
  }
}

import { LevelExpModel } from '../model/level_exp.model';
import { LevelExp } from '../types/level_exp';
import { IBaseService, Id } from '../types/index';

export class LevelExpService implements IBaseService<LevelExp> {
  private model: LevelExpModel;

  constructor() {
    this.model = new LevelExpModel();
  }

  async get(id: Id): Promise<LevelExp | null> {
    // 从数据库获取
    const levelExp = await this.model.get(id);
    return levelExp;
  }

  async list(): Promise<LevelExp[]> {
    // 从数据库获取
    const levelExps = await this.model.list();
    return levelExps;
  }

  async add(data: Omit<LevelExp, 'id' | 'create_time' | 'update_time'>): Promise<Id> {
    const id = await this.model.insert(data);
    return id;
  }

  async update(id: Id, data: Partial<LevelExp>): Promise<boolean> {
    const success = await this.model.update(id, data);
    return success;
  }

  async delete(id: Id): Promise<boolean> {
    const success = await this.model.delete(id);
    return success;
  }

  async getExpByLevel(level: number): Promise<LevelExp | null> {
    // 从数据库获取
    const levelExp = await this.model.getByLevel(level);
    return levelExp;
  }

  async getNextLevelExp(currentLevel: number): Promise<number> {
    const nextLevel = currentLevel + 1;
    const levelExp = await this.getExpByLevel(nextLevel);
    return levelExp ? levelExp.exp : 0;
  }
}
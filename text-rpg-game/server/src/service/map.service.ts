import { MapModel } from '../model/map.model';
import { Map } from '../types/map';
import { IBaseService, Id } from '../types/index';

export class MapService implements IBaseService<Map> {
  private model: MapModel;

  constructor() {
    this.model = new MapModel();
  }

  async get(id: Id): Promise<Map | null> {
    // 直接从数据库获取
    return await this.model.get(id);
  }

  async list(): Promise<Map[]> {
    // 直接从数据库获取
    return await this.model.list();
  }

  async add(data: Omit<Map, 'id' | 'create_time' | 'update_time'>): Promise<Id> {
    const id = await this.model.insert(data);
    return id;
  }

  async update(id: Id, data: Partial<Map>): Promise<boolean> {
    const success = await this.model.update(id, data);
    return success;
  }

  async delete(id: Id): Promise<boolean> {
    const success = await this.model.delete(id);
    return success;
  }
}

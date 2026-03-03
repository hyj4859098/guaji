import { dataStorageService } from '../service/data-storage.service';
import { EquipInstance } from '../types/equip_instance';
import { IBaseModel, Id, Uid } from '../types/index';

export class EquipInstanceModel implements IBaseModel<EquipInstance> {
  async get(id: Id, ctx?: any): Promise<EquipInstance | null> {
    return await dataStorageService.getById('equip_instance', id, ctx);
  }

  async listByUid(uid: Uid, ctx?: any): Promise<EquipInstance[]> {
    return await dataStorageService.list('equip_instance', { uid }, ctx);
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert('equip_instance', data, ctx);
  }

  async update(id: Id, data: Partial<EquipInstance>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('equip_instance', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('equip_instance', id, ctx);
  }
}

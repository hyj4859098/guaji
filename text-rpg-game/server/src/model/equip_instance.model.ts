import { dataStorageService } from '../service/data-storage.service';
import { EquipInstance } from '../types/equip_instance';
import { IBaseModel, Id, Uid } from '../types/index';
import { Collections } from '../config/collections';

export class EquipInstanceModel implements IBaseModel<EquipInstance> {
  async get(id: Id, ctx?: any): Promise<EquipInstance | null> {
    return await dataStorageService.getById(Collections.EQUIP_INSTANCE, id, ctx);
  }

  async listByUid(uid: Uid, ctx?: any): Promise<EquipInstance[]> {
    return await dataStorageService.list(Collections.EQUIP_INSTANCE, { uid }, ctx);
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert(Collections.EQUIP_INSTANCE, data, ctx);
  }

  async update(id: Id, data: Partial<EquipInstance>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.EQUIP_INSTANCE, id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.EQUIP_INSTANCE, id, ctx);
  }
}

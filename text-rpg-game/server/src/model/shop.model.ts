import { dataStorageService, TxCtx } from '../service/data-storage.service';
import { Shop } from '../types/shop';
import { IBaseModel, Id } from '../types/index';
import { Collections } from '../config/collections';

export class ShopModel implements IBaseModel<Shop> {
  async get(id: Id, ctx?: TxCtx): Promise<Shop | null> {
    return await dataStorageService.getById<Shop>(Collections.SHOP, id, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<Shop[]> {
    return await dataStorageService.list<Shop>(Collections.SHOP, filter, ctx);
  }

  async insert(data: Partial<Omit<Shop, 'id' | 'create_time' | 'update_time'>> & Record<string, unknown>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert(Collections.SHOP, data, ctx);
  }

  async update(id: Id, data: Partial<Shop>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update(Collections.SHOP, id, data as Record<string, unknown>, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete(Collections.SHOP, id, ctx);
  }
}

export const shopModel = new ShopModel();

import { dataStorageService, TxCtx } from '../service/data-storage.service';
import { Shop } from '../types/shop';
import { IBaseModel, Id } from '../types/index';

export class ShopModel implements IBaseModel<Shop> {
  async get(id: Id, ctx?: TxCtx): Promise<Shop | null> {
    return await dataStorageService.getById<Shop>('shop', id, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<Shop[]> {
    return await dataStorageService.list<Shop>('shop', filter, ctx);
  }

  async insert(data: Partial<Omit<Shop, 'id' | 'create_time' | 'update_time'>> & Record<string, unknown>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert('shop', data, ctx);
  }

  async update(id: Id, data: Partial<Shop>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update('shop', id, data as Record<string, unknown>, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete('shop', id, ctx);
  }
}

export const shopModel = new ShopModel();

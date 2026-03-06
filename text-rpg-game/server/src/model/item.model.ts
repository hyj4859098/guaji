import { dataStorageService } from '../service/data-storage.service';
import type { TxCtx } from '../service/data-storage.service';
import type { Id } from '../types/index';

export class ItemModel {
  async getById(id: Id, ctx?: TxCtx): Promise<any | null> {
    return await dataStorageService.getById('item', id, ctx);
  }

  async getByIds(ids: number[], ctx?: TxCtx): Promise<any[]> {
    return await dataStorageService.getByIds('item', ids, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<any[]> {
    return await dataStorageService.list('item', filter, ctx);
  }

  async insert(data: Record<string, unknown>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert('item', data, ctx);
  }

  async update(id: Id, data: Record<string, unknown>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update('item', id, data, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete('item', id, ctx);
  }
}

export const itemModel = new ItemModel();

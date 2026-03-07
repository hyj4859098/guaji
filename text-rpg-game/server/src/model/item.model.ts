import { dataStorageService } from '../service/data-storage.service';
import type { TxCtx } from '../service/data-storage.service';
import type { Id } from '../types/index';
import { Collections } from '../config/collections';

export class ItemModel {
  async getById(id: Id, ctx?: TxCtx): Promise<any | null> {
    return await dataStorageService.getById(Collections.ITEM, id, ctx);
  }

  async getByIds(ids: number[], ctx?: TxCtx): Promise<any[]> {
    return await dataStorageService.getByIds(Collections.ITEM, ids, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<any[]> {
    return await dataStorageService.list(Collections.ITEM, filter, ctx);
  }

  async insert(data: Record<string, unknown>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert(Collections.ITEM, data, ctx);
  }

  async update(id: Id, data: Record<string, unknown>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update(Collections.ITEM, id, data, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete(Collections.ITEM, id, ctx);
  }
}

export const itemModel = new ItemModel();

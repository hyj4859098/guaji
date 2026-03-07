import { dataStorageService } from '../service/data-storage.service';
import type { TxCtx } from '../service/data-storage.service';
import type { Id } from '../types/index';
import type { User } from '../types/user';
import { Collections } from '../config/collections';

export type IUser = User;

export class UserModel {
  async getById(id: Id, ctx?: TxCtx): Promise<IUser | null> {
    return await dataStorageService.getById<any>(Collections.USER, id, ctx);
  }

  async getByUsername(username: string, ctx?: TxCtx): Promise<IUser | null> {
    return await dataStorageService.getByCondition<any>(Collections.USER, { username }, undefined, ctx);
  }

  async insert(data: Omit<IUser, 'id' | 'create_time' | 'update_time'>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert(Collections.USER, data as any, ctx);
  }

  async update(id: Id, data: Partial<IUser>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update(Collections.USER, id, data as any, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete(Collections.USER, id, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<IUser[]> {
    return await dataStorageService.list<any>(Collections.USER, filter, ctx);
  }
}

export const userModel = new UserModel();

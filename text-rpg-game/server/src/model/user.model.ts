import { dataStorageService } from '../service/data-storage.service';
import type { TxCtx } from '../service/data-storage.service';
import type { Id } from '../types/index';
import type { User } from '../types/user';

export type IUser = User;

export class UserModel {
  async getById(id: Id, ctx?: TxCtx): Promise<IUser | null> {
    return await dataStorageService.getById<any>('user', id, ctx);
  }

  async getByUsername(username: string, ctx?: TxCtx): Promise<IUser | null> {
    return await dataStorageService.getByCondition<any>('user', { username }, undefined, ctx);
  }

  async insert(data: Omit<IUser, 'id' | 'create_time' | 'update_time'>, ctx?: TxCtx): Promise<Id> {
    return await dataStorageService.insert('user', data as any, ctx);
  }

  async update(id: Id, data: Partial<IUser>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update('user', id, data as any, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete('user', id, ctx);
  }

  async list(filter?: Record<string, unknown>, ctx?: TxCtx): Promise<IUser[]> {
    return await dataStorageService.list<any>('user', filter, ctx);
  }
}

export const userModel = new UserModel();

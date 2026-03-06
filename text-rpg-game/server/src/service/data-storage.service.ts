/**
 * 数据存储服务 — 统一 CRUD 接口
 *
 * ctx 参数接受 MongoDB ClientSession，用于事务内操作。
 * 传入 session 时所有读写均在该事务上下文中执行。
 */
import { ClientSession, Document } from 'mongodb';
import { getCollection, insert, update, deleteOne, query as mongodbQuery, queryWithSort } from '../config/db';
import { logger } from '../utils/logger';
import type { Id } from '../types/index';

export type TxCtx = ClientSession | undefined;

export class DataStorageService {
  async query<T extends Document = Document>(collection: string, filter?: Record<string, unknown>, projection?: Record<string, unknown>, ctx?: TxCtx): Promise<T[]> {
    try {
      return await mongodbQuery<T>(collection, filter as Record<string, unknown>, projection, ctx);
    } catch (error) {
      logger.error('数据库查询失败', { error: error instanceof Error ? error.message : String(error), collection, filter });
      throw error;
    }
  }

  async insert(collection: string, data: Record<string, unknown>, ctx?: TxCtx): Promise<Id> {
    const now = Math.floor(Date.now() / 1000);
    const result = await insert(collection, { ...data, create_time: now, update_time: now }, ctx);
    return result.insertId;
  }

  async update(collection: string, id: Id, data: Record<string, unknown>, ctx?: TxCtx): Promise<boolean> {
    const result = await update(collection, { id }, { ...data, update_time: Math.floor(Date.now() / 1000) }, ctx);
    return result.affectedRows > 0;
  }

  async delete(collection: string, id: Id, ctx?: TxCtx): Promise<boolean> {
    const result = await deleteOne(collection, { id }, ctx);
    return result.affectedRows > 0;
  }

  async deleteMany(collection: string, filter: Record<string, unknown>, ctx?: TxCtx): Promise<number> {
    const collectionObj = getCollection(collection);
    const opts = ctx ? { session: ctx } : {};
    const result = await collectionObj.deleteMany(filter, opts);
    return result.deletedCount;
  }

  async getById<T extends Document = Document>(collection: string, id: Id, ctx?: TxCtx): Promise<T | null> {
    const result = await mongodbQuery<T>(collection, { id } as Record<string, unknown>, undefined, ctx);
    return result[0] || null;
  }

  async updateByFilter(collection: string, filter: Record<string, unknown>, data: Record<string, unknown>, ctx?: TxCtx): Promise<boolean> {
    const collectionObj = getCollection(collection);
    const opts = ctx ? { session: ctx } : {};
    const result = await collectionObj.updateOne(filter, { $set: { ...data, update_time: Math.floor(Date.now() / 1000) } }, opts);
    return (result.modifiedCount ?? 0) > 0;
  }

  async getByCondition<T extends Document = Document>(collection: string, condition: Record<string, unknown>, _projection?: unknown, ctx?: TxCtx): Promise<T | null> {
    const result = await mongodbQuery<T>(collection, condition as Record<string, unknown>, undefined, ctx);
    return result[0] || null;
  }

  async list<T extends Document = Document>(collection: string, condition?: Record<string, unknown>, ctx?: TxCtx): Promise<T[]> {
    return await mongodbQuery<T>(collection, condition, undefined, ctx);
  }

  async getByIds<T extends Document = Document>(collection: string, ids: (number | string)[], ctx?: TxCtx): Promise<T[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    return await mongodbQuery<T>(collection, { id: { $in: unique } } as Record<string, unknown>, undefined, ctx);
  }

  async listSorted<T extends Document = Document>(
    collection: string,
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    limit: number,
    skip = 0
  ): Promise<T[]> {
    return await queryWithSort(collection, filter, sort, limit, skip);
  }

  /** 带排序+分页查询并返回总数 */
  async listSortedWithCount<T extends Document = Document>(
    collection: string,
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    limit: number,
    skip = 0
  ): Promise<{ items: T[]; total: number }> {
    const collObj = getCollection(collection);
    const [items, total] = await Promise.all([
      collObj.find(filter).sort(sort).skip(skip).limit(limit).toArray() as unknown as Promise<T[]>,
      collObj.countDocuments(filter),
    ]);
    return { items, total };
  }

  async batchInsert(collection: string, dataList: Record<string, unknown>[], ctx?: TxCtx): Promise<unknown[]> {
    if (dataList.length === 0) return [];
    const now = Math.floor(Date.now() / 1000);
    const withTimestamps = dataList.map(d => ({ ...d, create_time: now, update_time: now }));
    const collectionObj = getCollection(collection);
    const opts = ctx ? { session: ctx } : {};
    const result = await collectionObj.insertMany(withTimestamps, opts);
    return Object.values(result.insertedIds);
  }
}

// 导出单例实例
export const dataStorageService = new DataStorageService();

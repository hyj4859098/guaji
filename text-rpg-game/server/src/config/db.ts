import { MongoClient, Db, Collection, Document, ClientSession } from 'mongodb';
import { config } from './index';
import { logger } from '../utils/logger';

let db: Db;
let _client: MongoClient | null = null;

export async function connect(): Promise<void> {
  _client = new MongoClient(config.mongodb.url);
  await _client.connect();
  db = _client.db(config.mongodb.database);
  logger.info('MongoDB connected successfully');
}

/** 关闭连接（集成测试 teardown 使用，避免句柄泄漏） */
export async function close(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    (db as any) = undefined;
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('MongoDB not connected');
  }
  return db;
}

export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDB().collection<T>(name);
}

 
export async function query<T extends Document = Document>(collectionName: string, filter?: any, projection?: Record<string, unknown>, session?: ClientSession): Promise<T[]> {
  const collection = getCollection<T>(collectionName);
  return await collection.find(filter || {}, { projection, session }).toArray() as T[];
}

 
export async function queryWithSort<T extends Document = Document>(
  collectionName: string,
  filter: any,
  sort: Record<string, 1 | -1>,
  limit: number,
  skip = 0
): Promise<T[]> {
  const collection = getCollection<T>(collectionName);
  return await collection.find(filter || {}).sort(sort).skip(skip).limit(limit).toArray() as T[];
}

export async function insert(collectionName: string, data: Record<string, unknown>, session?: ClientSession): Promise<{ insertId: number }> {
  const collection = getCollection(collectionName);
  const counterCollection = getCollection('counter');
  const opts = session ? { session } : {};

  let id: number;
  const customId = data.id != null && Number.isInteger(Number(data.id)) && Number(data.id) > 0 ? Number(data.id) : null;

  if (customId != null) {
    id = customId;
    await counterCollection.updateOne(
      { name: collectionName },
      { $max: { seq: id } },
      { upsert: true, ...opts }
    );
  } else {
    const counter = await counterCollection.findOneAndUpdate(
      { name: collectionName },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after', ...opts }
    );
    const doc = counter as { seq?: number } | null;
    id = doc && typeof doc.seq === 'number' ? doc.seq : 1;
  }

  const dataWithId = { ...data, id };
  await collection.insertOne(dataWithId, opts);
  return { insertId: id };
}

 
export async function update(collectionName: string, filter: any, updateData: Record<string, unknown>, session?: ClientSession): Promise<{ affectedRows: number }> {
  const collection = getCollection(collectionName);
  const opts = session ? { session } : {};
  const result = await collection.updateOne(filter, { $set: updateData }, opts);
  return { affectedRows: result.modifiedCount };
}

 
export async function deleteOne(collectionName: string, filter: any, session?: ClientSession): Promise<{ affectedRows: number }> {
  const collection = getCollection(collectionName);
  const opts = session ? { session } : {};
  const result = await collection.deleteOne(filter, opts);
  return { affectedRows: result.deletedCount };
}

 
export async function findOneAndUpdate<T extends Document = Document>(
  collectionName: string,
  filter: any,
  updateOp: any,
  options?: { returnDocument?: 'before' | 'after'; session?: ClientSession }
): Promise<T | null> {
  const collection = getCollection<T>(collectionName);
  const result = await collection.findOneAndUpdate(filter, updateOp, {
    returnDocument: options?.returnDocument ?? 'after',
    session: options?.session,
  });
  return (result as T | null) ?? null;
}

/**
 * 在 MongoDB 事务中执行操作（需要副本集）
 * 如果 MongoDB 不支持事务（如单节点），降级为无事务执行
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!_client) throw new Error('MongoDB not connected');
  const session = _client.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

/**
 * 尝试事务执行，副本集不可用时降级为直接执行
 */
export async function tryWithTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!_client) throw new Error('MongoDB not connected');
  try {
    return await withTransaction((session) => fn(session));
  } catch (e: any) {
    if (e?.codeName === 'IllegalOperation' || e?.message?.includes('transaction')) {
      return await fn(undefined);
    }
    throw e;
  }
}

/**
 * 获取指定集合的下一个自增 ID（用于为已有 _id 但无 id 的文档补全 id）
 */
export async function getNextId(collectionName: string): Promise<number> {
  const counterCollection = getCollection('counter');
  const counter = await counterCollection.findOneAndUpdate(
    { name: collectionName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const doc = counter as { seq?: number } | null;
  return doc && typeof doc.seq === 'number' ? doc.seq : 1;
}

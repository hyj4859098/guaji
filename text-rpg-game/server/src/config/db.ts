import { MongoClient, Db, Collection, Document } from 'mongodb';
import { config } from './index';

let db: Db;

export async function connect(): Promise<void> {
  const client = new MongoClient(config.mongodb.url);
  await client.connect();
  db = client.db(config.mongodb.database);
  console.log('MongoDB connected successfully');
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

// 提供类似MySQL的查询接口，方便迁移
export async function query(collectionName: string, filter?: any, projection?: any): Promise<any> {
  const collection = getCollection(collectionName);
  return await collection.find(filter || {}, { projection }).toArray();
}

export async function insert(collectionName: string, data: any): Promise<any> {
  const collection = getCollection(collectionName);
  const counterCollection = getCollection('counter');

  let id: number;
  const customId = data.id != null && Number.isInteger(Number(data.id)) && Number(data.id) > 0 ? Number(data.id) : null;

  if (customId != null) {
    id = customId;
    // 确保计数器不小于已用手动 ID，避免后续自动生成重复
    await counterCollection.updateOne(
      { name: collectionName },
      { $max: { seq: id } },
      { upsert: true }
    );
  } else {
    const counter = await counterCollection.findOneAndUpdate(
      { name: collectionName },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = counter as { seq?: number } | null;
    id = doc && typeof doc.seq === 'number' ? doc.seq : 1;
  }

  const dataWithId = { ...data, id };
  await collection.insertOne(dataWithId);
  return { insertId: id };
}

export async function update(collectionName: string, filter: any, update: any): Promise<any> {
  const collection = getCollection(collectionName);
  const result = await collection.updateOne(filter, { $set: update });
  return { affectedRows: result.modifiedCount };
}

export async function deleteOne(collectionName: string, filter: any): Promise<any> {
  const collection = getCollection(collectionName);
  const result = await collection.deleteOne(filter);
  return { affectedRows: result.deletedCount };
}

/**
 * 原子更新并返回文档（用于 Boss 共享血量扣减等）
 */
export async function findOneAndUpdate(
  collectionName: string,
  filter: any,
  update: any,
  options?: { returnDocument?: 'before' | 'after' }
): Promise<any | null> {
  const collection = getCollection(collectionName);
  const result = await collection.findOneAndUpdate(filter, update, {
    returnDocument: options?.returnDocument ?? 'after',
  });
  return result ?? null;
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

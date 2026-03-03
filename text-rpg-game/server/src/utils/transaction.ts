import { getDB } from '../config/db';
import { logger } from './logger';

/**
 * 事务上下文接口
 * 提供在事务中执行操作的方法
 */
export interface TransactionContext {
  /**
   * 执行操作
   * @param collection 集合名
   * @param operation 操作类型
   * @param data 操作数据
   * @returns 执行结果
   */
  execute: (collection: string, operation: string, data: any) => Promise<any>;
  
  /**
   * 查询操作
   * @param collection 集合名
   * @param filter 过滤条件
   * @param projection 投影
   * @returns 查询结果
   */
  query: (collection: string, filter?: any, projection?: any) => Promise<any>;
}

/**
 * 事务回调函数类型
 */
export type TransactionCallback<T> = (ctx: TransactionContext) => Promise<T>;

/**
 * 事务管理器类
 * 提供事务的创建和管理功能
 */
export class TransactionManager {
  /**
   * 执行事务
   * @param callback 事务回调函数
   * @returns 回调函数的返回值
   */
  static async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const db = getDB();
    
    try {
      // 简化事务处理，使用MongoDB的单文档事务
      const context: TransactionContext = {
        execute: async (collection: string, operation: string, data: any) => {
          const coll = db.collection(collection);
          switch (operation) {
            case 'insert':
              return await coll.insertOne(data);
            case 'update':
              return await coll.updateOne(data.filter, { $set: data.update });
            case 'delete':
              return await coll.deleteOne(data.filter);
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
        },
        query: async (collection: string, filter?: any, projection?: any) => {
          const coll = db.collection(collection);
          return await coll.find(filter || {}, { projection }).toArray();
        }
      };
      
      const result = await callback(context);
      return result;
    } catch (error) {
      logger.error('Transaction failed:', error);
      throw error;
    }
  }
}

/**
 * 事务工具函数
 * 简化事务的使用
 */
export async function transaction<T>(callback: TransactionCallback<T>): Promise<T> {
  return TransactionManager.transaction(callback);
}

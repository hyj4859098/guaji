/**
 * 数据存储服务
 * 封装数据库操作，提供统一的CRUD接口
 */
import { getCollection, insert, update, deleteOne, query as mongodbQuery } from '../config/db';
import { logger } from '../utils/logger';

interface Transaction {
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

export class DataStorageService {
  /**
   * 执行MongoDB查询
   * @param collection 集合名
   * @param filter 过滤条件
   * @param projection 投影
   * @returns 查询结果
   */
  async query(collection: string, filter?: any, projection?: any, ctx?: any): Promise<any> {
    try {
      const result = await mongodbQuery(collection, filter, projection);
      return result;
    } catch (error) {
      logger.error('数据库查询失败', { error: error instanceof Error ? error.message : String(error), collection, filter });
      throw error;
    }
  }

  /**
   * 开始事务
   * @returns 事务对象
   */
  async beginTransaction(): Promise<Transaction> {
    // MongoDB事务需要在副本集环境下使用
    // 这里简化处理，返回一个空事务对象
    return {
      async commit(): Promise<void> {
        // 无操作
      },
      async rollback(): Promise<void> {
        // 无操作
      }
    };
  }

  /**
   * 插入数据
   * @param collection 集合名
   * @param data 数据对象
   * @returns 插入的ID
   */
  async insert(collection: string, data: any, ctx?: any): Promise<any> {
    const now = Math.floor(Date.now() / 1000);
    const insertData = {
      ...data,
      create_time: now,
      update_time: now
    };

    const result = await insert(collection, insertData);
    return result.insertId;
  }

  /**
   * 更新数据
   * @param collection 集合名
   * @param id 记录ID
   * @param data 数据对象
   * @returns 是否更新成功
   */
  async update(collection: string, id: any, data: any, ctx?: any): Promise<boolean> {
    const updateData = {
      ...data,
      update_time: Math.floor(Date.now() / 1000)
    };

    const result = await update(collection, { id: id }, updateData);
    return result.affectedRows > 0;
  }

  /**
   * 删除数据
   * @param collection 集合名
   * @param id 记录ID
   * @returns 是否删除成功
   */
  async delete(collection: string, id: any, ctx?: any): Promise<boolean> {
    const result = await deleteOne(collection, { id: id });
    return result.affectedRows > 0;
  }

  /**
   * 批量删除数据
   * @param collection 集合名
   * @param filter 过滤条件
   * @returns 删除的记录数
   */
  async deleteMany(collection: string, filter: any, ctx?: any): Promise<number> {
    const collectionObj = getCollection(collection);
    const result = await collectionObj.deleteMany(filter);
    return result.deletedCount;
  }

  /**
   * 根据ID获取数据
   * @param collection 集合名
   * @param id 记录ID
   * @returns 数据对象或null
   */
  async getById(collection: string, id: any, ctx?: any): Promise<any | null> {
    const result = await mongodbQuery(collection, { id: id });
    return result[0] || null;
  }

  /**
   * 按条件更新数据（用于 _id 等非 id 字段）
   */
  async updateByFilter(collection: string, filter: any, data: any, ctx?: any): Promise<boolean> {
    const updateData = {
      ...data,
      update_time: Math.floor(Date.now() / 1000)
    };
    const collectionObj = getCollection(collection);
    const result = await collectionObj.updateOne(filter, { $set: updateData });
    return (result.modifiedCount ?? 0) > 0;
  }

  /**
   * 根据条件获取数据
   * @param collection 集合名
   * @param condition 条件对象
   * @returns 数据对象或null
   */
  async getByCondition(collection: string, condition: any, ctx?: any): Promise<any | null> {
    const result = await mongodbQuery(collection, condition);
    return result[0] || null;
  }

  /**
   * 获取列表数据
   * @param collection 集合名
   * @param condition 条件对象（可选）
   * @returns 数据列表
   */
  async list(collection: string, condition?: any, ctx?: any): Promise<any[]> {
    const result = await mongodbQuery(collection, condition);
    return result;
  }

  /**
   * 批量插入数据
   * @param collection 集合名
   * @param dataList 数据列表
   * @returns 插入的ID列表
   */
  async batchInsert(collection: string, dataList: any[], ctx?: any): Promise<any[]> {
    if (dataList.length === 0) return [];

    const now = Math.floor(Date.now() / 1000);
    const insertDataList = dataList.map(data => ({
      ...data,
      create_time: now,
      update_time: now
    }));

    const collectionObj = getCollection(collection);
    const result = await collectionObj.insertMany(insertDataList);
    
    // 生成插入的ID列表
    const ids: any[] = [];
    for (const id of Object.values(result.insertedIds)) {
      ids.push(id);
    }
    return ids;
  }
}

// 导出单例实例
export const dataStorageService = new DataStorageService();

/**
 * 物品管理服务
 * 统一管理物品属性、类型、使用逻辑
 */
import { dataStorageService } from './data-storage.service';
import { logger } from '../utils/logger';
import { Uid } from '../types';
import { query } from '../config/db';
import { createError, ErrorCode } from '../utils/error';

// 物品类型枚举
export enum ItemType {
  EQUIP = 1,      // 装备
  CONSUMABLE = 2,  // 消耗品
  MATERIAL = 3,    // 材料
  TOOL = 4         // 道具（包含技能书）
}

// 物品使用结果
export interface ItemUseResult {
  success: boolean;
  message: string;
  data?: any;
}

// 物品属性接口
export interface ItemAttributes {
  attack?: number;
  defense?: number;
  hp?: number;
  mp?: number;
  hitRate?: number;
  dodgeRate?: number;
  critRate?: number;
}

export class ItemService {
  constructor() {
  }

  /**
   * 根据ID获取物品
   * @param id 物品ID
   * @returns 物品信息
   */
  async getItemById(id: number) {
    // 直接从数据库获取
    return await dataStorageService.getById('item', id);
  }

  /**
   * 根据类型获取物品列表
   * @param type 物品类型
   * @returns 物品列表
   */
  async getItemsByType(type: number) {
    // 直接从数据库获取
    return await dataStorageService.list('item', { type });
  }

  /**
   * 获取所有物品
   * @returns 物品列表
   */
  async getAllItems() {
    return await dataStorageService.list('item');
  }

  /**
   * 新增物品（Admin）
   */
  async addItem(data: { id?: number; name: string; type: number; pos?: number; hp_restore?: number; mp_restore?: number; description?: string }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const insertData: any = {
      name: data.name,
      type: data.type,
      pos: data.pos ?? 0,
      hp_restore: data.hp_restore ?? 0,
      mp_restore: data.mp_restore ?? 0,
      description: data.description ?? '',
      create_time: now,
      update_time: now
    };
    if (data.id != null && Number.isInteger(data.id) && data.id > 0) {
      insertData.id = data.id;
    }
    return await dataStorageService.insert('item', insertData);
  }

  /**
   * 更新物品（Admin）
   */
  async updateItem(id: number, data: Partial<{ name: string; type: number; pos: number; hp_restore: number; mp_restore: number; description: string }>): Promise<boolean> {
    return await dataStorageService.update('item', id, {
      ...data,
      update_time: Math.floor(Date.now() / 1000)
    });
  }

  /**
   * 删除物品（Admin）
   */
  async deleteItem(id: number): Promise<boolean> {
    return await dataStorageService.delete('item', id);
  }

  /**
   * 计算物品属性
   * @param item 物品信息
   * @returns 物品属性
   */
  calculateItemAttributes(item: any): ItemAttributes {
    const attributes: ItemAttributes = {};

    // 根据物品类型和等级计算属性
    if (item.type === ItemType.EQUIP) {
      // 装备属性计算
      attributes.attack = item.attack || 0;
      attributes.defense = item.defense || 0;
      attributes.hp = item.hp || 0;
      attributes.mp = item.mp || 0;
      attributes.hitRate = item.hit_rate || 0;
      attributes.dodgeRate = item.dodge_rate || 0;
      attributes.critRate = item.crit_rate || 0;
    } else if (item.type === ItemType.CONSUMABLE) {
      // 消耗品属性计算
      attributes.hp = item.hp || 0;
      attributes.mp = item.mp || 0;
    }

    return attributes;
  }

  /**
   * 使用物品
   * @param uid 用户ID
   * @param bagItemId 背包物品ID
   * @returns 使用结果
   */
  async useItem(uid: Uid, bagItemId: number): Promise<ItemUseResult> {
    try {
      // 调用bag.service中的useItem方法
      const BagService = require('./bag.service').BagService;
      const bagService = new BagService();
      const success = await bagService.useItem(uid, bagItemId);
      
      if (success) {
        // 获取物品信息
        const bagItems = await bagService.list(uid);
        const bagItem = bagItems.find((item: any) => item.id === bagItemId || item.original_id === bagItemId);
        if (bagItem) {
          const item = await this.getItemById(bagItem.item_id);
          if (item) {
            return {
              success: true,
              message: `使用了${item.name}`
            };
          }
        }
        return {
          success: true,
          message: '物品使用成功'
        };
      } else {
        return {
          success: false,
          message: '物品使用失败'
        };
      }
    } catch (error) {
      logger.error('使用物品失败', { error, uid, bagItemId });
      return {
        success: false,
        message: error instanceof Error ? error.message : '使用物品失败'
      };
    }
  }

  /**
   * 获取物品使用说明
   * @param itemId 物品ID
   * @returns 使用说明
   */
  async getItemUsage(itemId: number): Promise<string> {
    const item = await this.getItemById(itemId);
    if (!item) {
      return '物品不存在';
    }

    switch (item.type) {
      case ItemType.EQUIP:
        return `装备到对应部位，增加属性`;
      case ItemType.CONSUMABLE:
        return `使用后${item.hp ? `恢复${item.hp}点HP` : ''}${item.mp ? `恢复${item.mp}点MP` : ''}`;
      case ItemType.MATERIAL:
        return `用于合成或任务`;
      case ItemType.TOOL:
        // 检查是否是技能书
        const skill = await dataStorageService.getByCondition('skill', { book_id: itemId });
        if (skill) {
          return `使用后学习对应技能`;
        }
        return `用于特定功能`;
      default:
        return `物品用途未知`;
    }
  }
}

// 导出单例实例
export const itemService = new ItemService();

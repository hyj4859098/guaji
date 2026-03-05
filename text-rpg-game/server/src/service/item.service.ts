/**
 * 物品管理服务
 * 统一管理物品属性、类型、使用逻辑
 */
import { dataStorageService } from './data-storage.service';
import { logger } from '../utils/logger';
import { Uid } from '../types';
import { getCollection } from '../config/db';
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
   * 分页获取物品（支持 type 筛选）
   */
  async listWithPagination(filter?: { type?: number }, page = 1, pageSize = 20): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    const coll = getCollection('item');
    const q: any = {};
    if (filter?.type != null && filter.type > 0) q.type = filter.type;
    const [data, total] = await Promise.all([
      coll.find(q).sort({ id: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      coll.countDocuments(q)
    ]);
    return { data, total, page, pageSize };
  }

  /**
   * 新增物品（Admin）
   * 若指定 id 且已存在，抛出错误避免重复
   */
  async addItem(data: { id?: number; name: string; type: number; pos?: number; hp_restore?: number; mp_restore?: number; vip_days?: number; description?: string }): Promise<number> {
    const customId = data.id != null && Number.isInteger(data.id) && data.id > 0 ? Number(data.id) : null;
    if (customId != null) {
      const existing = await dataStorageService.getByCondition('item', { id: customId });
      if (existing) {
        throw createError(ErrorCode.INVALID_PARAMS, `该 ID ${customId} 已被占用，请使用其他 ID 或留空自动生成`);
      }
    }
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
    if (data.vip_days != null) insertData.vip_days = Number(data.vip_days);
    if (customId != null) {
      insertData.id = customId;
    }
    return await dataStorageService.insert('item', insertData);
  }

  /**
   * 更新物品（Admin）
   */
  async updateItem(id: number, data: Partial<{ name: string; type: number; pos: number; hp_restore: number; mp_restore: number; vip_days: number; description: string }>): Promise<boolean> {
    const updateData: any = { ...data, update_time: Math.floor(Date.now() / 1000) };
    if (data?.vip_days != null) updateData.vip_days = Number(data.vip_days);
    return await dataStorageService.update('item', id, updateData);
  }

  /** 同步 equip_base（物品管理为唯一创建入口，upsert） */
  async syncEquipBase(itemId: number, opts: {
    pos: number;
    base_level?: number;
    base_hp?: number;
    base_mp?: number;
    base_phy_atk?: number;
    base_phy_def?: number;
    base_mag_atk?: number;
    base_mag_def?: number;
    base_hit_rate?: number;
    base_dodge_rate?: number;
    base_crit_rate?: number;
  }): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const data = {
      item_id: itemId,
      pos: opts.pos ?? 1,
      base_level: opts.base_level ?? 1,
      base_hp: opts.base_hp ?? 0,
      base_mp: opts.base_mp ?? 0,
      base_phy_atk: opts.base_phy_atk ?? 0,
      base_phy_def: opts.base_phy_def ?? 0,
      base_mag_atk: opts.base_mag_atk ?? 0,
      base_mag_def: opts.base_mag_def ?? 0,
      base_hit_rate: opts.base_hit_rate ?? 0,
      base_dodge_rate: opts.base_dodge_rate ?? 0,
      base_crit_rate: opts.base_crit_rate ?? 0,
      update_time: now
    };
    const existing = await dataStorageService.getByCondition('equip_base', { item_id: itemId });
    if (existing) {
      await dataStorageService.update('equip_base', existing.id, data);
    } else {
      await dataStorageService.insert('equip_base', { ...data, create_time: now });
    }
  }

  /**
   * 同步道具效果（唯一写入入口，物品保存时调用）
   * 根据物品类型和 effectOptions 决定 upsert 或删除
   */
  async syncItemEffect(
    itemId: number,
    itemType: number,
    effectOptions?: { effect_type?: string; attr?: string; value?: number; max?: number; also_add_current?: boolean }
  ): Promise<void> {
    const ADD_STAT_ATTRS = ['max_hp', 'max_mp', 'phy_atk', 'mag_atk', 'phy_def', 'mag_def'];
    let effectType: string | null = null;
    const effectData: any = { item_id: itemId };

    if (itemType === 1 || itemType === 3) {
      const item = await dataStorageService.getByCondition('item', { id: itemId });
      if (item && ((item.hp_restore ?? 0) > 0 || (item.mp_restore ?? 0) > 0)) {
        effectType = 'restore';
      }
    } else if (itemType === 5) {
      effectType = 'boost';
    } else if (itemType === 6) {
      effectType = 'vip';
    } else if (itemType === 4 && effectOptions?.effect_type) {
      effectType = effectOptions.effect_type;
      if (effectType === 'expand_bag') {
        effectData.value = effectOptions.value ?? 50;
        effectData.max = effectOptions.max ?? 500;
      } else if (effectType === 'add_stat') {
        effectData.attr = ADD_STAT_ATTRS.includes(effectOptions.attr || '') ? effectOptions.attr : 'max_hp';
        effectData.value = effectOptions.value ?? 1;
        effectData.also_add_current = !!effectOptions.also_add_current;
      }
    }

    const existing = await dataStorageService.getByCondition('item_effect', { item_id: itemId });
    if (effectType) {
      const payload = { ...effectData, effect_type: effectType };
      if (existing) {
        await dataStorageService.update('item_effect', existing.id, payload);
      } else {
        await dataStorageService.insert('item_effect', payload);
      }
    } else if (existing) {
      await dataStorageService.delete('item_effect', existing.id);
    }
  }

  /**
   * 获取物品详情（含 item_effect、equip_base、关联技能，供 GM 编辑表单回显）
   */
  async getItemWithEffect(id: number): Promise<any | null> {
    const item = await dataStorageService.getByCondition('item', { id });
    if (!item) return null;
    const eff = await dataStorageService.getByCondition('item_effect', { item_id: id });
    const result: any = { ...item, effect_type: eff?.effect_type || '', effect_attr: eff?.attr, effect_value: eff?.value, effect_max: eff?.max, effect_also_add_current: eff?.also_add_current };
    if (eff?.effect_type === 'learn_skill') {
      const skill = await dataStorageService.getByCondition('skill', { book_id: id });
      if (skill) {
        result.skill_name = skill.name;
        result.skill_type = skill.type;
        result.skill_damage = skill.damage;
        result.skill_cost = skill.cost;
        result.skill_probability = skill.probability;
      }
    }
    if ((item as any).type === 2) {
      const eb = await dataStorageService.getByCondition('equip_base', { item_id: id });
      if (eb) {
        result.base_level = eb.base_level;
        result.base_hp = eb.base_hp;
        result.base_mp = eb.base_mp;
        result.base_phy_atk = eb.base_phy_atk;
        result.base_phy_def = eb.base_phy_def;
        result.base_mag_atk = eb.base_mag_atk;
        result.base_mag_def = eb.base_mag_def;
        result.base_hit_rate = eb.base_hit_rate;
        result.base_dodge_rate = eb.base_dodge_rate;
        result.base_crit_rate = eb.base_crit_rate;
      }
    }
    return result;
  }

  /**
   * 删除物品（Admin，同步删除 item_effect、equip_base）
   */
  async deleteItem(id: number): Promise<boolean> {
    const eff = await dataStorageService.getByCondition('item_effect', { item_id: id });
    if (eff) await dataStorageService.delete('item_effect', eff.id);
    const eb = await dataStorageService.getByCondition('equip_base', { item_id: id });
    if (eb) await dataStorageService.delete('equip_base', eb.id);
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
      // 消耗品属性计算（血药蓝药用 hp_restore/mp_restore）
      attributes.hp = item.hp_restore ?? item.hp ?? 0;
      attributes.mp = item.mp_restore ?? item.mp ?? 0;
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
        return `使用后${(item.hp_restore || item.hp) ? `恢复${item.hp_restore ?? item.hp ?? 0}点HP` : ''}${(item.mp_restore || item.mp) ? `恢复${item.mp_restore ?? item.mp ?? 0}点MP` : ''}`;
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

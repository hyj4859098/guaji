import { BagModel } from '../model/bag.model';
import { EquipInstanceService } from './equip_instance.service';
import { Bag } from '../types/bag';
import { IBaseService, Id, Uid } from '../types/index';
import { dataStorageService } from './data-storage.service';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { EquipEffectUtil } from '../utils/equip-effect';
import { getHpRestore, getMpRestore, isEquipment } from '../utils/item-type';
import { enrichEquipDetail } from '../utils/enrich-equip';
import { wsManager } from '../event/ws-manager';
import { ItemEffectService } from './item-effect.service';

const DEFAULT_EQUIPMENT_CAPACITY = 100;
const MAX_EQUIPMENT_CAPACITY = 500;

export class BagService implements IBaseService<Bag> {
  private model: BagModel;
  private equipInstanceService: EquipInstanceService;

  constructor() {
    this.model = new BagModel();
    this.equipInstanceService = new EquipInstanceService();
  }

  async get(id: Id): Promise<Bag | null> {
    // 直接从数据库获取
    return await this.model.get(id);
  }

  async list(uid: Uid): Promise<any[]> {
    const bags = await this.model.listByUid(uid);
    if (bags.length === 0) return [];

    // 批量查询所有 item 信息（避免 N+1）
    const itemIds = [...new Set(bags.map((b) => b.item_id))];
    const allItems = await dataStorageService.getByIds('item', itemIds);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));

    const bagsWithDetails = await Promise.all(bags.map(async (bag) => {
      try {
        const itemInfo = itemMap.get(bag.item_id);
        if (itemInfo) {
          const itemData = {
            ...bag,
            name: itemInfo.name,
            type: itemInfo.type,
            hp_restore: getHpRestore(itemInfo),
            mp_restore: getMpRestore(itemInfo),
            description: itemInfo.description
          };
          
          if (bag.equipment_uid) {
            const instanceId = parseInt(String(bag.equipment_uid), 10);
            if (!isNaN(instanceId)) {
              const instance = await this.equipInstanceService.get(instanceId);
              if (instance && String(instance.uid) === String(uid)) {
                const detail = await enrichEquipDetail(this.equipInstanceService, instance);
                Object.assign(itemData, detail);
                (itemData as any).pos = instance.pos ?? itemInfo.pos;
              }
            }
          }
          
          return itemData;
        }
        return bag;
      } catch (error) {
        logger.error('获取物品信息失败', { error: error instanceof Error ? error.message : String(error), itemId: bag.item_id });
        return bag;
      }
    }));
    
    const result: any[] = [];
    for (const bag of bagsWithDetails) {
      const bagType = (bag as any).type;
      const bagCount = bag.count;
      const bagEquipmentUid = (bag as any).equipment_uid;
      const bagEquipAttributes = (bag as any).equip_attributes;
      const bagBaseAttributes = (bag as any).base_attributes;
      const bagLevel = (bag as any).level ?? (bag as any).equip_level;
      
      if (bagType === 2 && bagCount > 1) {
        for (let i = 0; i < bagCount; i++) {
          result.push({
            ...bag,
            id: bag.id * 10000 + i,
            count: 1,
            original_id: bag.id,
            equipment_uid: bagEquipmentUid,
            equip_attributes: bagEquipAttributes,
            base_attributes: bagBaseAttributes,
            level: bagLevel,
            equip_level: bagLevel
          });
        }
      } else {
        result.push({
          ...bag,
          original_id: bag.id,
          equipment_uid: bagEquipmentUid,
          equip_attributes: bagEquipAttributes,
          base_attributes: bagBaseAttributes,
          level: bagLevel,
          equip_level: bagLevel
        });
      }
    }
    
    return result;
  }

  /** 统计背包中装备数量（equipment_uid 不为空的记录数） */
  async getEquipmentCount(uid: Uid): Promise<number> {
    const bags = await this.model.listByUid(uid);
    return bags.filter((b: Bag) => b.equipment_uid != null && String(b.equipment_uid).trim() !== '').length;
  }

  /** 获取背包装备容量上限，无则返回 100 */
  async getEquipmentCapacity(uid: Uid): Promise<number> {
    const { services } = await import('./registry');
    const players = await services.player.list(uid);
    const cap = players[0]?.equipment_capacity;
    if (cap == null) return DEFAULT_EQUIPMENT_CAPACITY;
    return Math.min(Math.max(Number(cap) || DEFAULT_EQUIPMENT_CAPACITY, 0), MAX_EQUIPMENT_CAPACITY);
  }

  /** 是否还能添加装备 */
  async canAddEquipment(uid: Uid): Promise<boolean> {
    const [count, capacity] = await Promise.all([
      this.getEquipmentCount(uid),
      this.getEquipmentCapacity(uid)
    ]);
    return count < capacity;
  }

  /** 获取背包列表及容量信息（供 API / WS 使用） */
  async getListPayload(uid: Uid): Promise<{ items: any[]; equipment_count: number; equipment_capacity: number }> {
    const [items, equipment_count, equipment_capacity] = await Promise.all([
      this.list(uid),
      this.getEquipmentCount(uid),
      this.getEquipmentCapacity(uid)
    ]);
    return { items, equipment_count, equipment_capacity };
  }

  async add(data: Omit<Bag, 'id' | 'create_time' | 'update_time'>): Promise<Id> {
    // 构建新物品数据
    const newItem = {
      ...data,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    };
    
    // 直接插入数据库
    return await this.model.insert(newItem);
  }

  async update(id: Id, data: Partial<Bag>, uid?: Uid): Promise<boolean> {
    if (uid != null) {
      const bag = await this.model.get(id);
      if (!bag || String(bag.uid) !== String(uid)) {
        throw createError(ErrorCode.FORBIDDEN, '无权操作该物品');
      }
    }
    return await this.model.update(id, { ...data, update_time: Math.floor(Date.now() / 1000) });
  }

  async delete(id: Id, options?: { skipEquipInstance?: boolean; uid?: Uid }): Promise<boolean> {
    const bag = await this.model.get(id);
    if (!bag) return false;
    if (options?.uid != null && String(bag.uid) !== String(options.uid)) {
      throw createError(ErrorCode.FORBIDDEN, '无权删除该物品');
    }
    if (bag.equipment_uid && !options?.skipEquipInstance) {
      const instanceId = parseInt(String(bag.equipment_uid), 10);
      if (!isNaN(instanceId)) {
        await this.equipInstanceService.deleteInstance(instanceId);
      }
    }
    return await this.model.delete(id);
  }

  /** 一键清除背包内所有装备（高危操作，需前端确认） */
  async clearAllEquipment(uid: Uid): Promise<number> {
    const bags = await this.model.listByUid(uid);
    const equipBags = bags.filter((b: Bag) => b.equipment_uid != null && String(b.equipment_uid).trim() !== '');
    let deleted = 0;
    for (const bag of equipBags) {
      const instanceId = parseInt(String(bag.equipment_uid), 10);
      if (!isNaN(instanceId)) {
        await this.equipInstanceService.deleteInstance(instanceId);
      }
      await this.model.delete(bag.id);
      deleted++;
    }
    logger.info('一键清包', { uid, deleted });
    return deleted;
  }

  async useItem(uid: Uid, itemId: Id, useCount: number = 1): Promise<boolean> {
    logger.info('开始使用物品', { itemId, uid, useCount });
    
    const bags = await this.list(uid);
    const item = bags.find((item: any) => item.id === itemId || item.original_id === itemId);
    
    if (!item) {
      logger.warn('物品不存在', { itemId, uid });
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
    }

    const actualCount = Math.min(useCount, item.count || 1);
    if (actualCount <= 0) {
      logger.warn('物品数量不足', { itemId, uid, count: item.count });
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '物品数量不足');
    }

    logger.info('物品信息', { item });

    const itemInfo = await dataStorageService.getByCondition('item', { id: item.item_id });
    if (!itemInfo) {
      logger.warn('物品类型不存在', { itemId: item.item_id });
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品类型不存在');
    }

    // 唯一入口：item_effect 表配置驱动，无配置则不可使用
    if (!(await ItemEffectService.hasConfig(item.item_id))) {
      throw createError(ErrorCode.INVALID_PARAMS, '该物品无法直接使用');
    }

    const result = await ItemEffectService.execute(uid, item.item_id, actualCount, itemInfo, { bagService: this });
    if (!result.ok) return false;

    // 技能书等效果内部已处理背包扣减，仅推送更新
    if (result.consumedByEffect) {
      const payload = await this.getListPayload(uid);
      wsManager.sendToUser(uid, { type: 'bag', data: payload });
      return true;
    }

    if (item.count <= actualCount) {
      await this.model.delete(item.original_id || item.id);
    } else {
      await this.model.update(item.original_id || item.id, {
        count: item.count - actualCount,
        update_time: Math.floor(Date.now() / 1000),
      });
    }
    const payload = await this.getListPayload(uid);
    wsManager.sendToUser(uid, { type: 'bag', data: payload });
    return true;
  }

  /**
   * 从背包减少可堆叠物品数量（拍卖上架等场景）
   */
  async reduceBagItemCount(bagId: number, count: number): Promise<boolean> {
    const bag = await this.model.get(bagId);
    if (!bag || bag.equipment_uid) return false;
    if ((bag.count ?? 0) <= count) {
      return await this.model.delete(bagId);
    }
    return await this.model.update(bagId, { count: (bag.count ?? 0) - count });
  }

  /**
   * 将装备实例加入背包（equipment_uid = String(equip_instance_id)）
   */
  async addEquipInstanceToBag(uid: Uid, item_id: number, equipment_uid: string): Promise<void> {
    const canAdd = await this.canAddEquipment(uid);
    if (!canAdd) {
      throw createError(ErrorCode.BAG_EQUIPMENT_FULL, '背包装备已满，无法获得更多装备');
    }
    await this.model.addItem(uid, item_id, 1, equipment_uid);
  }

  async addItem(uid: Uid, itemId: number, count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 1 || count > 9999) {
      throw createError(ErrorCode.INVALID_PARAMS, '数量无效');
    }
    const itemInfo = await dataStorageService.getByCondition('item', { id: itemId });

    if (!itemInfo) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
    }

    if (itemInfo.type == null || itemInfo.type < 1 || itemInfo.type > 6) {
      throw createError(ErrorCode.INVALID_PARAMS, '物品类型异常，无法添加');
    }

    if (isEquipment(itemInfo)) {
      for (let i = 0; i < count; i++) {
        const canAdd = await this.canAddEquipment(uid);
        if (!canAdd) {
          throw createError(ErrorCode.BAG_EQUIPMENT_FULL, '背包装备已满，无法获得更多装备');
        }
        const instanceId = await this.equipInstanceService.createFromBase(uid, itemId);
        if (!instanceId) {
          throw createError(ErrorCode.ITEM_NOT_FOUND, '装备基础属性不存在');
        }
        await this.model.addItem(uid, itemId, 1, String(instanceId));
        logger.info('装备进入背包', { itemId, uid, equipment_uid: instanceId });
      }
    } else {
      // 消耗品/材料/道具：使用 model.addItem 统一合并逻辑，确保与已有堆叠
      await this.model.addItem(uid, itemId, count);
    }
  }

  /**
   * 穿戴装备 — 委托 EquipService.wearEquip（唯一穿戴逻辑入口）
   * 保留此方法签名以兼容现有 API 调用方和集成测试
   */
  async wearItem(
    uid: Uid,
    bagItemId: Id,
    equipService?: { wearEquip: (u: Uid, equipId: Id) => Promise<void> }
  ): Promise<boolean> {
    if (!equipService) {
      const { services } = await import('./registry');
      equipService = services.equip;
    }
    await equipService.wearEquip(uid, bagItemId);
    return true;
  }


}

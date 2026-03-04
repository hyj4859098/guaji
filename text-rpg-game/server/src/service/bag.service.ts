import { BagModel } from '../model/bag.model';
import { EquipInstanceService } from './equip_instance.service';
import { Bag } from '../types/bag';
import { IBaseService, Id, Uid } from '../types/index';
import { dataStorageService } from './data-storage.service';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { EquipEffectUtil } from '../utils/equip-effect';
import { wsManager } from '../event/ws-manager';
import { cacheService } from './cache.service';

const DEFAULT_EQUIPMENT_CAPACITY = 100;
const MAX_EQUIPMENT_CAPACITY = 500;
/** 扩容袋固定 item_id，使用后 +50 容量 */
const EXPANSION_BAG_ITEM_ID = 11;
const EXPANSION_BAG_CAPACITY = 50;

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
    // 直接从数据库获取
    const bags = await this.model.listByUid(uid);
    
    const bagsWithDetails = await Promise.all(bags.map(async (bag) => {
      try {
        const itemInfo = await dataStorageService.getByCondition('item', { id: bag.item_id });
        if (itemInfo) {
          const itemData = {
            ...bag,
            name: itemInfo.name,
            type: itemInfo.type,
            hp_restore: itemInfo.hp_restore,
            mp_restore: itemInfo.mp_restore,
            description: itemInfo.description
          };
          
          if (bag.equipment_uid) {
            const instanceId = parseInt(String(bag.equipment_uid), 10);
            if (!isNaN(instanceId)) {
              const instance = await this.equipInstanceService.get(instanceId);
              if (instance && String(instance.uid) === String(uid)) {
                const attrs = await this.equipInstanceService.buildEquipAttrs(instance);
                const baseAttrs = await this.equipInstanceService.buildBaseAttrs(instance);
                const equipLevel = await this.equipInstanceService.getEquipLevel(instance);
                (itemData as any).equip_attributes = attrs;
                (itemData as any).base_attributes = baseAttrs;
                (itemData as any).equip_level = equipLevel;
                (itemData as any).level = equipLevel;
                (itemData as any).enhance_level = instance.enhance_level ?? 0;
                (itemData as any).main_value = instance.main_value ?? 0;
                (itemData as any).main_value_2 = instance.main_value_2 ?? 0;
                (itemData as any).blessing_level = instance.blessing_level ?? 0;
                (itemData as any).pos = instance.pos ?? itemInfo.pos;
                if ((instance.blessing_level ?? 0) > 0) {
                  const bEffects = await this.equipInstanceService.buildBlessingEffects(instance);
                  (itemData as any).blessing_effects = bEffects;
                }
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
    const PlayerService = require('./player.service').PlayerService;
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
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

  async update(id: Id, data: Partial<Bag>): Promise<boolean> {
    // 直接更新数据库
    return await this.model.update(id, { ...data, update_time: Math.floor(Date.now() / 1000) });
  }

  async delete(id: Id, options?: { skipEquipInstance?: boolean }): Promise<boolean> {
    const bag = await this.model.get(id);
    if (bag && bag.equipment_uid && !options?.skipEquipInstance) {
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

    const itemType = Number(itemInfo.type);
    logger.info('物品类型', { itemId: item.item_id, type: itemType });

    // 扩容袋：固定 item_id 11，使用后 +50 容量，上限 500
    if (item.item_id === EXPANSION_BAG_ITEM_ID) {
      const PlayerService = require('./player.service').PlayerService;
      const playerService = new PlayerService();
      const players = await playerService.list(uid);
      if (!players.length) throw createError(ErrorCode.SYSTEM_ERROR, '扩容袋使用失败');
      const player = players[0];
      const currentCap = player.equipment_capacity ?? DEFAULT_EQUIPMENT_CAPACITY;
      const roomToMax = MAX_EQUIPMENT_CAPACITY - currentCap;
      const maxUsable = Math.floor(roomToMax / EXPANSION_BAG_CAPACITY);
      if (maxUsable <= 0) {
        throw createError(ErrorCode.INVALID_PARAMS, '背包装备容量已达上限');
      }
      if (actualCount > maxUsable) {
        throw createError(ErrorCode.INVALID_PARAMS, `最多只能使用 ${maxUsable} 个扩容袋，当前容量距上限仅可增加 ${roomToMax} 点`);
      }
      const addCap = actualCount * EXPANSION_BAG_CAPACITY;
      const newCap = currentCap + addCap;
      await playerService.update(player.id, { equipment_capacity: newCap } as any);
      cacheService.player.invalidateByUid(uid);
      if (item.count <= actualCount) {
        await this.model.delete(item.original_id || item.id);
      } else {
        await this.model.update(item.original_id || item.id, {
          count: item.count - actualCount,
          update_time: Math.floor(Date.now() / 1000),
        });
      }
      const updatedPlayers = await playerService.list(uid);
      if (updatedPlayers.length) wsManager.sendToUser(uid, { type: 'player', data: updatedPlayers[0] });
      const payload = await this.getListPayload(uid);
      wsManager.sendToUser(uid, { type: 'bag', data: payload });
      logger.info('扩容袋使用成功', { uid, currentCap, newCap, usedCount: actualCount });
      return true;
    }

    if (itemType === 6) {
      const vipDaysPerCard = Number(itemInfo.vip_days) || 30;
      const totalDays = vipDaysPerCard * actualCount;
      const PlayerService = require('./player.service').PlayerService;
      const playerService = new PlayerService();
      const players = await playerService.list(uid);
      if (!players.length) throw createError(ErrorCode.SYSTEM_ERROR, 'VIP卡使用失败');
      const player = players[0];
      const now = Math.floor(Date.now() / 1000);
      const currentExpire = (player.vip_expire_time && player.vip_expire_time > now)
        ? player.vip_expire_time : now;
      const newExpire = currentExpire + totalDays * 86400;
      await playerService.update(player.id, { vip_level: 1, vip_expire_time: newExpire } as any);
      if (item.count <= actualCount) {
        await this.model.delete(item.original_id || item.id);
      } else {
        await this.model.update(item.original_id || item.id, {
          count: item.count - actualCount, update_time: now,
        });
      }
      const updatedPlayers = await playerService.list(uid);
      if (updatedPlayers.length) wsManager.sendToUser(uid, { type: 'player', data: updatedPlayers[0] });
      const payload = await this.getListPayload(uid);
      wsManager.sendToUser(uid, { type: 'bag', data: payload });
      logger.info('VIP卡使用成功', { uid, totalDays, usedCount: actualCount, newExpire });
      return true;
    }

    if (itemType === 5) {
      const BoostService = require('./boost.service').BoostService;
      const boostService = new BoostService();
      const ok = await boostService.useBoostCard(uid, item.item_id, actualCount);
      if (!ok) {
        throw createError(ErrorCode.SYSTEM_ERROR, '多倍卡使用失败');
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

    if (itemType === 4) {
      const skill = await dataStorageService.getByCondition('skill', { book_id: item.item_id });
      if (skill) {
        // 是技能书，学习技能（learnSkill 内部会移除技能书，已学技能会抛错）
        const SkillService = require('./skill.service').SkillService;
        const skillService = new SkillService();
        const learned = await skillService.learnSkill(uid, item.item_id);
        logger.info('技能书使用成功', { itemId: item.item_id, uid, learned });
        return learned;
      }
    }

    // 检查是否是消耗品（血药 type=1、蓝药 type=3），使用 hp_restore/mp_restore
    const addHpVal = Number(itemInfo.hp_restore) || 0;
    const addMpVal = Number(itemInfo.mp_restore) || 0;

    if (addHpVal > 0 || addMpVal > 0) {
      const PlayerService = require('./player.service').PlayerService;
      const playerService = new PlayerService();
      if (addHpVal > 0) await playerService.addHp(uid, addHpVal * actualCount);
      if (addMpVal > 0) await playerService.addMp(uid, addMpVal * actualCount);

      const players = await playerService.list(uid);
      if (players.length > 0) {
        wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      }

      logger.info('从背包中移除物品', { itemId: item.id, uid, count: actualCount });
      if (item.count <= actualCount) {
        await this.model.delete(item.original_id || item.id);
      } else {
        await this.model.update(item.original_id || item.id, {
          count: item.count - actualCount,
          update_time: Math.floor(Date.now() / 1000)
        });
      }
      const payload = await this.getListPayload(uid);
      wsManager.sendToUser(uid, { type: 'bag', data: payload });
      return true;
    }

    // 其他类型物品的处理
    logger.info('从背包中移除物品', { itemId: item.id, uid, count: 1 });
    if (item.count === 1) {
      await this.model.delete(item.original_id || item.id);
    } else {
      await this.model.update(item.original_id || item.id, {
        count: item.count - 1,
        update_time: Math.floor(Date.now() / 1000)
      });
    }
    
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
    const itemInfo = await dataStorageService.getByCondition('item', { id: itemId });

    if (!itemInfo) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
    }

    const itemType = itemInfo.type;

    if (itemType === 2) {
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
      // 检查背包中是否已存在相同物品
      const existingItems = await this.model.listByUid(uid);
      const existingItem = existingItems.find((item: any) => item.item_id === itemId && !item.equipment_uid);
      
      if (existingItem) {
        // 已存在，增加数量
        await this.model.update(existingItem.id, {
          count: existingItem.count + count
        });
      } else {
        // 不存在，添加新物品
        await this.model.insert({
          uid: uid,
          item_id: itemId,
          count: count
        });
      }
    }
  }

  async wearItem(uid: Uid, bagItemId: Id): Promise<boolean> {
    logger.info('开始穿戴装备', { bagItemId, uid });
    
    try {
      // 从数据库获取背包数据
      const bags = await this.list(uid);
      // 先尝试通过id或original_id查找
      let bagItem = bags.find((item: any) => item.id === bagItemId || item.original_id === bagItemId);
      
      // 如果没找到，尝试直接从数据库查询
      if (!bagItem) {
        logger.info('通过id或original_id未找到物品，尝试直接从数据库查询', { bagItemId, uid });
        const directItem = await this.get(bagItemId);
        if (directItem) {
          bagItem = directItem;
        }
      }
      
      if (!bagItem) {
        logger.warn('背包物品不存在', { bagItemId, uid });
        throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
      }

      // 检查物品类型
      if (!bagItem.type) {
        // 尝试从数据库获取物品类型
        const itemInfo = await dataStorageService.getByCondition('item', { id: bagItem.item_id });
        if (itemInfo) {
          bagItem.type = itemInfo.type;
          bagItem.pos = itemInfo.pos;
        } else {
          logger.warn('物品类型不存在', { itemId: bagItem.item_id });
          throw createError(ErrorCode.ITEM_NOT_FOUND, '物品类型不存在');
        }
      }
      
      if (bagItem.type !== 2) {
        logger.warn('物品不是装备', { itemId: bagItem.item_id, type: bagItem.type });
        throw createError(ErrorCode.ITEM_NOT_EQUIPMENT, '物品不是装备');
      }

      logger.info('是装备，准备穿戴', { itemId: bagItem.item_id, type: bagItem.type });
      
      // 检查装备等级需求
      let equipLevel = bagItem.equip_level ?? bagItem.level;
      if (equipLevel == null && bagItem.equipment_uid) {
        const instanceId = parseInt(String(bagItem.equipment_uid), 10);
        if (!isNaN(instanceId)) {
          const instance = await this.equipInstanceService.get(instanceId);
          if (instance) equipLevel = await this.equipInstanceService.getEquipLevel(instance);
        }
      }
      equipLevel = equipLevel ?? 1;
      const PlayerService = require('./player.service').PlayerService;
      const playerService = new PlayerService();
      const players = await playerService.list(uid);
      const playerLevel = players[0]?.level ?? 1;
      if (playerLevel < equipLevel) {
        throw createError(ErrorCode.INVALID_PARAMS, `装备需求等级 ${equipLevel}，当前等级 ${playerLevel} 不足`);
      }
      
      // 装备部位优先使用 equip_instance.pos（来自 equip_base）
      let pos = bagItem.pos;
      if (pos == null && bagItem.equipment_uid) {
        const instanceId = parseInt(String(bagItem.equipment_uid), 10);
        if (!isNaN(instanceId)) {
          const instance = await this.equipInstanceService.get(instanceId);
          if (instance) pos = instance.pos;
        }
      }
      pos = pos ?? 1;

      logger.info('装备位置', { pos, itemId: bagItem.item_id });

      // 处理装备位置被占用的情况
      const EquipService = require('./equip.service').EquipService;
      const equipService = new EquipService();
      const equips = await equipService.list(uid);
      const existingEquip = equips.find((equip: any) => equip.pos === pos);
      
      if (existingEquip) {
        logger.info('装备位置已被占用，自动卸下原装备', { uid, pos, equipment_uid: existingEquip.equipment_uid });
        await equipService.removeEquip(uid, existingEquip.equipment_uid || existingEquip.id);
        logger.info('原装备从装备栏卸下并返回背包', { itemId: existingEquip.item_id, uid, equipment_uid: existingEquip.equipment_uid });
      }
      
      // 从背包中移除装备
      const deleteId = bagItem.original_id || bagItem.id;
      logger.info('从背包中移除装备', { deleteId, uid });
      await this.delete(deleteId, { skipEquipInstance: true });
      
      if (!bagItem.equipment_uid) {
        throw createError(ErrorCode.ITEM_NOT_FOUND, '装备实例无效');
      }

      // 确保装备有属性
      if (!bagItem.equip_attributes) {
        bagItem.equip_attributes = {
          hp: 0,
          phy_atk: 0,
          phy_def: 0,
          mp: 0,
          mag_def: 0,
          mag_atk: 0,
          hit_rate: 0,
          dodge_rate: 0,
          crit_rate: 0
        };
      }
      
      // 将装备添加到user_equip表
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.insert('user_equip', {
        uid: uid,
        equipment_uid: bagItem.equipment_uid,
        create_time: now,
        update_time: now
      });
      
      logger.info('装备添加到装备栏', { uid, itemId: bagItem.item_id, equipment_uid: bagItem.equipment_uid });
      
      // 应用装备属性效果
      await EquipEffectUtil.applyEquipEffect(uid, bagItem);
      
      logger.info('装备穿戴成功', { itemId: bagItem.item_id, uid, pos, equipment_uid: bagItem.equipment_uid });
      
      return true;
    } catch (error) {
      logger.error('装备穿戴失败', { error: error instanceof Error ? error.message : String(error), bagItemId, uid });
      throw createError(ErrorCode.SYSTEM_ERROR, '装备穿戴失败');
    }
  }


}

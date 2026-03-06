/**
 * 装备服务模块 — 穿戴/卸下的唯一入口
 * 统一使用 equip_instance 表
 */
import { EquipInstanceService } from '../service/equip_instance.service';
import { Id, Uid } from '../types/index';
import { dataStorageService } from './data-storage.service';
import { EquipEffectUtil } from '../utils/equip-effect';
import { isEquipment } from '../utils/item-type';
import { logger } from '../utils/logger';
import { createError, ErrorCode, AppError } from '../utils/error';
import { enrichEquipDetail } from '../utils/enrich-equip';
import { wsManager } from '../event/ws-manager';
import { pushPlayerFullUpdate } from '../utils/push-update';

export class EquipService {
  private equipInstanceService: EquipInstanceService;

  constructor() {
    this.equipInstanceService = new EquipInstanceService();
  }

  async list(uid: Uid): Promise<any[]> {
    const userEquips = await dataStorageService.list('user_equip', { uid });
    if (userEquips.length === 0) return [];

    // 批量查询装备实例
    const instanceIds = userEquips
      .map((ue: any) => parseInt(String(ue.equipment_uid), 10))
      .filter((id: number) => !isNaN(id));
    const instances = await dataStorageService.getByIds('equip_instance', instanceIds);
    const instanceMap = new Map(instances.map((i: any) => [i.id, i]));

    // 批量查询 item 信息
    const itemIds = [...new Set(instances.map((i: any) => i.item_id))];
    const allItems = await dataStorageService.getByIds('item', itemIds);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));

    const result: any[] = [];
    for (const ue of userEquips) {
      const instanceId = parseInt(String(ue.equipment_uid), 10);
      if (isNaN(instanceId)) continue;
      const instance = instanceMap.get(instanceId);
      if (!instance || String(instance.uid) !== String(uid)) continue;
      const detail = await enrichEquipDetail(this.equipInstanceService, instance);
      const itemInfo = itemMap.get(instance.item_id);
      result.push({
        id: String(instanceId),
        equipment_uid: String(instanceId),
        item_id: instance.item_id,
        name: itemInfo?.name || '未知物品',
        attributes: detail.equip_attributes,
        ...detail,
      });
    }
    return result;
  }

  /**
   * 穿戴装备（唯一入口，bag.service.wearItem 委托此方法）
   * 失败一律 throw AppError，不返回 false
   */
  async wearEquip(uid: Uid, equipId: Id): Promise<void> {
    logger.info('开始穿戴装备', { equipId, uid });

    const { services } = await import('./registry');
    const bagService = services.bag;
    const playerService = services.player;

    const bagItems = await bagService.list(uid);
    let equip = bagItems.find((item: any) => item.id === equipId || item.original_id === equipId);

    if (!equip) {
      const directItem = await bagService.get(equipId);
      if (directItem && String(directItem.uid) === String(uid)) equip = directItem;
    }

    if (!equip) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
    }

    if (!equip.type) {
      const itemInfo = await dataStorageService.getByCondition('item', { id: equip.item_id });
      if (itemInfo) {
        equip.type = itemInfo.type;
        equip.pos = itemInfo.pos;
      } else {
        throw createError(ErrorCode.ITEM_NOT_FOUND, '物品类型不存在');
      }
    }

    if (!isEquipment(equip)) {
      throw createError(ErrorCode.ITEM_NOT_EQUIPMENT, '物品不是装备');
    }
    if (!equip.equipment_uid) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '装备实例无效');
    }

    let equipLevel = equip.equip_level ?? equip.level ?? 1;
    if (equipLevel == null && equip.equipment_uid) {
      const instanceId = parseInt(String(equip.equipment_uid), 10);
      if (!isNaN(instanceId)) {
        const instance = await this.equipInstanceService.get(instanceId);
        if (instance) equipLevel = await this.equipInstanceService.getEquipLevel(instance);
      }
    }
    equipLevel = equipLevel ?? 1;

    const players = await playerService.list(uid);
    const playerLevel = players[0]?.level ?? 1;
    if (playerLevel < equipLevel) {
      throw createError(ErrorCode.INVALID_PARAMS, `装备需求等级 ${equipLevel}，当前等级 ${playerLevel} 不足`);
    }

    let pos = equip.pos;
    if (pos == null && equip.equipment_uid) {
      const instanceId = parseInt(String(equip.equipment_uid), 10);
      if (!isNaN(instanceId)) {
        const instance = await this.equipInstanceService.get(instanceId);
        if (instance) pos = instance.pos;
      }
    }
    pos = pos ?? 1;

    const equips = await this.list(uid);
    const existingEquip = equips.find((e: any) => e.pos === pos);
    if (existingEquip) {
      await this.removeEquip(uid, existingEquip.equipment_uid || existingEquip.id);
    }

    const deleteId = equip.original_id || equip.id;
    await bagService.delete(deleteId, { skipEquipInstance: true });

    if (!equip.equip_attributes) {
      equip.equip_attributes = {
        hp: 0, phy_atk: 0, phy_def: 0, mp: 0,
        mag_def: 0, mag_atk: 0, hit_rate: 0, dodge_rate: 0, crit_rate: 0
      };
    }

    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert('user_equip', {
      uid,
      equipment_uid: equip.equipment_uid,
      create_time: now,
      update_time: now
    });

    await EquipEffectUtil.applyEquipEffect(uid, equip);

    // 数据不变式
    const verifyEquips = await this.list(uid);
    const worn = verifyEquips.find((e: any) => String(e.equipment_uid) === String(equip.equipment_uid));
    if (!worn) {
      logger.error('DATA_INTEGRITY: 穿戴后装备未出现在装备栏', { uid, equipment_uid: equip.equipment_uid, item_id: equip.item_id });
    }

    logger.info('装备穿戴成功', { itemId: equip.item_id, uid, pos, equipment_uid: equip.equipment_uid });
  }

  /**
   * 卸下装备
   * 失败一律 throw AppError，不返回 false
   */
  async removeEquip(uid: Uid, equipmentUid: Id | string): Promise<void> {
    const instanceId = parseInt(String(equipmentUid), 10);
    if (isNaN(instanceId)) {
      throw createError(ErrorCode.INVALID_PARAMS, '无效的装备ID');
    }
    const instance = await this.equipInstanceService.get(instanceId);
    if (!instance || String(instance.uid) !== String(uid)) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '装备实例不存在或不属于该用户');
    }
    const attrs = await this.equipInstanceService.buildEquipAttrs(instance);
    const equipData = { equip_attributes: attrs, item_id: instance.item_id };

    const { services } = await import('./registry');
    const bagService = services.bag;
    const canAdd = await bagService.canAddEquipment(uid);
    if (!canAdd) {
      throw createError(ErrorCode.BAG_EQUIPMENT_FULL, '背包装备已满，无法卸下');
    }

    await dataStorageService.deleteMany('user_equip', { uid, equipment_uid: String(instanceId) });
    await bagService.add({ uid, item_id: instance.item_id, count: 1, equipment_uid: String(instanceId) });

    // 数据不变式
    const verifyBags = await bagService.list(uid);
    const returned = verifyBags.find((i: any) => String(i.equipment_uid) === String(instanceId));
    if (returned) {
      const itemInfo = await dataStorageService.getByCondition('item', { id: instance.item_id });
      if (itemInfo && !isEquipment(itemInfo)) {
        logger.error('DATA_INTEGRITY: 卸下后物品类型变异', { uid, equipmentUid, actualType: itemInfo.type, item_id: instance.item_id });
      }
      if (!returned.equipment_uid) {
        logger.error('DATA_INTEGRITY: 卸下后 equipment_uid 丢失', { uid, equipmentUid, item_id: instance.item_id });
      }
    } else {
      logger.error('DATA_INTEGRITY: 卸下后物品未出现在背包', { uid, equipmentUid, item_id: instance.item_id });
    }

    await EquipEffectUtil.removeEquipEffect(uid, equipData);

    logger.info('装备卸下成功', { equipmentUid, uid, itemId: instance.item_id });
  }

  pushFullUpdate(uid: Uid): Promise<void> {
    return pushPlayerFullUpdate(uid);
  }
}

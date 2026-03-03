/**
 * 装备服务模块
 * 统一使用 equip_instance 表
 */
import { EquipInstanceService } from '../service/equip_instance.service';
import { Id, Uid } from '../types/index';
import { dataStorageService } from './data-storage.service';
import { EquipEffectUtil } from '../utils/equip-effect';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';

export class EquipService {
  private equipInstanceService: EquipInstanceService;

  constructor() {
    this.equipInstanceService = new EquipInstanceService();
  }

  async list(uid: Uid): Promise<any[]> {
    const userEquips = await dataStorageService.list('user_equip', { uid });
    if (userEquips.length === 0) return [];

    const result: any[] = [];
    for (const ue of userEquips) {
      const instanceId = parseInt(String(ue.equipment_uid), 10);
      if (isNaN(instanceId)) continue;
      const instance = await this.equipInstanceService.get(instanceId);
      if (!instance || String(instance.uid) !== String(uid)) continue;
      const attrs = await this.equipInstanceService.buildEquipAttrs(instance);
      const baseAttrs = await this.equipInstanceService.buildBaseAttrs(instance);
      const equipLevel = await this.equipInstanceService.getEquipLevel(instance);
      const blessingEffects = await this.equipInstanceService.buildBlessingEffects(instance);
      const itemInfo = await dataStorageService.getByCondition('item', { id: instance.item_id });
      result.push({
        id: String(instanceId),
        equipment_uid: String(instanceId),
        item_id: instance.item_id,
        pos: instance.pos,
        name: itemInfo?.name || '未知物品',
        attributes: attrs,
        equip_attributes: attrs,
        base_attributes: baseAttrs,
        level: equipLevel,
        equip_level: equipLevel,
        enhance_level: instance.enhance_level ?? 0,
        main_value: instance.main_value ?? 0,
        main_value_2: instance.main_value_2 ?? 0,
        blessing_level: instance.blessing_level ?? 0,
        blessing_effects: blessingEffects.length > 0 ? blessingEffects : undefined,
      });
    }
    return result;
  }

  async wearEquip(uid: Uid, equipId: Id): Promise<boolean> {
    try {
      logger.info('开始穿戴装备', { equipId, uid });

      const BagService = require('./bag.service').BagService;
      const bagService = new BagService();

      const bagItems = await bagService.list(uid);
      let equip = bagItems.find((item: any) => item.id === equipId || item.original_id === equipId);

      if (!equip) {
        const directItem = await bagService.get(equipId);
        if (directItem) equip = directItem;
      }

      if (!equip || equip.uid !== uid) {
        logger.warn('装备不存在或不属于该用户', { equipId, uid });
        return false;
      }

      if (!equip.type) {
        const itemInfo = await dataStorageService.getByCondition('item', { id: equip.item_id });
        if (itemInfo) {
          equip.type = itemInfo.type;
          equip.pos = itemInfo.pos;
        } else {
          logger.warn('物品类型不存在', { itemId: equip.item_id });
          return false;
        }
      }

      if (equip.type !== 2) {
        logger.warn('物品不是装备', { itemId: equip.item_id, type: equip.type });
        return false;
      }

      // 检查装备等级需求
      let equipLevel = equip.equip_level ?? equip.level ?? 1;
      if (equipLevel == null && equip.equipment_uid) {
        const instanceId = parseInt(String(equip.equipment_uid), 10);
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

      const pos = equip.pos || 2;
      const equips = await this.list(uid);
      const existingEquip = equips.find((e: any) => e.pos === pos);

      if (existingEquip) {
        await this.removeEquip(uid, existingEquip.equipment_uid || existingEquip.id);
      }

      const deleteId = equip.original_id || equip.id;
      await bagService.delete(deleteId, { skipEquipInstance: true });

      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.insert('user_equip', {
        uid: uid,
        equipment_uid: equip.equipment_uid,
        create_time: now,
        update_time: now
      });

      await EquipEffectUtil.applyEquipEffect(uid, equip);

      logger.info('装备穿戴成功', { itemId: equip.item_id, uid, pos, equipment_uid: equip.equipment_uid });
      return true;
    } catch (error) {
      logger.error('穿戴装备失败:', error);
      return false;
    }
  }

  async removeEquip(uid: Uid, equipmentUid: Id): Promise<boolean> {
    try {
      const instanceId = parseInt(String(equipmentUid), 10);
      if (isNaN(instanceId)) {
        logger.warn('无效的装备ID', { equipmentUid, uid });
        return false;
      }
      const instance = await this.equipInstanceService.get(instanceId);
      if (!instance || String(instance.uid) !== String(uid)) {
        logger.warn('装备实例不存在或不属于该用户', { equipmentUid, uid });
        return false;
      }
      const attrs = await this.equipInstanceService.buildEquipAttrs(instance);
      const equipData = { equip_attributes: attrs, item_id: instance.item_id };

      await dataStorageService.deleteMany('user_equip', { uid, equipment_uid: String(instanceId) });

      const BagService = require('./bag.service').BagService;
      const bagService = new BagService();
      await bagService.add({ uid, item_id: instance.item_id, count: 1, equipment_uid: String(instanceId) });

      await EquipEffectUtil.removeEquipEffect(uid, equipData);

      logger.info('装备卸下成功', { equipmentUid, uid, itemId: instance.item_id });
      return true;
    } catch (error) {
      logger.error('卸下装备失败:', error);
      return false;
    }
  }

  async pushFullUpdate(uid: Uid): Promise<void> {
    try {
      const PlayerService = require('./player.service').PlayerService;
      const BagService = require('./bag.service').BagService;
      const playerService = new PlayerService();
      const bagService = new BagService();
      const [players, equips, bags] = await Promise.all([
        playerService.list(uid),
        this.list(uid),
        bagService.list(uid)
      ]);
      if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      wsManager.sendToUser(uid, { type: 'equip', data: equips });
      wsManager.sendToUser(uid, { type: 'bag', data: bags });
    } catch (e) {
      logger.warn('装备变更推送失败', { uid });
    }
  }
}

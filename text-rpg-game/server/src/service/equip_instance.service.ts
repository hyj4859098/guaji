/**
 * 装备实例服务：创建唯一装备、主属性浮动、强化
 */
import { EquipInstanceModel } from '../model/equip_instance.model';
import { dataStorageService } from './data-storage.service';
import { calculateRandomAttr, getBaseMainValue, WEAPON_POS } from '../utils/equip';
import { calcBlessingEffects, extractBlessingAttrs, BlessingEffect } from '../utils/blessing-effect';
import { isEquipment } from '../utils/item-type';
import { Uid } from '../types';
import { logger } from '../utils/logger';
import { Collections } from '../config/collections';

export class EquipInstanceService {
  private model = new EquipInstanceModel();

  /**
   * 创建装备实例（手动添加时用基础值，无浮动）
   */
  async createFromBase(uid: Uid, item_id: number): Promise<number | null> {
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: item_id }, undefined);
    if (!item || !isEquipment(item)) {
      logger.warn('createFromBase 跳过：物品非装备类型', { item_id, type: item?.type });
      return null;
    }
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id }, undefined);
    if (!equipBase) {
      logger.warn('equip_base 不存在', { item_id });
      return null;
    }
    const pos = (equipBase as any).pos ?? 1;
    const { main, main2 } = getBaseMainValue(equipBase, pos);
    const main_value = main ?? 0;
    const main_value_2 = pos === WEAPON_POS && main2 != null ? main2 : 0;
    const now = Math.floor(Date.now() / 1000);
    const id = await this.model.insert({
      uid,
      item_id,
      pos,
      main_value,
      main_value_2,
      enhance_level: 0,
      blessing_level: 0,
      create_time: now,
      update_time: now,
    });
    return id as number;
  }

  /**
   * 从掉落创建装备实例（主属性 ±20% 浮动）
   */
  async createFromDrop(uid: Uid, item_id: number): Promise<number | null> {
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: item_id }, undefined);
    if (!item || !isEquipment(item)) {
      logger.warn('createFromDrop 跳过：物品非装备类型', { item_id, type: item?.type });
      return null;
    }
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id }, undefined);
    if (!equipBase) {
      logger.warn('equip_base 不存在', { item_id });
      return null;
    }
    const pos = (equipBase as any).pos ?? 1;
    const { main, main2 } = getBaseMainValue(equipBase, pos);
    const main_value = calculateRandomAttr(main);
    const main_value_2 = pos === WEAPON_POS && main2 != null ? calculateRandomAttr(main2) : 0;
    const now = Math.floor(Date.now() / 1000);
    const id = await this.model.insert({
      uid,
      item_id,
      pos,
      main_value,
      main_value_2,
      enhance_level: 0,
      blessing_level: 0,
      create_time: now,
      update_time: now,
    });
    return id as number;
  }

  async get(id: number): Promise<any> {
    return await this.model.get(id);
  }

  /**
   * 删除装备实例（丢弃/强化破碎时调用，装备已不复存在）
   */
  async deleteInstance(id: number): Promise<boolean> {
    return await this.model.delete(id);
  }

  /**
   * 强化破碎时销毁装备：从背包/装备栏移除并删除实例记录
   */
  async destroyOnEnhanceFail(instanceId: number, uid: Uid): Promise<boolean> {
    const instance = await this.model.get(instanceId);
    if (!instance || String(instance.uid) !== String(uid)) return false;
    const equipmentUid = String(instanceId);
    const userEquips = await dataStorageService.list(Collections.USER_EQUIP, { uid, equipment_uid: equipmentUid });
    if (userEquips.length > 0) {
      const attrs = await this.buildEquipAttrs(instance);
      const EquipEffectUtil = (await import('../utils/equip-effect')).EquipEffectUtil;
      await EquipEffectUtil.removeEquipEffect(uid, { equip_attributes: attrs });
    }
    await dataStorageService.deleteMany(Collections.USER_EQUIP, { uid, equipment_uid: equipmentUid });
    const bags = await dataStorageService.list(Collections.BAG, { uid, equipment_uid: equipmentUid });
    for (const bag of bags) {
      await dataStorageService.delete(Collections.BAG, bag.id);
    }
    return await this.model.delete(instanceId);
  }

  /**
   * 交易时转移归属，只更新 uid 不新建记录
   */
  async transferOwnership(instanceId: number, newUid: Uid): Promise<boolean> {
    const instance = await this.model.get(instanceId);
    if (!instance) return false;
    return await this.model.update(instanceId, { uid: newUid });
  }

  /**
   * 交易装备：从卖家移除（背包/装备栏），加入买家背包，只更新 equip_instance.uid
   */
  async tradeToUser(sellerUid: Uid, buyerUid: Uid, instanceId: number): Promise<boolean> {
    const instance = await this.model.get(instanceId);
    if (!instance || String(instance.uid) !== String(sellerUid)) return false;
    const equipmentUid = String(instanceId);
    const userEquips = await dataStorageService.list(Collections.USER_EQUIP, { uid: sellerUid, equipment_uid: equipmentUid });
    if (userEquips.length > 0) {
      const attrs = await this.buildEquipAttrs(instance);
      const EquipEffectUtil = (await import('../utils/equip-effect')).EquipEffectUtil;
      await EquipEffectUtil.removeEquipEffect(sellerUid, { equip_attributes: attrs });
    }
    await dataStorageService.deleteMany(Collections.USER_EQUIP, { uid: sellerUid, equipment_uid: equipmentUid });
    const bags = await dataStorageService.list(Collections.BAG, { uid: sellerUid, equipment_uid: equipmentUid });
    for (const bag of bags) {
      await dataStorageService.delete(Collections.BAG, bag.id);
    }
    await dataStorageService.insert(Collections.BAG, {
      uid: buyerUid,
      item_id: instance.item_id,
      count: 1,
      equipment_uid: equipmentUid
    });
    return await this.model.update(instanceId, { uid: buyerUid });
  }

  /**
   * 构建装备完整属性（用于装备效果计算）
   * 主属性用 main_value，其他属性从 equip_base 取
   */
  async buildEquipAttrs(instance: any): Promise<Record<string, number>> {
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id: instance.item_id }, undefined);
    if (!equipBase) return {};
    const equipModule = await import('../utils/equip');
    const attr = equipModule.getEquipMainAttr(instance.pos);
    const enhance = 1 + (instance.enhance_level || 0) * 0.15;
    const mainVal = Math.floor((instance.main_value || 0) * enhance);
    const mainVal2 = instance.main_value_2 ? Math.floor((instance.main_value_2 || 0) * enhance) : 0;
    const attrs: Record<string, number> = {
      hp: (equipBase as any).base_hp ?? 0,
      phy_atk: (equipBase as any).base_phy_atk ?? 0,
      phy_def: (equipBase as any).base_phy_def ?? 0,
      mp: (equipBase as any).base_mp ?? 0,
      mag_def: (equipBase as any).base_mag_def ?? 0,
      mag_atk: (equipBase as any).base_mag_atk ?? 0,
      hit_rate: (equipBase as any).base_hit_rate ?? 0,
      dodge_rate: (equipBase as any).base_dodge_rate ?? 0,
      crit_rate: (equipBase as any).base_crit_rate ?? 0,
    };
    attrs[attr] = mainVal;
    if (instance.pos === WEAPON_POS && mainVal2 > 0) attrs.mag_atk = mainVal2;

    const blessingLevel = instance.blessing_level ?? 0;
    if (blessingLevel > 0) {
      const equipLevel = (equipBase as any).base_level ?? 1;
      const effects = calcBlessingEffects(instance.pos, blessingLevel, equipLevel);
      const blessingAttrs = extractBlessingAttrs(effects);
      for (const [k, v] of Object.entries(blessingAttrs)) {
        attrs[k] = (attrs[k] || 0) + v;
      }
    }

    return attrs;
  }

  /**
   * 构建装备基础属性（用于悬浮窗对比，主属性为 equip_base 的基准值）
   */
  async buildBaseAttrs(instance: any): Promise<Record<string, number>> {
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id: instance.item_id }, undefined);
    if (!equipBase) return {};
    return {
      hp: (equipBase as any).base_hp ?? 0,
      phy_atk: (equipBase as any).base_phy_atk ?? 0,
      phy_def: (equipBase as any).base_phy_def ?? 0,
      mp: (equipBase as any).base_mp ?? 0,
      mag_def: (equipBase as any).base_mag_def ?? 0,
      mag_atk: (equipBase as any).base_mag_atk ?? 0,
      hit_rate: (equipBase as any).base_hit_rate ?? 0,
      dodge_rate: (equipBase as any).base_dodge_rate ?? 0,
      crit_rate: (equipBase as any).base_crit_rate ?? 0,
    };
  }

  /** 获取装备需求等级（equip_base.base_level） */
  async getEquipLevel(instance: any): Promise<number> {
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id: instance.item_id }, undefined);
    return (equipBase as any)?.base_level ?? 1;
  }

  /** 构建祝福效果列表（供前端悬浮窗和战斗系统使用） */
  async buildBlessingEffects(instance: any): Promise<BlessingEffect[]> {
    const blessingLevel = instance.blessing_level ?? 0;
    if (blessingLevel <= 0) return [];
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id: instance.item_id }, undefined);
    const equipLevel = (equipBase as any)?.base_level ?? 1;
    return calcBlessingEffects(instance.pos, blessingLevel, equipLevel);
  }
}

/**
 * 装备详情组装：从 equip_instance 构建完整属性对象
 * bag.service、auction.service、equip.service 共用，避免重复实现。
 */
import { EquipInstanceService } from '../service/equip_instance.service';

export interface EquipDetail {
  equip_attributes: Record<string, number>;
  base_attributes: Record<string, number>;
  equip_level: number;
  level: number;
  enhance_level: number;
  main_value: number;
  main_value_2: number;
  blessing_level: number;
  pos: number;
  blessing_effects?: any[];
}

/**
 * 从 equip_instance 构建装备完整详情（属性、基础属性、等级、祝福）
 */
export async function enrichEquipDetail(
  equipInstanceService: EquipInstanceService,
  instance: any
): Promise<EquipDetail> {
  const attrs = await equipInstanceService.buildEquipAttrs(instance);
  const baseAttrs = await equipInstanceService.buildBaseAttrs(instance);
  const equipLevel = await equipInstanceService.getEquipLevel(instance);
  const blessingEffects = (instance.blessing_level ?? 0) > 0
    ? await equipInstanceService.buildBlessingEffects(instance) : [];
  return {
    equip_attributes: attrs,
    base_attributes: baseAttrs,
    equip_level: equipLevel,
    level: equipLevel,
    enhance_level: instance.enhance_level ?? 0,
    main_value: instance.main_value ?? 0,
    main_value_2: instance.main_value_2 ?? 0,
    blessing_level: instance.blessing_level ?? 0,
    pos: instance.pos,
    blessing_effects: blessingEffects.length > 0 ? blessingEffects : undefined,
  };
}

/**
 * 从 equip_base 构建兜底装备详情（instance 不存在时使用，如拍卖行）
 */
export function enrichEquipFromBase(equipBase: any): EquipDetail {
  const attrs = {
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
  return {
    equip_attributes: attrs,
    base_attributes: { ...attrs },
    equip_level: (equipBase as any).base_level ?? 1,
    level: (equipBase as any).base_level ?? 1,
    enhance_level: 0,
    main_value: 0,
    main_value_2: 0,
    blessing_level: 0,
    pos: (equipBase as any).pos ?? 1,
  };
}

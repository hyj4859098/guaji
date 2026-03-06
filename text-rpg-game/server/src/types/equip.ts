/**
 * 装备基础属性模板（equip_base 表）
 * 主属性由 utils/equip.ts 的 getEquipMainAttr(pos) 按部位计算，不存库。
 */
export interface EquipBase {
  id: number;
  item_id: number;
  pos: number;
  base_level: number;
  base_hp: number;
  base_phy_atk: number;
  base_phy_def: number;
  base_mp: number;
  base_mag_def: number;
  base_mag_atk: number;
  base_hit_rate: number;
  base_dodge_rate: number;
  base_crit_rate: number;
  create_time: number;
  update_time: number;
}

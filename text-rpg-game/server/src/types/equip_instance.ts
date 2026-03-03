/**
 * 装备实例 - 每件装备唯一，支持主属性浮动、强化、祝福
 */
export interface EquipInstance {
  id: number;
  uid: number | string;
  item_id: number;
  pos: number;
  /** 主属性值（掉落时 ±20% 浮动，强化只加此值） */
  main_value: number;
  /** 武器双主属性时：mag_atk，其他部位为 0 */
  main_value_2: number;
  enhance_level: number;
  /** 祝福等级（每次祝福成功 +1） */
  blessing_level: number;
  create_time: number;
  update_time: number;
}

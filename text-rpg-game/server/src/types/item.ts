import { IBase } from './index';

/** 物品定义（item 表） */
export interface Item extends IBase {
  name: string;
  type: number;
  description?: string;
  /** 消耗品回血量 */
  hp_restore?: number;
  /** 消耗品回蓝量 */
  mp_restore?: number;
  /** 旧字段（兼容），优先读 hp_restore */
  hp?: number;
  /** 旧字段（兼容），优先读 mp_restore */
  mp?: number;
  /** 装备部位（type=2 时有效） */
  pos?: number;
  /** 装备等级要求 */
  level?: number;
  /** 增益类别（type=5 多倍卡：exp/gold/drop/reputation） */
  boost_category?: string;
  /** 增益倍数键（x2/x4/x8） */
  boost_key?: string;
  /** 增益充次（多倍卡使用后增加的战斗次数） */
  boost_charges?: number;
  /** 效果列表 ID */
  effect_id?: number;
  price?: number;
}

/** 装备实例（equip_instance 表），每件装备独立一条记录 */
export interface EquipInstance {
  id: number;
  uid: number | string;
  item_id: number;
  equip_base_id?: number;
  enhance_level?: number;
  blessing_level?: number;
  random_attrs?: Record<string, number>;
  create_time: number;
  update_time: number;
}

/** 背包物品（bag 表） */
export interface BagItem extends IBase {
  uid: number | string;
  item_id: number;
  count: number;
  /** 装备实例 uid（type=2 时有值） */
  equipment_uid?: string;
  /** 原始 id（合并后可能变化） */
  original_id?: number;
}

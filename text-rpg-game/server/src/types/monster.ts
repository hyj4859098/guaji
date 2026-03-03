/** 怪物掉落配置 */
export interface MonsterDropItem {
  item_id: number;  // 装备 item_id（需在 equip_base 中存在）
  prob: number;    // 掉落概率 0-100
}

export interface Monster {
  id: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  phy_atk: number;
  phy_def: number;
  mag_atk: number;
  mag_def: number;
  skill1: string;
  skill2: string;
  hit_rate: number;
  dodge_rate: number;
  crit_rate: number;
  exp: number;
  gold: number;
  reputation: number;
  map_id: number;
  /** 掉落装备列表，每项独立概率判定 */
  drop_items?: MonsterDropItem[];
  /** 五行属性 */
  elem_metal?: number;
  elem_wood?: number;
  elem_water?: number;
  elem_fire?: number;
  elem_earth?: number;
  create_time: number;
  update_time: number;
}

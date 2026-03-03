import { IUserBase } from './index';

export interface Equip extends IUserBase {
  item_id: number;
  pos: number;
  equipment_uid: string;
  level: number;
  enhancement_level: number;
  enchantments: string | null;
  hp: number;
  phy_atk: number;
  phy_def: number;
  mp: number;
  mag_def: number;
  mag_atk: number;
  hit_rate: number;
  dodge_rate: number;
  crit_rate: number;
}

export interface EquipBase {
  id: number;
  item_id: number;
  pos: number;
  main_attr: string;
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

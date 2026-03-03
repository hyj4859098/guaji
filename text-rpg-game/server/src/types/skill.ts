import { IUserBase } from './index';

// 技能类型（与数据库一致：0=物理，1=魔法）
export enum SkillTypeEnum {
  PHYSICAL = 0, // 物理伤害
  MAGIC = 1    // 魔法伤害
}

// 技能接口（仅用 id 作为主键，与 IBase 一致）
export interface Skill extends IUserBase {
  name: string; // 技能名称
  type: SkillTypeEnum; // 技能类型
  cost: number; // 技能消耗
  damage: number; // 技能伤害
  probability: number; // 技能概率
  book_id: number; // 技能书ID
  is_equipped: number; // 是否装备 (0: 未装备, 1: 已装备)
}

// 玩家技能接口
export interface PlayerSkill extends IUserBase {
  skill_id: number; // 技能ID
  level: number; // 技能等级
  exp: number; // 技能经验
  is_equipped: number; // 是否装备 (0: 未装备, 1: 已装备)
}

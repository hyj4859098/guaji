import { SkillModel, PlayerSkillModel } from '../model/skill.model';
import { Skill, SkillTypeEnum } from '../types/skill';
import { IBaseService, Id, Uid } from '../types/index';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { cacheService } from './cache.service';

export class SkillService implements IBaseService<Skill> {
  private skillModel: SkillModel;
  private playerSkillModel: PlayerSkillModel;

  constructor() {
    this.skillModel = new SkillModel();
    this.playerSkillModel = new PlayerSkillModel();
  }

  async get(id: Id, ctx?: any): Promise<Skill | null> {
    return await this.skillModel.get(id, ctx);
  }

  async list(uid?: Uid, ctx?: any): Promise<any[]> {
    if (uid) {
      // 从数据库获取
      const playerSkills = await this.playerSkillModel.listByUid(uid, ctx);
      
      const skillsWithDetails = await Promise.all(playerSkills.map(async (playerSkill) => {
        const skill = await this.skillModel.getBySkillId(playerSkill.skill_id, ctx);
        if (skill) {
          return {
            ...skill,
            skill_id: skill.id,
            level: playerSkill.level,
            exp: playerSkill.exp,
            is_equipped: playerSkill.is_equipped
          };
        }
        return null;
      }));
      
      return skillsWithDetails.filter(Boolean);
    } else {
      // 获取所有技能
      return await this.skillModel.list(ctx);
    }
  }

  async add(data: Omit<Skill, 'id' | 'create_time' | 'update_time'>, ctx?: any): Promise<Id> {
    return await this.skillModel.insert(data, ctx);
  }

  async update(id: Id, data: Partial<Skill>, ctx?: any): Promise<boolean> {
    return await this.skillModel.update(id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await this.skillModel.delete(id, ctx);
  }

  /**
   * 学习技能
   * @param uid 用户ID
   * @param bookId 技能书ID
   * @param bagService 背包服务（由调用方注入可避免循环依赖，未注入时内部 require）
   * @returns 是否学习成功
   */
  async learnSkill(
    uid: Uid,
    bookId: number,
    bagService?: { list: (u: Uid) => Promise<any[]>; delete: (id: number, opts?: any) => Promise<boolean> }
  ): Promise<boolean> {
    try {
      // 获取技能书对应的技能
      const skill = await this.skillModel.getByBookId(bookId);
      if (!skill) {
        throw createError(ErrorCode.ITEM_NOT_FOUND, '技能书不存在');
      }

      // 从数据库获取玩家技能列表
      const playerSkills = await this.playerSkillModel.listByUid(uid);
      
      // 检查玩家是否已学习该技能（技能书只能学习一次）
      const existingSkill = playerSkills.find((ps: any) => ps.skill_id === skill.id);
      if (existingSkill) {
        throw createError(ErrorCode.INVALID_PARAMS, '该技能已学习，无法重复学习');
      }

      // 从背包中移除技能书（必须由调用方注入 bagService，避免与 bag.service 循环依赖）
      if (!bagService) throw createError(ErrorCode.SYSTEM_ERROR, '学习技能需要背包服务');
      const bagItems = await bagService.list(uid);
      const bookItem = bagItems.find((item: any) => item.item_id === bookId);
      if (!bookItem || bookItem.count < 1) {
        throw createError(ErrorCode.ITEM_NOT_FOUND, '技能书不存在或数量不足');
      }
      
      // 从背包中删除技能书
      await bagService.delete(bookItem.original_id || bookItem.id);

      // 添加玩家技能记录到数据库
      await this.playerSkillModel.insert({
        uid: uid,
        skill_id: skill.id,
        level: 1,
        exp: 0,
        is_equipped: 0,
        create_time: Math.floor(Date.now() / 1000),
        update_time: Math.floor(Date.now() / 1000)
      });

      cacheService.equippedSkills.invalidate(uid);
      logger.info('技能学习成功', { uid, skillId: skill.id, skillName: skill.name });
      return true;
    } catch (error) {
      logger.error('学习技能失败:', error);
      throw error;
    }
  }

  /**
   * 装备技能
   * @param uid 用户ID
   * @param skillId 技能ID
   * @returns 是否装备成功
   */
  async equipSkill(uid: Uid, skillId: number): Promise<boolean> {
    try {
      // 从数据库获取玩家技能
      const playerSkills = await this.playerSkillModel.listByUid(uid);
      const targetSkill = playerSkills.find((ps: any) => ps.skill_id === skillId);
      
      if (!targetSkill) {
        throw createError(ErrorCode.SYSTEM_ERROR, '该技能未学习');
      }
      
      // 获取技能详情以确定类型
      const skill = await this.skillModel.getBySkillId(skillId);
      if (!skill) {
        throw createError(ErrorCode.SYSTEM_ERROR, '技能不存在');
      }
      
      // 检查同类型技能是否已装备（每种类型最多装备1个，0=物理 1=魔法）
      const skillType = skill.type ?? 0;
      let equippedSameType: any = null;
      for (const ps of playerSkills) {
        if (ps.is_equipped !== 1) continue;
        const s = await this.skillModel.getBySkillId(ps.skill_id);
        if (s && (s.type ?? 0) === skillType && ps.skill_id !== skillId) {
          equippedSameType = ps;
          break;
        }
      }
      if (equippedSameType) {
        await this.playerSkillModel.updateByUidAndSkillId(uid, equippedSameType.skill_id, {
          is_equipped: 0,
          update_time: Math.floor(Date.now() / 1000)
        });
        logger.info('卸下已装备的同类型技能', { uid, skillId: equippedSameType.skill_id });
      }

      // 装备技能
      await this.playerSkillModel.updateByUidAndSkillId(uid, skillId, {
        is_equipped: 1,
        update_time: Math.floor(Date.now() / 1000)
      });

      cacheService.equippedSkills.invalidate(uid);
      logger.info('技能装备成功', { uid, skillId, skillName: skill.name });
      return true;
    } catch (error) {
      logger.error('装备技能失败:', error);
      throw error;
    }
  }

  /**
   * 卸下技能
   * @param uid 用户ID
   * @param skillId 技能ID
   * @returns 是否卸下成功
   */
  async unequipSkill(uid: Uid, skillId: number): Promise<boolean> {
    try {
      // 从数据库获取玩家技能
      const playerSkills = await this.playerSkillModel.listByUid(uid);
      const targetSkill = playerSkills.find((ps: any) => ps.skill_id === skillId);
      
      if (!targetSkill) {
        throw createError(ErrorCode.SYSTEM_ERROR, '该技能未学习');
      }

      // 卸下技能
      await this.playerSkillModel.updateByUidAndSkillId(uid, skillId, {
        is_equipped: 0,
        update_time: Math.floor(Date.now() / 1000)
      });

      cacheService.equippedSkills.invalidate(uid);
      logger.info('技能卸下成功', { uid, skillId });
      return true;
    } catch (error) {
      logger.error('卸下技能失败:', error);
      throw error;
    }
  }

  /**
   * 获取玩家已装备的技能（带缓存，战斗每回合调用，减轻读库）
   * @param uid 用户ID
   * @param ctx 事务上下文（可选，事务内不读缓存）
   * @returns 已装备的技能列表
   */
  async getEquippedSkills(uid: Uid, ctx?: any): Promise<any> {
    if (!ctx) {
      const cached = cacheService.equippedSkills.get(uid);
      if (cached) return cached;
    }
    const physicalSkills = await this.playerSkillModel.listEquippedByUid(uid, SkillTypeEnum.PHYSICAL, ctx);
    const magicSkills = await this.playerSkillModel.listEquippedByUid(uid, SkillTypeEnum.MAGIC, ctx);
    const result = { physical: physicalSkills, magic: magicSkills };
    if (!ctx) cacheService.equippedSkills.set(uid, result);
    return result;
  }
}

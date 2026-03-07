import { dataStorageService } from '../service/data-storage.service';
import { getCollection } from '../config/db';
import { Skill, PlayerSkill } from '../types/skill';
import { IBaseModel, Id, Uid } from '../types/index';
import { Collections } from '../config/collections';

export class SkillModel implements IBaseModel<Skill> {
  async get(id: Id, ctx?: any): Promise<Skill | null> {
    return await dataStorageService.getById(Collections.SKILL, id, ctx);
  }

  async getBySkillId(skillId: number, ctx?: any): Promise<Skill | null> {
    return await dataStorageService.getById(Collections.SKILL, skillId, ctx);
  }

  async getByBookId(bookId: number, ctx?: any): Promise<Skill | null> {
    return await dataStorageService.getByCondition(Collections.SKILL, { book_id: bookId }, ctx);
  }

  async list(ctx?: any): Promise<Skill[]> {
    return await dataStorageService.list(Collections.SKILL, undefined, ctx);
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    return await dataStorageService.insert(Collections.SKILL, data, ctx);
  }

  async update(id: Id, data: Partial<Skill>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.SKILL, id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.SKILL, id, ctx);
  }
}

export class PlayerSkillModel implements IBaseModel<PlayerSkill> {
  async get(id: Id, ctx?: any): Promise<PlayerSkill | null> {
    return await dataStorageService.getById(Collections.PLAYER_SKILL, id, ctx);
  }

  async getByUidAndSkillId(uid: Uid, skillId: number, ctx?: any): Promise<PlayerSkill | null> {
    let doc = await dataStorageService.getByCondition(Collections.PLAYER_SKILL, { uid, skill_id: skillId }, ctx);
    if (!doc && uid != null) {
      const altUid = typeof uid === 'number' ? String(uid) : Number(uid);
      if (!Number.isNaN(altUid as number)) {
        doc = await dataStorageService.getByCondition(Collections.PLAYER_SKILL, { uid: altUid, skill_id: skillId }, ctx);
      }
    }
    return doc as PlayerSkill | null;
  }

  async listByUid(uid: Uid, ctx?: any): Promise<PlayerSkill[]> {
    let list: PlayerSkill[] = await dataStorageService.list(Collections.PLAYER_SKILL, { uid }, ctx);
    // 兼容 uid 存成字符串或数字不一致的情况
    if (list.length === 0 && uid != null) {
      if (typeof uid === 'number') {
        list = await dataStorageService.list(Collections.PLAYER_SKILL, { uid: String(uid) }, ctx);
      } else if (typeof uid === 'string' && !Number.isNaN(Number(uid))) {
        list = await dataStorageService.list(Collections.PLAYER_SKILL, { uid: Number(uid) }, ctx);
      }
    }
    return list as PlayerSkill[];
  }

  async listEquippedByUid(uid: Uid, type: number, ctx?: any): Promise<PlayerSkill[]> {
    // 先获取玩家装备的技能（兼容 uid 数字/字符串）
    let playerSkills = await dataStorageService.list(Collections.PLAYER_SKILL, { uid, is_equipped: 1 }, ctx);
    if (playerSkills.length === 0 && uid != null) {
      const altUid = typeof uid === 'number' ? String(uid) : Number(uid);
      if (!Number.isNaN(altUid as number)) {
        playerSkills = await dataStorageService.list(Collections.PLAYER_SKILL, { uid: altUid, is_equipped: 1 }, ctx);
      }
    }
    if (playerSkills.length === 0) return [];

    const skillIds = playerSkills.map(ps => ps.skill_id);
    const skills = await dataStorageService.list(Collections.SKILL, { id: { $in: skillIds }, type }, ctx);
    // 只返回类型匹配且能查到技能详情的记录，避免返回无 name 的占位导致前端显示 undefined
    return playerSkills
      .map(ps => {
        const skill = (skills as PlayerSkill[]).find(s => s.id === ps.skill_id);
        return skill ? { ...ps, ...skill } : null;
      })
      .filter((x): x is PlayerSkill => x !== null);
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    const insertData = {
      ...data,
      level: data.level || 1,
      exp: data.exp || 0,
      is_equipped: data.is_equipped || 0
    };
    return await dataStorageService.insert(Collections.PLAYER_SKILL, insertData, ctx);
  }

  async update(id: Id, data: Partial<PlayerSkill>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update(Collections.PLAYER_SKILL, id, data, ctx);
  }

  async updateByUidAndSkillId(uid: Uid, skillId: number, data: Partial<PlayerSkill>, _ctx?: any): Promise<boolean> {
    const updateData = {
      ...data,
      update_time: Math.floor(Date.now() / 1000)
    };
    
    const collection = getCollection(Collections.PLAYER_SKILL);
    let result = await collection.updateOne(
      { uid, skill_id: skillId },
      { $set: updateData }
    );
    if (result.modifiedCount === 0 && uid != null) {
      const altUid = typeof uid === 'number' ? String(uid) : Number(uid);
      if (!Number.isNaN(altUid as number)) {
        result = await collection.updateOne(
          { uid: altUid, skill_id: skillId },
          { $set: updateData }
        );
      }
    }
    return result.modifiedCount > 0;
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete(Collections.PLAYER_SKILL, id, ctx);
  }

  async deleteByUidAndSkillId(uid: Uid, skillId: number, _ctx?: any): Promise<boolean> {
    const collection = getCollection(Collections.PLAYER_SKILL);
    let result = await collection.deleteOne({ uid, skill_id: skillId });
    if (result.deletedCount === 0 && uid != null) {
      const altUid = typeof uid === 'number' ? String(uid) : Number(uid);
      if (!Number.isNaN(altUid as number)) {
        result = await collection.deleteOne({ uid: altUid, skill_id: skillId });
      }
    }
    return result.deletedCount > 0;
  }

  async deleteByUid(uid: Uid, ctx?: any): Promise<void> {
    await dataStorageService.deleteMany(Collections.PLAYER_SKILL, { uid }, ctx);
  }
}

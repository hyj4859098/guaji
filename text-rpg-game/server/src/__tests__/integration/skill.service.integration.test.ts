/**
 * SkillService 集成测试 - 真实 DB，无 mock
 * 覆盖 learnSkill、equipSkill、unequipSkill、getEquippedSkills、uid 类型兼容
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';
import { SkillService } from '../../service/skill.service';
import { PlayerSkillModel } from '../../model/skill.model';
import { BagService } from '../../service/bag.service';
import { dataStorageService } from '../../service/data-storage.service';

const app = createApp();

describe('SkillService 集成测试', () => {
  let token: string;
  let uid: number;
  const skillService = new SkillService();
  const playerSkillModel = new PlayerSkillModel();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'skl', charName: '技能测试' });
    uid = user.uid;
    token = user.token;
  }, 10000);

  describe('learnSkill / equipSkill / unequipSkill', () => {
    it('学习技能书成功', async () => {
      await request(app)
        .post('/api/admin/player/give-item')
        .set({ Authorization: `Bearer ${await getAdminToken()}` })
        .send({ uid, item_id: 14, count: 1 });
      const bagService = new BagService();
      const ok = await skillService.learnSkill(uid, 14, bagService);
      expect(ok).toBe(true);
    });

    it('重复学习同一技能书抛出 INVALID_PARAMS', async () => {
      await request(app)
        .post('/api/admin/player/give-item')
        .set({ Authorization: `Bearer ${await getAdminToken()}` })
        .send({ uid, item_id: 14, count: 1 });
      const bagService = new BagService();
      await expect(skillService.learnSkill(uid, 14, bagService)).rejects.toMatchObject({
        code: expect.any(Number),
        message: expect.stringMatching(/已学习|重复/),
      });
    });

    it('装备技能成功', async () => {
      const list = await skillService.list(uid);
      const learned = list.find((s: any) => s.skill_id != null);
      expect(learned).toBeDefined();
      const ok = await skillService.equipSkill(uid, learned!.skill_id ?? learned!.id);
      expect(ok).toBe(true);
    });

    it('getEquippedSkills 返回已装备技能', async () => {
      const equipped = await skillService.getEquippedSkills(uid);
      expect(equipped).toHaveProperty('physical');
      expect(equipped).toHaveProperty('magic');
      expect(Array.isArray(equipped.physical)).toBe(true);
      expect(Array.isArray(equipped.magic)).toBe(true);
    });

    it('卸下技能成功', async () => {
      const list = await skillService.list(uid);
      const equipped = list.find((s: any) => s.is_equipped === 1);
      expect(equipped).toBeDefined();
      const ok = await skillService.unequipSkill(uid, equipped!.skill_id ?? equipped!.id);
      expect(ok).toBe(true);
    });
  });

  describe('PlayerSkillModel uid 类型兼容', () => {
    it('listByUid 使用 string uid 时能查到 number 存储的数据', async () => {
      const listNum = await playerSkillModel.listByUid(uid);
      const listStr = await playerSkillModel.listByUid(String(uid));
      expect(listStr.length).toBe(listNum.length);
    });

    it('getByUidAndSkillId 使用 string uid 时能查到', async () => {
      const list = await playerSkillModel.listByUid(uid);
      const first = list[0];
      if (first) {
        const byStr = await playerSkillModel.getByUidAndSkillId(String(uid), first.skill_id);
        expect(byStr).not.toBeNull();
        expect(byStr?.skill_id).toBe(first.skill_id);
      }
    });

    it('listEquippedByUid 使用 string uid 时能查到', async () => {
      const list = await skillService.list(uid);
      const first = list[0];
      if (first) {
        await skillService.equipSkill(uid, first.skill_id ?? first.id);
      }
      const byNum = await playerSkillModel.listEquippedByUid(uid, 0);
      const byStr = await playerSkillModel.listEquippedByUid(String(uid), 0);
      expect(byStr.length).toBe(byNum.length);
    });
  });

  describe('错误路径', () => {
    it('equipSkill 未学习的技能抛错', async () => {
      await expect(skillService.equipSkill(uid, 99999)).rejects.toThrow();
    });

    it('unequipSkill 未装备的技能返回 false', async () => {
      const list = await skillService.list(uid);
      const unequipped = list.find((s: any) => s.is_equipped !== 1);
      if (unequipped) {
        const ok = await skillService.unequipSkill(uid, unequipped.skill_id ?? unequipped.id);
        expect(ok).toBe(false);
      }
    });
  });

  describe('分支覆盖补充', () => {
    it('unequipSkill 未学习的技能抛错', async () => {
      await expect(skillService.unequipSkill(uid, 999)).rejects.toThrow(/未学习/);
    });

    it('equipSkill 替换已装备的同类型技能', async () => {
      const adminToken = await getAdminToken();

      await request(app)
        .post('/api/admin/player/give-item')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ uid, item_id: 14, count: 1 });
      const bagService = new BagService();
      await skillService.learnSkill(uid, 14, bagService).catch(() => {});

      const list0 = await skillService.list(uid);
      const learned = list0.find((s: any) => s.skill_id != null);
      expect(learned).toBeDefined();
      await skillService.equipSkill(uid, learned!.skill_id ?? learned!.id);

      const now = Math.floor(Date.now() / 1000);
      const secondSkillId = await dataStorageService.insert('skill', {
        name: '_bm_冰箭术',
        type: 1,
        damage: 15,
        mp_cost: 4,
        book_id: 9999,
        cost: 0,
        probability: 100,
        create_time: now,
        update_time: now,
      });

      await dataStorageService.insert('player_skill', {
        uid,
        skill_id: secondSkillId,
        level: 1,
        exp: 0,
        is_equipped: 0,
        create_time: now,
        update_time: now,
      });

      const ok = await skillService.equipSkill(uid, secondSkillId);
      expect(ok).toBe(true);

      const listAfter = await skillService.list(uid);
      const first = listAfter.find((s: any) => (s.skill_id ?? s.id) === (learned!.skill_id ?? learned!.id));
      expect(first?.is_equipped).toBe(0);

      await dataStorageService.deleteMany('player_skill', { uid, skill_id: secondSkillId });
      await dataStorageService.delete('skill', secondSkillId);
    });
  });
});

async function getAdminToken(): Promise<string> {
  const res = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' });
  return res.body?.data?.token || '';
}

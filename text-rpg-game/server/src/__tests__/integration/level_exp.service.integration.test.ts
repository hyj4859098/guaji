/**
 * LevelExpService 集成测试 - 覆盖 getNextLevelExp 等
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { LevelExpService } from '../../service/level_exp.service';

const app = createApp();
const UNIQUE = `_level_exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('LevelExpService 集成测试', () => {
  let token: string;
  const levelExpService = new LevelExpService();

  beforeAll(async () => {
    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    token = reg.body.data.token;
  }, 10000);

  it('getExpByLevel 存在的等级返回数据', async () => {
    const levelExp = await levelExpService.getExpByLevel(1);
    expect(levelExp).not.toBeNull();
    expect(levelExp?.level).toBe(1);
    expect(levelExp?.exp).toBeDefined();
  });

  it('getExpByLevel 不存在的等级返回 null', async () => {
    const levelExp = await levelExpService.getExpByLevel(99999);
    expect(levelExp).toBeNull();
  });

  it('getNextLevelExp 下一级存在时返回经验值', async () => {
    const exp = await levelExpService.getNextLevelExp(1);
    expect(exp).toBeGreaterThan(0);
  });

  it('getNextLevelExp 下一级不存在时返回 0', async () => {
    const exp = await levelExpService.getNextLevelExp(99998);
    expect(exp).toBe(0);
  });
});

describe('BossModel 集成测试', () => {
  it('list 返回 Boss 列表按 level 排序', async () => {
    const { BossModel } = await import('../../model/boss.model');
    const bossModel = new BossModel();
    const list = await bossModel.list();
    expect(Array.isArray(list)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect((list[i].level ?? 0)).toBeGreaterThanOrEqual(list[i - 1].level ?? 0);
    }
  });
});

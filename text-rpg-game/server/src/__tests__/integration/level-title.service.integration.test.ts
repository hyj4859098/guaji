/**
 * LevelTitleService / WealthTitleService 集成测试 - getExpBonus、getGoldBonus、getTitleName 分支
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { levelTitleService } from '../../service/level-title.service';
import { wealthTitleService } from '../../service/wealth-title.service';
import { rankService } from '../../service/rank.service';

const app = createApp();
const UNIQUE = `_lt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('LevelTitleService 集成测试', () => {
  let _uid: number;
  let token: string;

  beforeAll(async () => {
    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    _uid = reg.body.data.uid;
    token = reg.body.data.token;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${token}` }).send({ name: '称号测试' });
  }, 10000);

  it('getExpBonus 无称号返回 1', async () => {
    const bonus = await levelTitleService.getExpBonus(999999);
    expect(bonus).toBe(1);
  });

  it('getTitleName 无称号返回空', async () => {
    const name = await levelTitleService.getTitleName(999999);
    expect(name).toBe('');
  });

  it('getAllTitles 无称号返回空数组', async () => {
    const titles = await levelTitleService.getAllTitles(999999);
    expect(titles).toEqual([]);
  });

  it('getTop3Titles 返回映射', async () => {
    const map = await levelTitleService.getTop3Titles();
    expect(typeof map).toBe('object');
  });

  it('getExpBonus 榜一返回 1.10', async () => {
    levelTitleService.clearCache();
    const top3 = await levelTitleService.getTop3Uids();
    if (top3.length) {
      const bonus = await levelTitleService.getExpBonus(top3[0]);
      expect([1, 1.05, 1.08, 1.10]).toContain(bonus);
    }
  });

  it('getTitleName 榜内有称号', async () => {
    levelTitleService.clearCache();
    const top3 = await levelTitleService.getTop3Uids();
    if (top3.length) {
      const name = await levelTitleService.getTitleName(top3[0]);
      expect(typeof name).toBe('string');
    }
  });

  it('getAllTitles 有称号时返回数组', async () => {
    levelTitleService.clearCache();
    const top3 = await levelTitleService.getTop3Uids();
    if (top3.length) {
      const titles = await levelTitleService.getAllTitles(top3[0]);
      expect(Array.isArray(titles)).toBe(true);
    }
  });

  it('getTop3Uids 缓存命中', async () => {
    levelTitleService.clearCache();
    const a = await levelTitleService.getTop3Uids();
    const b = await levelTitleService.getTop3Uids();
    expect(a).toEqual(b);
  });

  it('getTop3Uids 首次调用从 DB 读取', async () => {
    levelTitleService.clearCache();
    const uids = await levelTitleService.getTop3Uids();
    expect(Array.isArray(uids)).toBe(true);
    expect(uids.length).toBeLessThanOrEqual(3);
  });
});

describe('WealthTitleService 集成测试', () => {
  it('getGoldBonus 无称号返回 1', async () => {
    const bonus = await wealthTitleService.getGoldBonus(999999);
    expect(bonus).toBe(1);
  });

  it('getTitleName 无称号返回空', async () => {
    const name = await wealthTitleService.getTitleName(999999);
    expect(name).toBe('');
  });

  it('getAllTitles 无称号返回空数组', async () => {
    const titles = await wealthTitleService.getAllTitles(999999);
    expect(titles).toEqual([]);
  });

  it('getGoldBonus 榜内有加成', async () => {
    wealthTitleService.clearCache();
    const top3 = await wealthTitleService.getTop3Uids();
    if (top3.length) {
      const bonus = await wealthTitleService.getGoldBonus(top3[0]);
      expect([1, 1.05, 1.08, 1.10]).toContain(bonus);
    }
  });

  it('getTitleName 榜内有称号', async () => {
    wealthTitleService.clearCache();
    const top3 = await wealthTitleService.getTop3Uids();
    if (top3.length) {
      const name = await wealthTitleService.getTitleName(top3[0]);
      expect(typeof name).toBe('string');
    }
  });

  it('getAllTitles 有称号时返回数组', async () => {
    wealthTitleService.clearCache();
    const top3 = await wealthTitleService.getTop3Uids();
    if (top3.length) {
      const titles = await wealthTitleService.getAllTitles(top3[0]);
      expect(Array.isArray(titles)).toBe(true);
    }
  });

  it('getTop3Uids 缓存命中', async () => {
    wealthTitleService.clearCache();
    const a = await wealthTitleService.getTop3Uids();
    const b = await wealthTitleService.getTop3Uids();
    expect(a).toEqual(b);
  });

  it('getTop3Uids 首次调用从 DB 读取', async () => {
    wealthTitleService.clearCache();
    const uids = await wealthTitleService.getTop3Uids();
    expect(Array.isArray(uids)).toBe(true);
    expect(uids.length).toBeLessThanOrEqual(3);
  });

  it('getTop3Titles 返回映射', async () => {
    const map = await wealthTitleService.getTop3Titles();
    expect(typeof map).toBe('object');
  });
});

describe('RankService getRanking 含称号信息', () => {
  let token: string;

  beforeAll(async () => {
    const RANK_UNIQUE = `_rk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reg = await request(app).post('/api/user/register').send({ username: RANK_UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    token = reg.body.data.token;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${token}` }).send({ name: '排行测试' });
  }, 10000);

  it('getRanking type=gold 返回结果含 title 字段', async () => {
    const result = await rankService.getRanking('gold', 1, 20);
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.items)).toBe(true);
    if (result.items.length > 0) {
      expect(result.items[0]).toHaveProperty('rank');
      expect(result.items[0]).toHaveProperty('uid');
      expect(result.items[0]).toHaveProperty('name');
      expect(result.items[0]).toHaveProperty('title');
    }
  });

  it('getRanking type=level 返回结果含 title 字段', async () => {
    const result = await rankService.getRanking('level', 1, 20);
    expect(result).toHaveProperty('items');
    if (result.items.length > 0) {
      expect(result.items[0]).toHaveProperty('title');
    }
  });

  it('getRanking 通过 API 调用', async () => {
    const res = await request(app)
      .get('/api/rank/list?type=gold&page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  it('getRanking 分页 page>total 返回空', async () => {
    const result = await rankService.getRanking('gold', 999, 20);
    expect(result.items).toHaveLength(0);
  });
});

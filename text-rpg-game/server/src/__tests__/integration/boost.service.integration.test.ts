/**
 * BoostService 集成测试 - useBoostCard、toggleBoost、consumeCharges
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';
import { BoostService } from '../../service/boost.service';
import { BagService } from '../../service/bag.service';

const app = createApp();
const UNIQUE = `_boost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('BoostService 集成测试', () => {
  let uid: number;
  let adminToken: string;
  const boostService = new BoostService();

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = adminRes.body.data?.token;
    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    uid = reg.body.data.uid;
    await request(app).post('/api/player/add').set('Authorization', `Bearer ${reg.body.data.token}`).send({ name: '多倍卡测试' });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: 101, count: 2 });
  }, 10000);

  it('useBoostCard 使用多倍卡成功', async () => {
    const ok = await boostService.useBoostCard(uid, 101, 1);
    expect(ok).toBe(true);
    const config = await boostService.getBoostConfig(uid);
    expect(config.exp.x2.charges).toBeGreaterThanOrEqual(100);
  });

  it('toggleBoost 开启多倍', async () => {
    const ok = await boostService.toggleBoost(uid, 'exp', 'x2', true);
    expect(ok).toBe(true);
  });

  it('consumeCharges 消耗一次', async () => {
    const before = await boostService.getBoostConfig(uid);
    const beforeCharges = before.exp.x2.charges;
    await boostService.consumeCharges(uid);
    const after = await boostService.getBoostConfig(uid);
    expect(after.exp.x2.charges).toBe(beforeCharges - 1);
  });

  it('useBoostCard 非多倍卡返回 false', async () => {
    const ok = await boostService.useBoostCard(uid, 1, 1);
    expect(ok).toBe(false);
  });

  it('toggleBoost 无效参数返回 false', async () => {
    const ok = await boostService.toggleBoost(uid, 'invalid' as any, 'x2', true);
    expect(ok).toBe(false);
  });
});

describe('关键路径/深度分支', () => {
  const _boostService = new BoostService();
  const _bagService = new BagService();

  it('使用多倍卡后次数增加', async () => {
    const { uid, token } = await createTestUser(app, { prefix: 'p0', suffix: 'boost_use' });

    const configBefore = await _boostService.getBoostConfig(uid);
    const beforeCharges = configBefore?.exp?.x2?.charges ?? 0;

    await _bagService.addItem(uid, 101, 1);
    const bags = await _bagService.list(uid);
    const boostItem = bags.find((b: any) => b.item_id === 101);
    if (boostItem) {
      const bagId = boostItem.original_id ?? boostItem.id;
      await request(app).post('/api/bag/use').set('Authorization', `Bearer ${token}`).send({ id: bagId, count: 1 });

      const configAfter = await _boostService.getBoostConfig(uid);
      const afterCharges = configAfter?.exp?.x2?.charges ?? 0;
      expect(afterCharges).toBeGreaterThan(beforeCharges);
    }
  });

  it('开关切换生效', async () => {
    const { uid: _uid, token } = await createTestUser(app, { prefix: 'p0', suffix: 'boost_toggle' });

    const res = await request(app)
      .post('/api/boost/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'exp', multiplier: 'x2', enabled: true });
    expect(res.body.code).toBe(0);
    expect(res.body.data.exp.x2.enabled).toBe(true);

    const res2 = await request(app)
      .post('/api/boost/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'exp', multiplier: 'x2', enabled: false });
    expect(res2.body.code).toBe(0);
    expect(res2.body.data.exp.x2.enabled).toBe(false);
  });
});

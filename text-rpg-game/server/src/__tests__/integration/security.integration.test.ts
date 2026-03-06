/**
 * 防漏洞集成测试 - 负向参数、异常值、越权
 * 统一到 Jest，计入覆盖率
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, adminLogin } from '../../__test-utils__/integration-helpers';

const app = createApp();

describe('防漏洞集成测试', () => {
  let token: string;
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'sec', charName: '安全测试' });
    token = user.token;
    uid = user.uid;
    const adminToken = await adminLogin(app);
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: 6, count: 2 });
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('角色名 NoSQL 注入应拒绝', async () => {
    const res = await request(app)
      .post('/api/player/add')
      .set(auth())
      .send({ name: '{ "$gt": "" }' });
    expect(res.body.code).not.toBe(0);
  });

  it('bag/add 已移除应 404', async () => {
    const res = await request(app)
      .post('/api/bag/add')
      .set(auth())
      .send({ item_id: 1, count: 1 });
    expect(res.status).toBe(404);
  });

  it('商店购买 count=-1 应拒绝', async () => {
    const shopRes = await request(app).get('/api/shop/list').set(auth());
    const first = shopRes.body.data?.[0];
    if (first) {
      const res = await request(app)
        .post('/api/shop/buy')
        .set(auth())
        .send({ shop_item_id: first.id, count: -1 });
      expect(res.body.code).not.toBe(0);
    }
  });

  it('商店购买 count=0 应拒绝', async () => {
    const shopRes = await request(app).get('/api/shop/list').set(auth());
    const first = shopRes.body.data?.[0];
    if (first) {
      const res = await request(app)
        .post('/api/shop/buy')
        .set(auth())
        .send({ shop_item_id: first.id, count: 0 });
      expect(res.body.code).not.toBe(0);
    }
  });

  it('拍卖上架负价格应拒绝', async () => {
    const bagRes = await request(app).get('/api/bag/list').set(auth());
    const stone = bagRes.body.data?.items?.find((i: any) => i.item_id === 6);
    if (stone) {
      const res = await request(app)
        .post('/api/auction/list')
        .set(auth())
        .send({ bag_id: stone.original_id ?? stone.id, count: 1, price: -100 });
      expect(res.body.code).not.toBe(0);
    }
  });

  it('无效 shop_item_id 应拒绝', async () => {
    const res = await request(app)
      .post('/api/shop/buy')
      .set(auth())
      .send({ shop_item_id: 999999, count: 1 });
    expect(res.body.code).not.toBe(0);
  });

  it('无效 auction_id 应拒绝', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set(auth())
      .send({ auction_id: 999999, count: 1 });
    expect(res.body.code).not.toBe(0);
  });

  it('拍卖购买 count=-1 应拒绝', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set(auth())
      .send({ auction_id: 1, count: -1 });
    expect(res.body.code).not.toBe(0);
  });

  it('更新他人角色应拒绝', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set(auth())
      .send({ id: 1, gold: 999999 });
    expect(res.body.code).not.toBe(0);
  });

  it('无 token 访问敏感接口应拒绝', async () => {
    const res = await request(app).get('/api/bag/list');
    expect(res.body.code).not.toBe(0);
  });
});

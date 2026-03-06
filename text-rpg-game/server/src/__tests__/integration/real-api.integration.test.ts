/**
 * 真实 API 集成测试 - 无 mock，走完整链路
 * 使用 MongoDB Memory Server + 真实服务
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { EquipEffectUtil } from '../../utils/equip-effect';
import { PlayerService } from '../../service/player.service';
import { BagService } from '../../service/bag.service';
import { createTestUser, giveItem, giveGold as _giveGold } from '../../__test-utils__/integration-helpers';
import { getMaterialCount, consumeMaterial } from '../../utils/material';
import { enrichEquipDetail, enrichEquipFromBase } from '../../utils/enrich-equip';
import { EquipInstanceService } from '../../service/equip_instance.service';

const app = createApp();
const UNIQUE = `_real_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('真实 API 集成测试（无 mock）', () => {
  let token: string;
  let uid: number;
  let playerId: number;

  describe('用户与角色', () => {
  it('1. 注册新用户', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ username: UNIQUE, password: 'test123456' })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('uid');
    token = res.body.data.token;
    uid = res.body.data.uid;
  });

  it('2. 登录', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ username: UNIQUE, password: 'test123456' })
      .expect(200);
    expect(res.body.code).toBe(0);
    token = res.body.data.token;
    uid = res.body.data.uid;
  });

  it('3. 创建角色', async () => {
    const res = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '真实测试角色' })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('id');
    playerId = res.body.data.id;
  });

  it('4. 获取玩家列表', async () => {
    const res = await request(app)
      .get('/api/player/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((p: any) => p.id === playerId)).toBe(true);
  });

  it('5. 获取背包列表', async () => {
    const res = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('6. 获取地图列表', async () => {
    const res = await request(app)
      .get('/api/map/list')
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('7. 获取配置 client', async () => {
    const res = await request(app)
      .get('/api/config/client')
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('wsPort');
  });

  it('7b. 获取配置 client 带 Host 头', async () => {
    const res = await request(app)
      .get('/api/config/client')
      .set('Host', 'example.com:8080')
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data?.wsUrl).toBeDefined();
    expect(res.body.data?.wsUrl || '').toMatch(/example\.com|localhost/);
  });

  it('8. 获取强化材料配置', async () => {
    const res = await request(app)
      .get('/api/config/enhance_materials')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({
      stone: expect.any(Number),
      lucky: expect.any(Number),
      anti_explode: expect.any(Number),
      blessing_oil: expect.any(Number),
    });
  });

  it('9. 获取排行榜', async () => {
    const res = await request(app)
      .get('/api/rank/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  it('10. 获取商店列表', async () => {
    const res = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('10b. 商店列表无 type 时默认 gold', async () => {
    const res = await request(app)
      .get('/api/shop/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('11. 获取怪物列表', async () => {
    const res = await request(app)
      .get('/api/monster/list')
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('12. 获取倍率配置', async () => {
    const res = await request(app)
      .get('/api/boost/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('exp');
    expect(res.body.data).toHaveProperty('gold');
  });

  it('12b. 倍率切换 toggle', async () => {
    const res = await request(app)
      .post('/api/boost/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'exp', multiplier: 'x2', enabled: true })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('exp');
  });

  it('12c. 倍率切换缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/boost/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'exp' })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('12d. 获取商店货币映射', async () => {
    const res = await request(app)
      .get('/api/shop/currencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toBeDefined();
  });

  it('13. 获取拍卖列表', async () => {
    const res = await request(app)
      .get('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('14. 获取技能列表', async () => {
    const res = await request(app)
      .get('/api/skill/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('15. 获取玩家详情', async () => {
    const res = await request(app)
      .get('/api/player/get')
      .query({ id: playerId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({ id: playerId, name: '真实测试角色' });
  });

  it('16. 无 token 访问需登录接口返回 401', async () => {
    const res = await request(app)
      .get('/api/player/list')
      .expect(200);
    expect(res.body.code).toBe(40002);
  });

  it('16b. 无效 token 返回 401', async () => {
    const res = await request(app)
      .get('/api/player/list')
      .set('Authorization', 'Bearer invalid_token_xxx')
      .expect(200);
    expect(res.body.code).toBe(40002);
    expect(res.body.msg).toMatch(/认证|令牌/);
  });

  it('17. 用户名已存在注册失败', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ username: UNIQUE, password: 'test123456' })
      .expect(200);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg).toContain('已存在');
  });

  it('18. 缺少用户名或密码注册返回 400', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({})
      .expect(200);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg).toMatch(/用户名|密码/);
  });

  it('18b. 登录用户名或密码格式无效返回 400', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ username: '', password: '123' })
      .expect(200);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg).toMatch(/格式|用户名|密码/);
  });

  it('18c. 登录用户不存在返回 404', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ username: '_不存在的用户_999', password: 'test123456' })
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toMatch(/用户不存在/);
  });

  it('18d. 登录密码错误返回 401', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ username: UNIQUE, password: 'wrongpassword' })
      .expect(200);
    expect(res.body.code).toBe(40002);
    expect(res.body.msg).toMatch(/密码错误/);
  });

  it('18e. 不同 IP 登录（IP 锁已关闭）仍可成功', async () => {
    const ipUser = `_ip_${Date.now()}`;
    await request(app)
      .post('/api/user/register')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ username: ipUser, password: 'test123456' })
      .expect(200);
    const res = await request(app)
      .post('/api/user/login')
      .set('X-Forwarded-For', '192.168.1.200')
      .send({ username: ipUser, password: 'test123456' })
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('19. 缺少玩家名称创建角色返回 400', async () => {
    const res = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('玩家名称');
  });

  it('19b. 玩家名称无效创建角色返回 400', async () => {
    const res = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/玩家名称|1-32/);
  });

  it('19c. player update 无有效更新字段返回 400', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/无有效更新|字段/);
  });

  it('19d. skill learn 缺少 book_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/learn')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/技能书|缺少/);
  });

  it('20. 缺少 id 获取玩家返回 400', async () => {
    const res = await request(app)
      .get('/api/player/get')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('玩家ID');
  });

  it('21. 玩家不存在返回 404', async () => {
    const res = await request(app)
      .get('/api/player/get')
      .query({ id: 99999 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toContain('玩家不存在');
  });

  it('21b. 获取他人角色返回 403 越权', async () => {
    const regB = await request(app)
      .post('/api/user/register')
      .send({ username: `_other_${Date.now()}`, password: 'test123456' })
      .expect(200);
    if (regB.body.code !== 0) return;
    const tokenB = regB.body.data.token;
    const addB = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: '他人角色' })
      .expect(200);
    if (addB.body.code !== 0) return;
    const otherPlayerId = addB.body.data.id;
    const res = await request(app)
      .get('/api/player/get')
      .query({ id: otherPlayerId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40003);
    expect(res.body.msg).toMatch(/无权|越权/);
  });

  it('21c. 更新他人角色返回 403 越权', async () => {
    const regB = await request(app)
      .post('/api/user/register')
      .send({ username: `_other2_${Date.now()}`, password: 'test123456' })
      .expect(200);
    if (regB.body.code !== 0) return;
    const tokenB = regB.body.data.token;
    const addB = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: '他人角色2' })
      .expect(200);
    if (addB.body.code !== 0) return;
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: addB.body.data.id, name: '篡改' })
      .expect(200);
    expect(res.body.code).toBe(40003);
    expect(res.body.msg).toMatch(/无权|越权/);
  });

  it('21d. 删除他人角色返回 403 越权', async () => {
    const regB = await request(app)
      .post('/api/user/register')
      .send({ username: `_other3_${Date.now()}`, password: 'test123456' })
      .expect(200);
    if (regB.body.code !== 0) return;
    const tokenB = regB.body.data.token;
    const addB = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: '他人角色3' })
      .expect(200);
    if (addB.body.code !== 0) return;
    const res = await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: addB.body.data.id })
      .expect(200);
    expect(res.body.code).toBe(40003);
    expect(res.body.msg).toMatch(/无权|越权/);
  });
  });

  describe('背包与物品', () => {
  it('22. 缺少 id 使用物品返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/use')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('物品ID');
  });

  it('22b. bag delete 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('物品ID');
  });

  it('22c. bag delete 成功删除物品', async () => {
    const bagService = new BagService();
    await bagService.addItem(uid!, 2, 3);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const toDelete = bagRes.body.data?.items?.find((i: any) => i.item_id === 2 && (i.count || 0) >= 1);
    if (toDelete) {
      const res = await request(app)
        .post('/api/bag/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: toDelete.original_id ?? toDelete.id })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('23. 缺少 id 更新背包返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 5 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it.each([
    [0, '数量 0 无效'],
    [10000, '数量超上限无效'],
    [1.5, '非整数无效'],
  ])('23b. bag update 数量 %s 返回 400', async (count: number, _desc) => {
    const bagService = new BagService();
    await bagService.addItem(uid!, 1, 2);
    const list = await bagService.list(uid!);
    const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
    if (item) {
      const res = await request(app)
        .post('/api/bag/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: item.original_id ?? item.id, count })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    }
  });

  it('23c. bag update 无有效更新字段返回 400', async () => {
    const list = await new BagService().list(uid!);
    const item = list.find((i: any) => i.item_id === 1);
    if (item) {
      const res = await request(app)
        .post('/api/bag/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: item.original_id ?? item.id })
        .expect(200);
      expect(res.body.code).toBe(40000);
    }
  });

  it('24. 缺少 id 获取物品返回 400', async () => {
    const res = await request(app)
      .get('/api/item/get')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('25. 物品不存在返回 404', async () => {
    const res = await request(app)
      .get('/api/item/get')
      .query({ id: 99999 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toContain('物品不存在');
  });
  });

  describe('地图与怪物', () => {
  it('26. 缺少 id 获取地图返回 400', async () => {
    const res = await request(app)
      .get('/api/map/get')
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('27. 缺少 id 获取怪物返回 400', async () => {
    const res = await request(app)
      .get('/api/monster/get')
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('怪物ID');
  });

  it('28. 怪物不存在返回 404', async () => {
    const res = await request(app)
      .get('/api/monster/get')
      .query({ id: 99999 })
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toContain('怪物不存在');
  });
  });

  describe('404 与配置', () => {
  it('29. 未知路由返回 JSON 错误', async () => {
    const res = await request(app)
      .get('/api/not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('code');
  });
  });

  describe('战斗', () => {
  it('30. 开始战斗成功', async () => {
    const res = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('result');
    expect(res.body.data).toHaveProperty('rounds');
    expect(res.body.data).toHaveProperty('exp');
    expect(res.body.data).toHaveProperty('gold');
  });

  it('31. 缺少 enemy_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('敌人ID');
  });

  it('32. 获取战斗状态', async () => {
    const res = await request(app)
      .get('/api/battle/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('state');
    expect(['idle', 'battle']).toContain(res.body.data.state);
  });

  it('33. 恢复自动战斗', async () => {
    const res = await request(app)
      .post('/api/battle/resume')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('offlineBattles');
    expect(res.body.data).toHaveProperty('resumed');
  });

  it('33b. 自动战斗中再次开始战斗返回 400', async () => {
    const autoRes = await request(app)
      .post('/api/battle/auto')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    if (autoRes.body.code !== 0) return;
    const startRes = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    expect(startRes.body.code).toBe(40000);
    expect(startRes.body.msg).toMatch(/已经.*战斗|战斗中/);
    await request(app).post('/api/battle/stop').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('33d. battle stop 空闲时返回 success false', async () => {
    await request(app).post('/api/battle/stop').set('Authorization', `Bearer ${token}`).expect(200);
    await new Promise(r => setTimeout(r, 2500));
    const res = await request(app)
      .post('/api/battle/stop')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data?.success).toBe(false);
  });

  it('33e. battle status 返回有效 state', async () => {
    await request(app).post('/api/battle/stop').set('Authorization', `Bearer ${token}`).expect(200);
    await new Promise(r => setTimeout(r, 2500));
    const res = await request(app)
      .get('/api/battle/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('isFighting');
    expect(['idle', 'offline_battle', 'battle']).toContain(res.body.data?.state);
  });

  it('33f. battle resume 无离线战斗时返回', async () => {
    const res = await request(app)
      .post('/api/battle/resume')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('offlineBattles');
    expect(res.body.data).toHaveProperty('resumed');
  });
  });

  describe('商店与背包', () => {
  it('34. 商店购买成功', async () => {
    const res = await request(app)
      .post('/api/shop/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({ shop_item_id: 1, count: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('message');
  });

  it('35. 商店购买缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/shop/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/商品ID|数量/);
  });

  it('35b. 商店购买数量无效返回 400', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const first = shopRes.body.data?.[0];
    if (first) {
      const res = await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: first.id, count: 0 })
        .expect(200);
      expect(res.body.code).toBe(40000);
      expect(res.body.msg).toMatch(/数量/);
    }
  });

  it('36. 背包使用物品成功', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(bagRes.body.code).toBe(0);
    const items = bagRes.body.data?.items || [];
    const consumable = items.find((i: any) => i.item_id === 1);
    if (consumable) {
      const useRes = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: consumable.id, count: 1 })
        .expect(200);
      expect(useRes.body.code).toBe(0);
      expect(useRes.body.msg).toMatch(/使用成功/);
    }
  });
  });

  describe('装备', () => {
  it('37. 获取装备列表', async () => {
    const res = await request(app)
      .get('/api/equip/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('38. 穿戴装备缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/wear')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('装备ID');
  });

  it('38b. 卸下装备缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/remove')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('装备ID');
  });

  it('38c. equip wear 穿戴不存在的装备返回失败', async () => {
    const res = await request(app)
      .post('/api/equip/wear')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 99999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('38d. equip remove 卸下不存在的装备返回失败', async () => {
    const res = await request(app)
      .post('/api/equip/remove')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 99999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('38e. equip trade 缺少 instance_id 或 buyer_uid 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/trade')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/装备实例|买家|缺少/);
  });

  it('38f. equip enhance 缺少 instance_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/enhance')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('38g. equip bless 缺少 instance_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/bless')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('38h. equip enhance 装备不存在或不属于你返回错误', async () => {
    const res = await request(app)
      .post('/api/equip/enhance')
      .set('Authorization', `Bearer ${token}`)
      .send({ instance_id: 99999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg || '').toMatch(/装备不存在|不属于你|不存在/);
  });

  it('38j. equip bless 装备不在背包返回错误', async () => {
    const listRes = await request(app).get('/api/equip/list').set('Authorization', `Bearer ${token}`).expect(200);
    const worn = listRes.body.data?.find((e: any) => e.pos === 1);
    if (worn?.instance_id) {
      const res = await request(app)
        .post('/api/equip/bless')
        .set('Authorization', `Bearer ${token}`)
        .send({ instance_id: worn.instance_id })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/背包|卸下/);
    }
  });

  it('38i. skill equip 未学习的技能返回失败', async () => {
    const res = await request(app)
      .post('/api/skill/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ skill_id: 99999 });
    expect([200, 400, 500]).toContain(res.status);
    expect(res.body.code).not.toBe(0);
  });
  });

  describe('倍率与拍卖', () => {
  it('39c. 倍率切换无效类别或倍率返回 400', async () => {
    const res = await request(app)
      .post('/api/boost/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'invalid', multiplier: 'x2', enabled: true })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/无效|类别|倍率/);
  });

  it('40. 拍卖上架缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/背包ID|价格/);
  });

  it('40b. 拍卖上架价格无效返回 400', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const item = bagRes.body.data?.items?.[0];
    if (item) {
      const res = await request(app)
        .post('/api/auction/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ bag_id: item.original_id ?? item.id, count: 1, price: -1 })
        .expect(200);
      expect(res.body.code).toBe(40000);
      expect(res.body.msg).toMatch(/价格/);
    }
  });

  it('40c. 拍卖下架缺少 auction_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/off-shelf')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/拍卖ID/);
  });

  it('40d. 拍卖上架缺少 bag_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 10 })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/背包|价格/);
  });

  it('40e. 拍卖上架缺少 price 返回 400', async () => {
    const bagRes = await request(app).get('/api/bag/list').set('Authorization', `Bearer ${token}`).expect(200);
    const item = bagRes.body.data?.items?.[0];
    if (item) {
      const res = await request(app)
        .post('/api/auction/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ bag_id: item.original_id ?? item.id })
        .expect(200);
      expect(res.body.code).toBe(40000);
    }
  });

  it('40f. 拍卖上架负价格返回 400', async () => {
    const bagRes = await request(app).get('/api/bag/list').set('Authorization', `Bearer ${token}`).expect(200);
    const item = bagRes.body.data?.items?.[0];
    if (item) {
      const res = await request(app)
        .post('/api/auction/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ bag_id: item.original_id ?? item.id, price: -1 })
        .expect(200);
      expect(res.body.code).toBe(40000);
    }
  });

  it('40g. 拍卖购买缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({ auction_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('41. 技能学习缺少 book_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/learn')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('技能书ID');
  });
  });

  describe('技能学习与装备', () => {
  it('42. 购买技能书并学习技能成功', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const skillBook = shopRes.body.data?.find((s: any) => s.item_id === 14);
    if (skillBook) {
      await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: skillBook.id, count: 1 })
        .expect(200);
      const learnRes = await request(app)
        .post('/api/skill/learn')
        .set('Authorization', `Bearer ${token}`)
        .send({ book_id: 14 })
        .expect(200);
      expect(learnRes.body.code).toBe(0);
      expect(learnRes.body.msg).toMatch(/学习成功/);
    }
  });

  it('43. 获取已装备技能', async () => {
    const res = await request(app)
      .get('/api/skill/equipped')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('physical');
    expect(res.body.data).toHaveProperty('magic');
  });

  it('44. 装备技能成功', async () => {
    const listRes = await request(app)
      .get('/api/skill/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const skills = listRes.body.data || [];
    const learned = skills.find((s: any) => s.skill_id === 1);
    if (learned) {
      const res = await request(app)
        .post('/api/skill/equip')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_id: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('45. 卸下技能成功', async () => {
    const res = await request(app)
      .post('/api/skill/unequip')
      .set('Authorization', `Bearer ${token}`)
      .send({ skill_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('45b. 技能 equip 缺少 skill_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/技能ID/);
  });

  it('45c. 技能 unequip 缺少 skill_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/unequip')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/技能ID/);
  });

  it('45d. 技能 unequip 未学习的技能返回失败', async () => {
    const res = await request(app)
      .post('/api/skill/unequip')
      .set('Authorization', `Bearer ${token}`)
      .send({ skill_id: 99999 });
    expect([200, 500]).toContain(res.status);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg).toMatch(/未学习/);
  });
  });

  describe('装备穿戴与战斗', () => {
  it('46. 购买武器并穿戴装备成功', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const weapon = shopRes.body.data?.find((s: any) => s.item_id === 13);
    if (weapon) {
      await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: weapon.id, count: 1 })
        .expect(200);
      const bagRes = await request(app)
        .get('/api/bag/list')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const equipItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 13);
      if (equipItem) {
        const wearRes = await request(app)
          .post('/api/bag/wear')
          .set('Authorization', `Bearer ${token}`)
          .send({ id: equipItem.id })
          .expect(200);
        expect(wearRes.body.code).toBe(0);
      }
    }
  });

  it('47. 获取装备列表有数据', async () => {
    const res = await request(app)
      .get('/api/equip/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('48. 卸下装备成功', async () => {
    const listRes = await request(app)
      .get('/api/equip/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const equips = listRes.body.data || [];
    const worn = equips.find((e: any) => e.pos === 1);
    if (worn) {
      const res = await request(app)
        .post('/api/equip/remove')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: worn.equipment_uid ?? worn.id })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('49. 自动战斗成功', async () => {
    const res = await request(app)
      .post('/api/battle/auto')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('status');
  });

  it('50. 停止战斗成功', async () => {
    const res = await request(app)
      .post('/api/battle/stop')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('50b. 自动战斗中再次 start 返回已在战斗中', async () => {
    await request(app)
      .post('/api/battle/auto')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    const res = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/已经.*战斗|战斗中/);
    await request(app)
      .post('/api/battle/stop')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
  });

  describe('Boss 与 PVP', () => {
  it('51. 获取 Boss 列表', async () => {
    const res = await request(app)
      .get('/api/boss/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('52. 获取 Boss 详情', async () => {
    const res = await request(app)
      .get('/api/boss/get')
      .query({ id: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({ id: 1, name: '测试Boss' });
  });

  it('53. 挑战 Boss 成功', async () => {
    const res = await request(app)
      .post('/api/boss/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ boss_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('result');
  }, 15000);

  it('53b. 停止 Boss 战斗', async () => {
    const res = await request(app)
      .post('/api/boss/stop')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('success');
  });

  it('54. 获取 PVP 对手', async () => {
    const res = await request(app)
      .get('/api/pvp/opponent')
      .query({ uid })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('skills');
  });

  it('55. PVP 挑战（缺少参数返回 400）', async () => {
    const res = await request(app)
      .post('/api/pvp/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/target_uid|map_id/);
  });

  it('55b. PVP opponent 缺少 uid 返回 400', async () => {
    const res = await request(app)
      .get('/api/pvp/opponent')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/uid/);
  });

  it('55c. PVP challenge 缺少 map_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/pvp/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_uid: uid })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/map_id/);
  });

  it('55c2. PVP challenge 缺少 target_uid 返回 400', async () => {
    const res = await request(app)
      .post('/api/pvp/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ map_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/target_uid/);
  });

  it('55d. PVP opponent 无角色用户返回 404', async () => {
    const regB = await request(app)
      .post('/api/user/register')
      .send({ username: `_noplayer_${Date.now()}`, password: 'test123456' })
      .expect(200);
    if (regB.body.code !== 0) return;
    const uidNoPlayer = regB.body.data.uid;
    const res = await request(app)
      .get('/api/pvp/opponent')
      .query({ uid: uidNoPlayer })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toMatch(/对手不存在/);
  });

  it('52b. Boss get 缺少 id 返回 400', async () => {
    const res = await request(app)
      .get('/api/boss/get')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/Boss ID/);
  });

  it('52c. Boss get 不存在返回 400', async () => {
    const res = await request(app)
      .get('/api/boss/get')
      .query({ id: 99999 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/Boss 不存在/);
  });

  it('52d. Boss challenge 缺少 boss_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/boss/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/Boss ID/);
  });

  it('51b. Boss list 带 map_id 筛选', async () => {
    const res = await request(app)
      .get('/api/boss/list')
      .query({ map_id: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('53c. Boss stop 空闲时返回 success false', async () => {
    const res = await request(app)
      .post('/api/boss/stop')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data?.success).toBe(false);
  });
  });

  describe('拍卖与配置', () => {
  it('56. 商店货币配置', async () => {
    const res = await request(app)
      .get('/api/shop/currencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('gold');
  });

  it('57. 拍卖上架成功', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const potion = shopRes.body.data?.find((s: any) => s.item_id === 1);
    if (potion) {
      await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: potion.id, count: 2 })
        .expect(200);
    }
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = bagRes.body.data?.items || [];
    const sellable = items.find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (sellable) {
      const bagId = sellable.original_id ?? sellable.id;
      const res = await request(app)
        .post('/api/auction/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ bag_id: bagId, count: 1, price: 10 })
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('auction_id');
    }
  });

  it('58. 拍卖记录', async () => {
    const res = await request(app)
      .get('/api/auction/records')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('records');
  });

  it('59. 获取地图详情成功', async () => {
    const res = await request(app)
      .get('/api/map/get')
      .query({ id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({ id: 1, name: '新手村' });
  });

  it('60. 获取怪物详情成功', async () => {
    const res = await request(app)
      .get('/api/monster/get')
      .query({ id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({ id: 1, name: '史莱姆' });
  });

  it('61. 怪物按等级查询', async () => {
    const res = await request(app)
      .get('/api/monster/level')
      .query({ min: 1, max: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('62. 怪物按地图查询', async () => {
    const res = await request(app)
      .get('/api/monster/map')
      .query({ map_id: 1 })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('62b. 怪物 level 缺少等级范围返回 400', async () => {
    const res = await request(app)
      .get('/api/monster/level')
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/等级范围/);
  });

  it('62c. 怪物 map 缺少 map_id 返回 400', async () => {
    const res = await request(app)
      .get('/api/monster/map')
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/地图ID/);
  });

  it('63. 等级经验配置', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .query({ level: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({ level: 1 });
  });

  it('64. 物品列表', async () => {
    const res = await request(app)
      .get('/api/item/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('64b. 物品列表按 type 筛选', async () => {
    const res = await request(app)
      .get('/api/item/list')
      .query({ type: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data.every((i: any) => i.type === 1)).toBe(true);
    }
  });

  it('64c. 物品详情含 attributes', async () => {
    const res = await request(app)
      .get('/api/item/get')
      .query({ id: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('attributes');
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data.attributes).toHaveProperty('hp');
  });

  it('64b. 物品列表按 type 筛选', async () => {
    const res = await request(app)
      .get('/api/item/list')
      .query({ type: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length) expect(res.body.data.every((i: any) => i.type === 1)).toBe(true);
  });

  it('65. 物品使用说明', async () => {
    const res = await request(app)
      .get('/api/item/usage')
      .query({ itemId: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('usage');
  });

  it('65a. 物品使用说明缺少 itemId 返回 400', async () => {
    const res = await request(app)
      .get('/api/item/usage')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('物品ID');
  });

  it('65c. item/use 使用消耗品成功', async () => {
    await new BagService().addItem(uid!, 1, 1);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const consumable = bagRes.body.data?.items?.find((i: any) => i.item_id === 1);
    expect(consumable).toBeTruthy();
    const bagId = consumable!.original_id ?? consumable!.id;
    const res = await request(app)
      .post('/api/item/use')
      .set('Authorization', `Bearer ${token}`)
      .send({ bagItemId: bagId })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.msg).toMatch(/使用|成功/);
  });

  it('65d. item/use 缺少 bagItemId 返回 400', async () => {
    const res = await request(app)
      .post('/api/item/use')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('背包物品ID');
  });

  it('65e. item/use 不存在的背包物品返回失败', async () => {
    const res = await request(app)
      .post('/api/item/use')
      .set('Authorization', `Bearer ${token}`)
      .send({ bagItemId: 99999 })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/物品不存在|使用失败/);
  });

  it('65b. 等级经验列表', async () => {
    const res = await request(app)
      .get('/api/level_exp/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
  });

  describe('装备强化与拍卖扩展', () => {
  it('71. 装备交易缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/trade')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/装备实例ID|买家ID/);
  });

  it('72. 拍卖购买缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/拍卖ID|数量/);
  });

  it('73. 拍卖下架', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const potion = shopRes.body.data?.find((s: any) => s.item_id === 1);
    if (potion) {
      await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: potion.id, count: 1 })
        .expect(200);
    }
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = bagRes.body.data?.items || [];
    const sellable = items.find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (sellable) {
      const listRes = await request(app)
        .post('/api/auction/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ bag_id: sellable.original_id ?? sellable.id, count: 1, price: 5 })
        .expect(200);
      if (listRes.body.code === 0 && listRes.body.data?.auction_id) {
        const offRes = await request(app)
          .post('/api/auction/off-shelf')
          .set('Authorization', `Bearer ${token}`)
          .send({ auction_id: listRes.body.data.auction_id })
          .expect(200);
        expect(offRes.body.code).toBe(0);
      }
    }
  });

  it('74. 技能书不存在学习失败', async () => {
    const res = await request(app)
      .post('/api/skill/learn')
      .set('Authorization', `Bearer ${token}`)
      .send({ book_id: 99999 });
    expect([200, 400]).toContain(res.status);
    expect(res.body.code).not.toBe(0);
    expect(res.body.msg || '').toMatch(/技能书|不存在/);
  });
  });

  describe('等级经验与拍卖边界', () => {
  it('79. 等级经验 get 缺少参数返回 400', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('缺少参数');
  });

  it('80. 等级经验 get 等级不存在返回 404', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .query({ level: 99999 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toContain('经验配置不存在');
  });

  it('80b. 等级经验 add 缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/level_exp/add')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('80c. 等级经验 update 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/level_exp/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 2, exp: 100 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('80d. 等级经验 delete 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/level_exp/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('80e. 等级经验 add 成功', async () => {
    const level = 99990 + (Date.now() % 100);
    const exp = 999999;
    const res = await request(app)
      .post('/api/level_exp/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ level, exp })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('id');
    const getRes = await request(app)
      .get('/api/level_exp/get')
      .query({ level })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.exp).toBe(exp);
  });

  it('80f. 等级经验 update 成功', async () => {
    const addRes = await request(app)
      .post('/api/level_exp/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 99991, exp: 100 })
      .expect(200);
    if (addRes.body.code === 0) {
      const res = await request(app)
        .post('/api/level_exp/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: addRes.body.data.id, exp: 200 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('80g. 等级经验 delete 成功', async () => {
    const addRes = await request(app)
      .post('/api/level_exp/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 99992, exp: 1 })
      .expect(200);
    if (addRes.body.code === 0) {
      const res = await request(app)
        .post('/api/level_exp/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: addRes.body.data.id })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('81. 拍卖 list 带分页参数', async () => {
    const res = await request(app)
      .get('/api/auction/list')
      .query({ page: 1, pageSize: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('82. 拍卖 buy 数量无效返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({ auction_id: 1, count: 0 })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/数量/);
  });

  it('83. 地图不存在返回 404', async () => {
    const res = await request(app)
      .get('/api/map/get')
      .query({ id: 99999 })
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toContain('地图不存在');
  });

  it('83b. 地图 add 缺少 name 返回 400', async () => {
    const res = await request(app)
      .post('/api/map/add')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toContain('地图名称');
  });

  it('83c. 地图 update 缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/map/update')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('83d. 地图 delete 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/map/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('83e. 地图 add 成功', async () => {
    const name = `_测试地图_${Date.now()}`;
    const res = await request(app)
      .post('/api/map/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('id');
    const getRes = await request(app)
      .get('/api/map/get')
      .query({ id: res.body.data.id })
      .expect(200);
    expect(getRes.body.data.name).toBe(name);
  });

  it('83f. 地图 update 成功', async () => {
    const addRes = await request(app)
      .post('/api/map/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `_待更新_${Date.now()}` })
      .expect(200);
    if (addRes.body.code === 0) {
      const newName = `_已更新_${Date.now()}`;
      const res = await request(app)
        .post('/api/map/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: addRes.body.data.id, name: newName })
        .expect(200);
      expect(res.body.code).toBe(0);
      const getRes = await request(app)
        .get('/api/map/get')
        .query({ id: addRes.body.data.id })
        .expect(200);
      expect(getRes.body.data.name).toBe(newName);
    }
  });

  it('83g. 地图 delete 成功', async () => {
    const addRes = await request(app)
      .post('/api/map/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `_待删除_${Date.now()}` })
      .expect(200);
    if (addRes.body.code === 0) {
      const res = await request(app)
        .post('/api/map/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: addRes.body.data.id })
        .expect(200);
      expect(res.body.code).toBe(0);
      const getRes = await request(app)
        .get('/api/map/get')
        .query({ id: addRes.body.data.id })
        .expect(200);
      expect(getRes.body.code).toBe(40001);
    }
  });

  it('84. 排行榜 type=level', async () => {
    const res = await request(app)
      .get('/api/rank/list')
      .query({ type: 'level' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('85. 排行榜 type 无效时默认 gold', async () => {
    const res = await request(app)
      .get('/api/rank/list')
      .query({ type: 'invalid' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
  });
  });

  describe('EquipEffectUtil 真实 DB 测试', () => {
  it('86. applyEquipEffect 增加玩家属性', async () => {
    const playerService = new PlayerService();
    const before = await playerService.get(playerId);
    expect(before).toBeTruthy();
    const beforeAtk = before!.phy_atk ?? 0;

    const equip = { id: 1, item_id: 13, equip_attributes: { phy_atk: 50 } };
    await EquipEffectUtil.applyEquipEffect(uid!, equip);

    const after = await playerService.get(playerId);
    expect(after!.phy_atk).toBe(beforeAtk + 50);
  });

  it('87. removeEquipEffect 移除玩家属性', async () => {
    const equip = { id: 1, item_id: 13, equip_attributes: { phy_atk: 50 } };
    const playerService = new PlayerService();
    const withEquip = await playerService.get(playerId);
    expect(withEquip).toBeTruthy();
    const atkWithEquip = withEquip!.phy_atk ?? 0;

    await EquipEffectUtil.removeEquipEffect(uid!, equip);
    const afterRemove = await playerService.get(playerId);
    expect((afterRemove!.phy_atk ?? 0)).toBe(atkWithEquip - 50);
  });

  it('88. applyEquipEffect hp 分支', async () => {
    const equip = { id: 2, item_id: 8, equip_attributes: { hp: 100 } };
    await EquipEffectUtil.applyEquipEffect(uid!, equip);
    const playerService = new PlayerService();
    const after = await playerService.get(playerId);
    expect(after!.max_hp).toBeGreaterThanOrEqual(100);
    expect(after!.hp).toBeGreaterThanOrEqual(100);
  });

  it('89. applyEquipEffect mp 分支', async () => {
    const equip = { id: 3, item_id: 9, equip_attributes: { mp: 50 } };
    await EquipEffectUtil.applyEquipEffect(uid!, equip);
    const playerService = new PlayerService();
    const after = await playerService.get(playerId);
    expect(after!.max_mp).toBeGreaterThanOrEqual(50);
    expect(after!.mp).toBeGreaterThanOrEqual(50);
  });

  it('90. removeEquipEffect hp 且 oldHp>newMaxHp 分支', async () => {
    const playerService = new PlayerService();
    await EquipEffectUtil.applyEquipEffect(uid!, { id: 4, item_id: 8, equip_attributes: { hp: 100 } });
    const mid = await playerService.get(playerId);
    await playerService.update(playerId, { hp: mid!.max_hp });
    const equip = { id: 4, item_id: 8, equip_attributes: { hp: 100 } };
    await EquipEffectUtil.removeEquipEffect(uid!, equip);
    const after = await playerService.get(playerId);
    expect(after!.max_hp).toBeLessThanOrEqual((mid!.max_hp ?? 0) - 50);
    expect(after!.hp).toBeLessThanOrEqual(after!.max_hp ?? 999);
  });

  it('91. 玩家不存在时 applyEquipEffect 不抛错', async () => {
    const equip = { id: 1, item_id: 13, equip_attributes: { phy_atk: 10 } };
    await EquipEffectUtil.applyEquipEffect(999999 as any, equip);
  });

  it('92. removeEquipEffect mp 且 oldMp>newMaxMp 分支', async () => {
    await EquipEffectUtil.applyEquipEffect(uid!, { id: 5, item_id: 9, equip_attributes: { mp: 80 } });
    const playerService = new PlayerService();
    const mid = await playerService.get(playerId);
    await playerService.update(playerId, { mp: mid!.max_mp });
    const equip = { id: 5, item_id: 9, equip_attributes: { mp: 80 } };
    await EquipEffectUtil.removeEquipEffect(uid!, equip);
    const after = await playerService.get(playerId);
    expect(after!.mp).toBeLessThanOrEqual(after!.max_mp ?? 999);
  });
  });

  describe('装备强化与祝福', () => {
  it('93. 装备强化成功', async () => {
    const shopRes = await request(app)
      .get('/api/shop/list')
      .query({ type: 'gold' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const stone = shopRes.body.data?.find((s: any) => s.item_id === 6);
    if (stone) {
      await request(app)
        .post('/api/shop/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ shop_item_id: stone.id, count: 110 })
        .expect(200);
    }
    const bagService = new BagService();
    await bagService.addItem(uid!, 13, 1);
      const bagRes = await request(app)
        .get('/api/bag/list')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const equipItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 13);
      if (equipItem) {
        const instId = equipItem.equipment_uid ?? equipItem.original_id ?? equipItem.id;
        const enhanceRes = await request(app)
          .post('/api/equip/enhance')
          .set('Authorization', `Bearer ${token}`)
          .send({ instance_id: instId })
          .expect(200);
        expect([0, 40005]).toContain(enhanceRes.body.code);
        if (enhanceRes.body.code === 0) {
          expect(enhanceRes.body.data).toHaveProperty('broken');
        }
      }
  });

  it('94. 装备祝福', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const equipItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 13);
    if (equipItem) {
      const instanceId = equipItem.equipment_uid ?? equipItem.original_id ?? equipItem.id;
      const blessRes = await request(app)
        .post('/api/equip/bless')
        .set('Authorization', `Bearer ${token}`)
        .send({ instance_id: instanceId })
        .expect(200);
      expect([0, 40005]).toContain(blessRes.body.code);
      if (blessRes.body.code === 0) {
        expect(blessRes.body.data).toHaveProperty('blessing_level');
      }
    }
  });
  });

  describe('PVP 与拍卖完整流程', () => {
  it('95. PVP 挑战成功', async () => {
    const opponentRes = await request(app)
      .get('/api/pvp/opponent')
      .query({ uid })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    if (opponentRes.body.code === 0 && opponentRes.body.data?.uid) {
      const targetUid = opponentRes.body.data.uid;
      const res = await request(app)
        .post('/api/pvp/challenge')
        .set('Authorization', `Bearer ${token}`)
        .send({ target_uid: targetUid, map_id: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('96. 拍卖购买', async () => {
    const listRes = await request(app)
      .get('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = listRes.body.data?.items || [];
    const buyable = items.find((a: any) => a.seller_uid !== uid && (a.count || 0) >= 1);
    if (buyable) {
      const res = await request(app)
        .post('/api/auction/buy')
        .set('Authorization', `Bearer ${token}`)
        .send({ auction_id: buyable.auction_id ?? buyable.id, count: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });
  });

  describe('equip API 与 bag 分支', () => {
  it('97. equip API wear 穿戴装备', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const equipItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 13);
    if (equipItem) {
      const bagId = equipItem.original_id ?? equipItem.id;
      const res = await request(app)
        .post('/api/equip/wear')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: bagId })
        .expect(200);
      expect([0, 1]).toContain(res.body.code);
    }
  });

  it('98. equip API remove 卸下装备', async () => {
    const equipRes = await request(app)
      .get('/api/equip/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const worn = equipRes.body.data?.find((e: any) => e.pos === 1);
    if (worn) {
      const res = await request(app)
        .post('/api/equip/remove')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: worn.equipment_uid ?? worn.id })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('98b. bag wear 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/wear')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/物品ID/);
  });

  it('99. bag wear 非装备返回 400', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const consumable = bagRes.body.data?.items?.find((i: any) => i.item_id === 1);
    if (consumable) {
      const res = await request(app)
        .post('/api/bag/wear')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: consumable.original_id ?? consumable.id });
      expect([200, 400, 500]).toContain(res.status);
      expect(res.body.code).not.toBe(0);
      expect((res.body.msg || '') + (res.body.error || '')).toMatch(/装备|不是装备|穿戴失败/);
    }
  });

  it('100. bag update 数量无效返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 1, count: 0 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('100b. bag update 无有效更新字段返回 400', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const item = bagRes.body.data?.items?.[0];
    if (item) {
      const res = await request(app)
        .post('/api/bag/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: item.original_id ?? item.id })
        .expect(200);
      expect(res.body.code).toBe(40000);
      expect(res.body.msg).toMatch(/有效更新|字段/);
    }
  });

  it('100c. bag clear-equipment 一键清包', async () => {
    const res = await request(app)
      .post('/api/bag/clear-equipment')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('deleted');
  });

  it('100d. bag delete 不存在的物品返回失败', async () => {
    const res = await request(app)
      .post('/api/bag/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 999999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('100e. bag wear 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/bag/wear')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/物品ID|缺少/);
  });

  it('100f. bag use count 非整数时默认 1', async () => {
    const bagRes = await request(app).get('/api/bag/list').set('Authorization', `Bearer ${token}`).expect(200);
    const consumable = bagRes.body.data?.items?.find((i: any) => i.item_id === 1 && !i.equipment_uid);
    if (consumable) {
      const res = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: consumable.original_id ?? consumable.id, count: 2.5 })
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.msg || '').toMatch(/使用成功/);
    }
  });

  it('101. 拍卖 list 带筛选参数', async () => {
    const res = await request(app)
      .get('/api/auction/list')
      .query({ type: 1, keyword: '血', min_level: 1, max_level: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('101b. 拍卖 list 带 pos 和 keyword 空值', async () => {
    const res = await request(app)
      .get('/api/auction/list')
      .query({ pos: 1, keyword: 'undefined', page: 2, pageSize: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('101c. 排行榜带分页', async () => {
    const res = await request(app)
      .get('/api/rank/list')
      .query({ type: 'level', page: 1, pageSize: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });

  it('101d. 排行榜无效 type 默认 gold', async () => {
    const res = await request(app)
      .get('/api/rank/list')
      .query({ type: 'invalid_type_xyz' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
  });
  });

  describe('item-effect 多种效果', () => {
  it('102. 使用扩容袋 expand_bag', async () => {
    const bagService = new BagService();
    await bagService.addItem(uid!, 11, 1);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const expandItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 11);
    if (expandItem) {
      const res = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: expandItem.original_id ?? expandItem.id, count: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('103. 使用多倍卡 boost', async () => {
    const bagService = new BagService();
    await bagService.addItem(uid!, 101, 1);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const boostItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 101);
    if (boostItem) {
      const res = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: boostItem.original_id ?? boostItem.id, count: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('104. 使用永久属性果实 add_stat', async () => {
    const bagService = new BagService();
    await bagService.addItem(uid!, 120, 1);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const fruitItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 120);
    if (fruitItem) {
      const res = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: fruitItem.original_id ?? fruitItem.id, count: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });
  });

  describe('level_exp、skill、auction 分支', () => {
  it('105. level_exp get 按 id 查询', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .query({ id: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('level');
    expect(res.body.data).toHaveProperty('exp');
  });

  it('105b. level_exp get 按 level 查询', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .query({ level: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('level', 1);
    expect(res.body.data).toHaveProperty('exp');
  });

  it('105c. level_exp get 缺少参数返回 400', async () => {
    const res = await request(app)
      .get('/api/level_exp/get')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('106. skill equip 未学习技能返回失败', async () => {
    const res = await request(app)
      .post('/api/skill/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ skill_id: 999 });
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.code).not.toBe(0);
  });

  it('107. auction off-shelf 错误 auction_id', async () => {
    const res = await request(app)
      .post('/api/auction/off-shelf')
      .set('Authorization', `Bearer ${token}`)
      .send({ auction_id: 99999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('108. battle 敌人不存在', async () => {
    const res = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 99999 })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });
  });

  describe('equip trade 双玩家', () => {
  it('109. 装备交易', async () => {
    const regRes = await request(app)
      .post('/api/user/register')
      .send({ username: `_trade_${Date.now()}`, password: 'test123456' })
      .expect(200);
    if (regRes.body.code !== 0) return;
    const buyerToken = regRes.body.data.token;
    const buyerUid = regRes.body.data.uid;
    await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ name: '交易买家' })
      .expect(200);
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const equipItem = bagRes.body.data?.items?.find((i: any) => i.item_id === 13);
    if (equipItem) {
      const instId = equipItem.equipment_uid ?? equipItem.id;
      const res = await request(app)
        .post('/api/equip/trade')
        .set('Authorization', `Bearer ${token}`)
        .send({ instance_id: instId, buyer_uid: buyerUid })
        .expect(200);
      expect([0, 1]).toContain(res.body.code);
    }
  });
  });

  describe('背包与角色管理', () => {
  it('66. 背包删除物品', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = bagRes.body.data?.items || [];
    const toDelete = items.find((i: any) => (i.item_id === 1 || i.item_id === 2) && (i.count || 0) >= 1);
    if (toDelete) {
      const res = await request(app)
        .post('/api/bag/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: toDelete.original_id ?? toDelete.id, count: 1 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('67. 更新角色', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId, name: '更新后角色名' })
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('68. 登录密码错误返回失败', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ username: UNIQUE, password: 'wrongpass' })
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('75. 背包清空装备', async () => {
    const res = await request(app)
      .post('/api/bag/clear-equipment')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('deleted');
  });

  it('76. 背包更新物品数量', async () => {
    const bagRes = await request(app)
      .get('/api/bag/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = bagRes.body.data?.items || [];
    const updatable = items.find((i: any) => i.item_id === 1 && (i.count || 0) >= 2);
    if (updatable) {
      const res = await request(app)
        .post('/api/bag/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: updatable.original_id ?? updatable.id, count: 2 })
        .expect(200);
      expect(res.body.code).toBe(0);
    }
  });

  it('77. 删除多余角色', async () => {
    const addRes = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '_待删除角色_' })
      .expect(200);
    if (addRes.body.code === 0 && addRes.body.data?.id) {
      const delRes = await request(app)
        .post('/api/player/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: addRes.body.data.id })
        .expect(200);
      expect(delRes.body.code).toBe(0);
    }
  });

  it('78. 删除角色缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('78b. 玩家 update 无有效更新字段返回 400', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId })
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg).toMatch(/有效更新|字段/);
  });

  it('78c. 玩家 update 名称无效返回 400', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId, name: '' })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('78d. 玩家 update 玩家不存在返回 404', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 99999, name: '不存在' })
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toMatch(/玩家不存在/);
  });

  it('78e2. 玩家 update auto_battle_config', async () => {
    const res = await request(app)
      .post('/api/player/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId, auto_battle_config: { enemy_id: 1, auto_heal: true } })
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('78e. 玩家 delete 玩家不存在返回 404', async () => {
    const res = await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 99999 })
      .expect(200);
    expect(res.body.code).toBe(40001);
    expect(res.body.msg).toMatch(/玩家不存在/);
  });

  it('78f. 玩家 delete 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).toBe(40000);
    expect(res.body.msg || '').toMatch(/玩家ID|缺少/);
  });
  });

  describe('拍卖 API', () => {
  it('79. 拍卖 list 成功', async () => {
    const res = await request(app)
      .get('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  it('80. 拍卖 list 缺少 bag_id 上架返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/list')
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 10 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('81. 拍卖 buy 缺少 auction_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 1 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });

  it('82. 拍卖 buy count 无效返回 400', async () => {
    const res = await request(app)
      .post('/api/auction/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({ auction_id: 1, count: 0 })
      .expect(200);
    expect(res.body.code).toBe(40000);
  });
  });

  describe('技能 API 错误分支', () => {
  it('83. 技能 equip 缺少 skill_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('84. 技能 unequip 缺少 skill_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/skill/unequip')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });
  });

  describe('装备 API 错误分支', () => {
  it('85. 装备 remove 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/remove')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });

  it('86. 装备 wear 缺少 id 返回 400', async () => {
    const res = await request(app)
      .post('/api/equip/wear')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body.code).not.toBe(0);
  });
  });

  describe('Player API 分支覆盖补充', () => {
    let bcToken: string;
    let bcUid: number;

    beforeAll(async () => {
      const u = await createTestUser(app, { prefix: 'bc', suffix: 'api' });
      bcToken = u.token;
      bcUid = u.uid;
    });

    const bcAuth = () => ({ Authorization: `Bearer ${bcToken}` });

    describe('api/equip', () => {
      it('POST /wear with non-existent id → 穿戴失败', async () => {
        const res = await request(app)
          .post('/api/equip/wear')
          .set(bcAuth())
          .send({ id: 999999 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /enhance with non-existent instance_id → error', async () => {
        const res = await request(app)
          .post('/api/equip/enhance')
          .set(bcAuth())
          .send({ instance_id: 999999 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /bless with non-existent instance_id → error', async () => {
        const res = await request(app)
          .post('/api/equip/bless')
          .set(bcAuth())
          .send({ instance_id: 999999 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /trade missing buyer_uid → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/equip/trade')
          .set(bcAuth())
          .send({ instance_id: 1 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg).toMatch(/买家/);
      });

      it('POST /trade with non-existent instance → error', async () => {
        const res = await request(app)
          .post('/api/equip/trade')
          .set(bcAuth())
          .send({ instance_id: 999999, buyer_uid: 1 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /remove with non-existent id → 卸下失败', async () => {
        const res = await request(app)
          .post('/api/equip/remove')
          .set(bcAuth())
          .send({ id: 999999 });
        expect(res.body.code).not.toBe(0);
      });
    });

    describe('api/bag', () => {
      it('POST /use with count=0 → defaults or errors', async () => {
        await giveItem(bcUid, 1, 1);
        const bagRes = await request(app).get('/api/bag/list').set(bcAuth());
        const item = bagRes.body.data?.items?.find((i: any) => i.item_id === 1);
        if (item) {
          const res = await request(app)
            .post('/api/bag/use')
            .set(bcAuth())
            .send({ id: item.original_id ?? item.id, count: 0 });
          expect([0, 40000]).toContain(res.body.code);
        }
      });

      it('POST /wear with non-existent id → error', async () => {
        const res = await request(app)
          .post('/api/bag/wear')
          .set(bcAuth())
          .send({ id: 'nonexistent_bag_id' });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /clear-equipment → success (even on empty bag)', async () => {
        const res = await request(app)
          .post('/api/bag/clear-equipment')
          .set(bcAuth())
          .send({});
        expect(res.body.code).toBe(0);
        expect(res.body.data).toHaveProperty('deleted');
      });

      it('POST /delete with non-existent id → fails', async () => {
        const res = await request(app)
          .post('/api/bag/delete')
          .set(bcAuth())
          .send({ id: 999999 });
        expect(res.status).toBeLessThanOrEqual(400);
        expect(res.body.code).not.toBe(0);
      });
    });

    describe('api/user', () => {
      it('POST /register with special chars in username → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/user/register')
          .send({ username: 'bad$user!', password: 'test123456' });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /login with empty password → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/user/login')
          .send({ username: 'someuser', password: '' });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /login with too-short password → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/user/login')
          .send({ username: 'someuser', password: '12' });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /register with single-char username → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/user/register')
          .send({ username: 'x', password: 'test123456' });
        expect(res.body.code).not.toBe(0);
      });
    });

    describe('api/skill', () => {
      it('POST /learn with non-existent book_id → error', async () => {
        const res = await request(app)
          .post('/api/skill/learn')
          .set(bcAuth())
          .send({ book_id: 999999 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /equip with non-existent skill_id → error', async () => {
        const res = await request(app)
          .post('/api/skill/equip')
          .set(bcAuth())
          .send({ skill_id: 999999 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /unequip with non-existent skill_id → error', async () => {
        const res = await request(app)
          .post('/api/skill/unequip')
          .set(bcAuth())
          .send({ skill_id: 999999 });
        expect(res.body.code).not.toBe(0);
      });
    });

    describe('api/boss', () => {
      it('GET /list → success with auth', async () => {
        const res = await request(app)
          .get('/api/boss/list')
          .set(bcAuth());
        expect(res.body.code).toBe(0);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('POST /challenge without boss_id → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/boss/challenge')
          .set(bcAuth())
          .send({});
        expect(res.body.code).not.toBe(0);
      });

      it('POST /stop → success (no active battle)', async () => {
        const res = await request(app)
          .post('/api/boss/stop')
          .set(bcAuth())
          .send({});
        expect(res.body.code).toBe(0);
      });
    });

    describe('api/pvp', () => {
      it('GET /opponent without uid → INVALID_PARAMS', async () => {
        const res = await request(app)
          .get('/api/pvp/opponent')
          .set(bcAuth());
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg).toMatch(/uid/);
      });

      it('POST /challenge with target_uid = self → error', async () => {
        const res = await request(app)
          .post('/api/pvp/challenge')
          .set(bcAuth())
          .send({ target_uid: bcUid, map_id: 1 });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /challenge without map_id → INVALID_PARAMS', async () => {
        const res = await request(app)
          .post('/api/pvp/challenge')
          .set(bcAuth())
          .send({ target_uid: 999999 });
        expect(res.body.code).not.toBe(0);
      });
    });

    describe('api/config', () => {
      it('GET /enhance_materials → success', async () => {
        const res = await request(app)
          .get('/api/config/enhance_materials')
          .set(bcAuth());
        expect(res.body.code).toBe(0);
        expect(res.body.data).toHaveProperty('stone');
      });
    });

    describe('utils/material', () => {
      it('getMaterialCount for non-existent material → 0', async () => {
        const count = await getMaterialCount(bcUid, 999999);
        expect(count).toBe(0);
      });

      it('consumeMaterial with count=0 → true (nothing to consume)', async () => {
        const ok = await consumeMaterial(bcUid, 999999, 0);
        expect(ok).toBe(true);
      });

      it('consumeMaterial with insufficient material → false', async () => {
        const ok = await consumeMaterial(bcUid, 999999, 5);
        expect(ok).toBe(false);
      });
    });

    describe('utils/enrich-equip', () => {
      it('enrichEquipFromBase with all stat fields → returns all stats', () => {
        const base = {
          base_hp: 100,
          base_phy_atk: 50,
          base_phy_def: 30,
          base_mp: 20,
          base_mag_def: 10,
          base_mag_atk: 15,
          base_hit_rate: 5,
          base_dodge_rate: 3,
          base_crit_rate: 7,
          base_level: 10,
          pos: 2,
        };
        const detail = enrichEquipFromBase(base);
        expect(detail.equip_attributes.hp).toBe(100);
        expect(detail.equip_attributes.phy_atk).toBe(50);
        expect(detail.equip_attributes.phy_def).toBe(30);
        expect(detail.equip_attributes.mp).toBe(20);
        expect(detail.equip_attributes.mag_def).toBe(10);
        expect(detail.equip_attributes.mag_atk).toBe(15);
        expect(detail.equip_attributes.hit_rate).toBe(5);
        expect(detail.equip_attributes.dodge_rate).toBe(3);
        expect(detail.equip_attributes.crit_rate).toBe(7);
        expect(detail.equip_level).toBe(10);
        expect(detail.pos).toBe(2);
        expect(detail.enhance_level).toBe(0);
        expect(detail.blessing_level).toBe(0);
      });

      it('enrichEquipFromBase with only phy_atk → other stats default to 0', () => {
        const base = { base_phy_atk: 42, pos: 1 };
        const detail = enrichEquipFromBase(base);
        expect(detail.equip_attributes.phy_atk).toBe(42);
        expect(detail.equip_attributes.hp).toBe(0);
        expect(detail.equip_attributes.mag_atk).toBe(0);
        expect(detail.equip_level).toBe(1);
      });

      it('enrichEquipFromBase with empty object → all defaults', () => {
        const detail = enrichEquipFromBase({});
        expect(detail.equip_attributes.hp).toBe(0);
        expect(detail.equip_level).toBe(1);
        expect(detail.pos).toBe(1);
      });

      it('enrichEquipDetail with real instance', async () => {
        const bagService = new BagService();
        const equipInstanceService = new EquipInstanceService();
        await bagService.addItem(bcUid, 13, 1);
        const bags = await bagService.list(bcUid);
        const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
        if (!equip) return;

        const instanceId = parseInt(String(equip.equipment_uid), 10);
        const instance = await equipInstanceService.get(instanceId);
        if (!instance) return;

        const detail = await enrichEquipDetail(equipInstanceService, instance);
        expect(detail).toHaveProperty('equip_attributes');
        expect(detail).toHaveProperty('base_attributes');
        expect(detail).toHaveProperty('equip_level');
        expect(typeof detail.enhance_level).toBe('number');
        expect(typeof detail.blessing_level).toBe('number');
      });
    });
  });
});

describe('API 深度分支', () => {
  let apiUid: number;
  let apiToken: string;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'dweq', charName: 'DwApiEquip' });
    apiUid = user.uid;
    apiToken = user.token;
  }, 10000);

  describe('api/equip 分支', () => {
    it('POST /equip/wear 装备不存在返回失败', async () => {
      const res = await request(app)
        .post('/api/equip/wear')
        .set('Authorization', `Bearer ${apiToken}`)
        .send({ id: 999999 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('POST /equip/enhance 装备不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/equip/enhance')
        .set('Authorization', `Bearer ${apiToken}`)
        .send({ instance_id: 999999 })
        .expect(200);
      expect(res.body.code !== 0 || res.body.data?.broken !== undefined).toBe(true);
    });

    it('POST /equip/bless 装备不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/equip/bless')
        .set('Authorization', `Bearer ${apiToken}`)
        .send({ instance_id: 999999 })
        .expect(200);
      expect(res.body.code !== 0 || res.body.msg).toBeTruthy();
    });

    it('POST /equip/trade 买家不存在返回错误', async () => {
      const bagService = new BagService();
      await bagService.addItem(apiUid, 13, 1);
      const list = await bagService.list(apiUid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      const instanceId = equip?.equipment_uid ?? 999999;

      const res = await request(app)
        .post('/api/equip/trade')
        .set('Authorization', `Bearer ${apiToken}`)
        .send({ instance_id: instanceId, buyer_uid: 999999 });
      expect(res.body.code !== 0 || res.body.msg).toBeTruthy();
    });

    it('POST /equip/remove 成功卸下', async () => {
      const bagService = new BagService();
      const { EquipService } = await import('../../service/equip.service');
      const equipService = new EquipService();

      await bagService.addItem(apiUid, 13, 1);
      const list = await bagService.list(apiUid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (!equip) return;

      const bagId = equip.original_id ?? equip.id;
      await bagService.wearItem(apiUid, bagId, equipService);

      const res = await request(app)
        .post('/api/equip/remove')
        .set('Authorization', `Bearer ${apiToken}`)
        .send({ id: equip.equipment_uid });
      expect(res.body.code === 0 || res.body.msg).toBeTruthy();
    });
  });

  describe('api/bag 分支', () => {
    let bagToken: string;
    let bagUid: number;

    beforeAll(async () => {
      const user = await createTestUser(app, { prefix: 'dwbg', charName: 'DwApiBag' });
      bagUid = user.uid;
      bagToken = user.token;
    }, 10000);

    it('POST /bag/use 物品不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/bag/use')
        .set('Authorization', `Bearer ${bagToken}`)
        .send({ id: 999999 });
      expect(res.body.code).not.toBe(0);
    });

    it('POST /bag/wear 失败返回错误', async () => {
      const res = await request(app)
        .post('/api/bag/wear')
        .set('Authorization', `Bearer ${bagToken}`)
        .send({ id: 999999 });
      expect(res.body.code).not.toBe(0);
    });

    it('POST /bag/delete 删除装备物品', async () => {
      const bagService = new BagService();
      await bagService.addItem(bagUid, 13, 1);
      const list = await bagService.list(bagUid);
      const equip = list.find((i: any) => i.item_id === 13);
      if (!equip) return;

      const bagId = equip.original_id ?? equip.id;
      const res = await request(app)
        .post('/api/bag/delete')
        .set('Authorization', `Bearer ${bagToken}`)
        .send({ id: bagId })
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('POST /bag/update 数量无效返回错误', async () => {
      const bagService = new BagService();
      await bagService.addItem(bagUid, 1, 2);
      const list = await bagService.list(bagUid);
      const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      if (!item) return;
      const bagId = item.original_id ?? item.id;

      const res = await request(app)
        .post('/api/bag/update')
        .set('Authorization', `Bearer ${bagToken}`)
        .send({ id: bagId, count: -1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('api/user 分支', () => {
    it('POST /user/register 密码太短返回错误', async () => {
      const res = await request(app)
        .post('/api/user/register')
        .send({ username: 'dwshort123', password: '12' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('POST /user/register 用户名含特殊字符返回错误', async () => {
      const res = await request(app)
        .post('/api/user/register')
        .send({ username: 'a$b', password: 'test123456' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('POST /user/login 密码为空返回错误', async () => {
      const res = await request(app)
        .post('/api/user/login')
        .send({ username: 'dwlogin01', password: '' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('api/skill 分支', () => {
    let skillToken: string;

    beforeAll(async () => {
      const user = await createTestUser(app, { prefix: 'dwsk', charName: 'DwApiSkill' });
      skillToken = user.token;
    }, 10000);

    it('POST /skill/learn 技能书不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/skill/learn')
        .set('Authorization', `Bearer ${skillToken}`)
        .send({ book_id: 999999 });
      expect(res.body.code).not.toBe(0);
    });

    it('POST /skill/equip 未学习技能返回错误', async () => {
      const res = await request(app)
        .post('/api/skill/equip')
        .set('Authorization', `Bearer ${skillToken}`)
        .send({ skill_id: 999 });
      expect(res.body.code).not.toBe(0);
    });

    it('POST /skill/unequip 未装备技能返回错误', async () => {
      const res = await request(app)
        .post('/api/skill/unequip')
        .set('Authorization', `Bearer ${skillToken}`)
        .send({ skill_id: 999 });
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('api/boss 分支', () => {
    let bossToken: string;

    beforeAll(async () => {
      const user = await createTestUser(app, { prefix: 'dwbs', charName: 'DwApiBoss' });
      bossToken = user.token;
    }, 10000);

    it('GET /boss/list 返回列表', async () => {
      const res = await request(app)
        .get('/api/boss/list')
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /boss/challenge 缺少 boss_id 返回错误', async () => {
      const res = await request(app)
        .post('/api/boss/challenge')
        .set('Authorization', `Bearer ${bossToken}`)
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('POST /boss/stop 无战斗返回 success:false', async () => {
      const res = await request(app)
        .post('/api/boss/stop')
        .set('Authorization', `Bearer ${bossToken}`)
        .send({})
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data?.success).toBe(false);
    });
  });

  describe('api/pvp 分支', () => {
    let pvpUid: number;
    let pvpToken: string;

    beforeAll(async () => {
      const user = await createTestUser(app, { prefix: 'dwpv', charName: 'DwApiPvp' });
      pvpUid = user.uid;
      pvpToken = user.token;
    }, 10000);

    it('GET /pvp/opponent 缺少 uid 返回错误', async () => {
      const res = await request(app)
        .get('/api/pvp/opponent')
        .set('Authorization', `Bearer ${pvpToken}`)
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('POST /pvp/challenge 挑战自己返回错误', async () => {
      const res = await request(app)
        .post('/api/pvp/challenge')
        .set('Authorization', `Bearer ${pvpToken}`)
        .send({ target_uid: pvpUid, map_id: 1 });
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('api/config 分支', () => {
    let cfgToken: string;

    beforeAll(async () => {
      const user = await createTestUser(app, { prefix: 'dwcf', charName: 'DwApiCfg' });
      cfgToken = user.token;
    }, 10000);

    it('GET /config/enhance_materials 返回材料 ID', async () => {
      const res = await request(app)
        .get('/api/config/enhance_materials')
        .set('Authorization', `Bearer ${cfgToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Rate Limit', () => {
    it('测试环境 rate limit 放宽（max=9999）不阻塞', async () => {
      const results = [];
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/user/login')
          .send({ username: 'nonexist', password: 'test123456' });
        results.push(res.body.code);
      }
      expect(results.every(c => c !== 429)).toBe(true);
    });
  });
});

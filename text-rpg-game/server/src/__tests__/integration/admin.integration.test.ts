/**
 * GM Admin API 集成测试 - 真实 DB，无 mock
 * 统一到 Jest，计入覆盖率
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';

const app = createApp();

describe('GM Admin API 集成测试', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data?.token).toBeDefined();
    token = res.body.data.token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('管理员登录', () => {
    it('缺少用户名或密码返回错误', async () => {
      const res = await request(app).post('/api/admin/login').send({}).expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('缺少用户名返回错误', async () => {
      const res = await request(app).post('/api/admin/login').send({ password: 'x' }).expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('缺少密码返回错误', async () => {
      const res = await request(app).post('/api/admin/login').send({ username: 'admin' }).expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('错误密码返回错误', async () => {
      const res = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'wrong' }).expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('非管理员用户登录失败', async () => {
      const reg = await request(app)
        .post('/api/user/register')
        .send({ username: `_nonadmin_${Date.now()}`, password: 'test123456' });
      if (reg.body.code !== 0) return;
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: reg.body.data?.username || '_nonadmin_', password: 'test123456' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('parseIdParam 无效参数', () => {
    it('GET 无效 id 返回错误', async () => {
      const res = await request(app).get('/api/admin/item/0').set(auth()).expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/无效|ID/);
    });

    it('GET 非数字 id 返回错误', async () => {
      const res = await request(app).get('/api/admin/item/abc').set(auth()).expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('物品 API', () => {
    it('物品列表(全量)', async () => {
      const res = await request(app).get('/api/admin/item').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('物品列表(分页)', async () => {
      const res = await request(app)
        .get('/api/admin/item?page=1&pageSize=20')
        .set(auth())
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data?.data).toBeDefined();
      expect(res.body.data?.total).toBeDefined();
    });

    it('物品列表(type=2 筛选)', async () => {
      const res = await request(app)
        .get('/api/admin/item?page=1&type=2')
        .set(auth())
        .expect(200);
      expect(res.body.code).toBe(0);
      if (res.body.data?.data?.length) {
        expect(res.body.data.data.every((i: any) => i.type === 2)).toBe(true);
      }
    });

    it('物品详情', async () => {
      const res = await request(app).get('/api/admin/item/1').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data?.id).toBeDefined();
    });

    it('物品增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({
          name: '_测试物品_勿留',
          type: 1,
          hp_restore: 10,
          mp_restore: 0,
          description: 'API测试用',
        })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const updateRes = await request(app)
        .put(`/api/admin/item/${id}`)
        .set(auth())
        .send({
          name: '_测试物品_已更新',
          type: 1,
          hp_restore: 20,
        })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/item/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });

    it('物品添加指定 id 已被占用时返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({
          id: 1,
          name: '_重复ID测试_',
          type: 1,
          description: 'id=1已存在',
        })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/已被占用|占用/);
    });

    it('物品 PUT 不存在的 id 返回 404', async () => {
      const res = await request(app)
        .put('/api/admin/item/99999')
        .set(auth())
        .send({ name: '_不存在_', type: 1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/不存在|404/);
    });
  });

  describe('装备基础 API', () => {
    it('装备基础列表', async () => {
      const res = await request(app).get('/api/admin/equip_base').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('装备基础详情(按 item_id)', async () => {
      const res = await request(app).get('/api/admin/equip_base/13').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data?.item_id).toBe(13);
    });

    it('装备基础详情(按 id)', async () => {
      const listRes = await request(app).get('/api/admin/equip_base').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (first?.id) {
        const res = await request(app).get(`/api/admin/equip_base/${first.id}`).set(auth()).expect(200);
        expect(res.body.code).toBe(0);
        expect(res.body.data?.id).toBe(first.id);
      }
    });

    it('装备基础不存在返回 404', async () => {
      const res = await request(app).get('/api/admin/equip_base/99999').set(auth()).expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/不存在|404/);
    });

    it('装备基础增删改', async () => {
      const itemRes = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({ name: '_测试装备基础', type: 2, pos: 2, description: 'test', base_level: 1 })
        .expect(200);
      if (itemRes.body.code !== 0 || !itemRes.body.data?.id) return;
      const itemId = itemRes.body.data.id;

      const listRes = await request(app).get('/api/admin/equip_base').set(auth()).expect(200);
      const eb = listRes.body.data?.find((e: any) => e.item_id === itemId);
      if (!eb) return;
      const ebId = eb.id;

      const putRes = await request(app)
        .put(`/api/admin/equip_base/${ebId}`)
        .set(auth())
        .send({ base_phy_atk: 20 })
        .expect(200);
      expect(putRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/equip_base/${ebId}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);

      const postRes = await request(app)
        .post('/api/admin/equip_base')
        .set(auth())
        .send({ item_id: itemId, base_phy_atk: 15 })
        .expect(200);
      expect(postRes.body.code).toBe(0);

      const newEbId = postRes.body.data?.id;
      if (newEbId) {
        await request(app).delete(`/api/admin/equip_base/${newEbId}`).set(auth());
      }
      await request(app).delete(`/api/admin/item/${itemId}`).set(auth());
    });

    it('装备基础重复创建返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/equip_base')
        .set(auth())
        .send({ item_id: 13 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/已有|存在/);
    });

    it('装备基础 POST 缺少 item_id 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/equip_base')
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/item_id|缺少/);
    });

    it('装备基础 POST 物品不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/equip_base')
        .set(auth())
        .send({ item_id: 99999 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/物品不存在/);
    });

    it('装备基础 PUT 无更新字段返回错误', async () => {
      const listRes = await request(app).get('/api/admin/equip_base').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (!first?.id) return;
      const res = await request(app)
        .put(`/api/admin/equip_base/${first.id}`)
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/无更新|字段/);
    });
  });

  describe('道具效果 API', () => {
    it('道具效果列表', async () => {
      const res = await request(app).get('/api/admin/item_effect').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('道具效果列表(item_id 筛选)', async () => {
      const res = await request(app).get('/api/admin/item_effect?item_id=1').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length) expect(res.body.data.every((d: any) => d.item_id === 1)).toBe(true);
    });

    it('道具效果详情、by-item、增删改', async () => {
      const itemRes = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({ name: '_效果测试物品_勿留', type: 4, description: 'test' })
        .expect(200);
      if (itemRes.body.code !== 0 || !itemRes.body.data?.id) return;
      const itemId = itemRes.body.data.id;

      const createRes = await request(app)
        .post('/api/admin/item_effect')
        .set(auth())
        .send({ item_id: itemId, effect_type: 'add_stat', attr: 'max_hp', value: 5 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const effId = createRes.body.data?.id;
      if (!effId) {
        await request(app).delete(`/api/admin/item/${itemId}`).set(auth());
        return;
      }

      const getRes = await request(app).get(`/api/admin/item_effect/${effId}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
      expect(getRes.body.data?.effect_type).toBe('add_stat');

      const byItemRes = await request(app).get(`/api/admin/item_effect/by-item/${itemId}`).set(auth()).expect(200);
      expect(byItemRes.body.code).toBe(0);
      expect(byItemRes.body.data?.item_id).toBe(itemId);

      const updateRes = await request(app)
        .put(`/api/admin/item_effect/${effId}`)
        .set(auth())
        .send({ value: 10 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/item_effect/${effId}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);

      const notFoundRes = await request(app).get(`/api/admin/item_effect/by-item/99999`).set(auth()).expect(200);
      expect(notFoundRes.body.code).not.toBe(0);

      await request(app).delete(`/api/admin/item/${itemId}`).set(auth());
    });

    it('道具效果重复创建返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/item_effect')
        .set(auth())
        .send({ item_id: 1, effect_type: 'restore' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/已有|存在/);
    });

    it('道具效果 POST 缺少 item_id 或 effect_type 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/item_effect')
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/item_id|effect_type|缺少/);
    });

    it('道具效果 POST 无效 effect_type 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/item_effect')
        .set(auth())
        .send({ item_id: 1, effect_type: 'invalid_type' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/无效|effect_type/);
    });

    it('道具效果 PUT 无更新字段返回错误', async () => {
      const listRes = await request(app).get('/api/admin/item_effect?item_id=1').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (!first?.id) return;
      const res = await request(app)
        .put(`/api/admin/item_effect/${first.id}`)
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/无更新|字段/);
    });

    it('道具效果 expand_bag 类型', async () => {
      const itemRes = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({ name: '_扩容袋测试_勿留', type: 4, description: 'test' })
        .expect(200);
      if (itemRes.body.code !== 0 || !itemRes.body.data?.id) return;
      const itemId = itemRes.body.data.id;

      const createRes = await request(app)
        .post('/api/admin/item_effect')
        .set(auth())
        .send({ item_id: itemId, effect_type: 'expand_bag', value: 30, max: 300 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const effId = createRes.body.data?.id;
      if (effId) {
        await request(app).delete(`/api/admin/item_effect/${effId}`).set(auth());
      }
      await request(app).delete(`/api/admin/item/${itemId}`).set(auth());
    });
  });

  describe('怪物掉落 API', () => {
    it('monster_drop POST 缺少参数返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/monster_drop')
        .set(auth())
        .send({ monster_id: 1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/item_id|缺少/);
    });

    it('monster_drop POST 怪物不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/monster_drop')
        .set(auth())
        .send({ monster_id: 99999, item_id: 1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/怪物不存在/);
    });

    it('monster_drop POST 物品不存在返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/monster_drop')
        .set(auth())
        .send({ monster_id: 1, item_id: 99999 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/物品不存在/);
    });

    it('monster_drop GET 支持 monster_id 筛选', async () => {
      const res = await request(app)
        .get('/api/admin/monster_drop?monster_id=1')
        .set(auth())
        .expect(200);
      expect(res.body.code).toBe(0);
      if (res.body.data?.length) {
        expect(res.body.data.every((d: any) => d.monster_id === 1)).toBe(true);
      }
    });

    it('monster_drop PUT 无更新字段返回错误', async () => {
      const listRes = await request(app).get('/api/admin/monster_drop').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (first?.id) {
        const res = await request(app)
          .put(`/api/admin/monster_drop/${first.id}`)
          .set(auth())
          .send({})
          .expect(200);
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/无更新|字段/);
      }
    });
  });

  describe('怪物 API 增删改', () => {
    it('怪物增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/monster')
        .set(auth())
        .send({ name: '_测试怪物_勿留', level: 1, hp: 100 })
        .expect(200);
      if (createRes.body.code !== 0 || !createRes.body.data?.id) return;
      const id = createRes.body.data.id;

      const getRes = await request(app).get(`/api/admin/monster/${id}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
      expect(getRes.body.data?.name).toContain('测试怪物');

      const updateRes = await request(app)
        .put(`/api/admin/monster/${id}`)
        .set(auth())
        .send({ name: '_测试怪物_已更新', level: 2, hp: 150 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/monster/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('地图 API', () => {
    it('map PUT 不存在的 id 返回 404', async () => {
      const res = await request(app)
        .put('/api/admin/map/99999')
        .set(auth())
        .send({ name: '_不存在的_', description: 'test' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/不存在|404/);
    });

    it('map POST 缺少 name 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/map')
        .set(auth())
        .send({ description: 'only desc' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/名称|缺少/);
    });

    it('map PUT 缺少 name 返回错误', async () => {
      const listRes = await request(app).get('/api/admin/map').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (first?.id) {
        const res = await request(app)
          .put(`/api/admin/map/${first.id}`)
          .set(auth())
          .send({ description: 'only desc' })
          .expect(200);
        expect(res.body.code).not.toBe(0);
      }
    });
  });

  describe('地图 API 增删改', () => {
    it('地图增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/map')
        .set(auth())
        .send({ name: '_测试地图_勿留', description: 'test' })
        .expect(200);
      if (createRes.body.code !== 0 || !createRes.body.data?.id) return;
      const id = createRes.body.data.id;

      const getRes = await request(app).get(`/api/admin/map/${id}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);

      const updateRes = await request(app)
        .put(`/api/admin/map/${id}`)
        .set(auth())
        .send({ name: '_测试地图_已更新', description: 'updated' })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/map/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('技能 API 增删改', () => {
    it('技能增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/skill')
        .set(auth())
        .send({ name: '_测试技能_勿留', type: 1, damage: 10 })
        .expect(200);
      if (createRes.body.code !== 0 || !createRes.body.data?.id) return;
      const id = createRes.body.data.id;

      const getRes = await request(app).get(`/api/admin/skill/${id}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);

      const updateRes = await request(app)
        .put(`/api/admin/skill/${id}`)
        .set(auth())
        .send({ name: '_测试技能_已更新', type: 1, damage: 20 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/skill/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('Boss 掉落 API', () => {
    it('boss_drop POST 缺少参数返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/boss_drop')
        .set(auth())
        .send({ boss_id: 1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/item_id|缺少/);
    });

    it('boss_drop PUT 无更新字段返回错误', async () => {
      const listRes = await request(app).get('/api/admin/boss_drop').set(auth()).expect(200);
      const first = listRes.body.data?.[0];
      if (first?.id) {
        const res = await request(app)
          .put(`/api/admin/boss_drop/${first.id}`)
          .set(auth())
          .send({})
          .expect(200);
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/无更新|字段/);
      }
    });

    it('Boss 掉落列表、详情、增删改', async () => {
      const listRes = await request(app).get('/api/admin/boss_drop').set(auth()).expect(200);
      expect(listRes.body.code).toBe(0);
      const filterRes = await request(app).get('/api/admin/boss_drop?boss_id=1').set(auth()).expect(200);
      expect(filterRes.body.code).toBe(0);

      const createRes = await request(app)
        .post('/api/admin/boss_drop')
        .set(auth())
        .send({ boss_id: 1, item_id: 1, quantity: 2, probability: 50 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const getRes = await request(app).get(`/api/admin/boss_drop/${id}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
      expect(getRes.body.data?.boss_id).toBe(1);

      const updateRes = await request(app)
        .put(`/api/admin/boss_drop/${id}`)
        .set(auth())
        .send({ quantity: 3, probability: 80 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/boss_drop/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });

    it('Boss 掉落缺少参数返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/boss_drop')
        .set(auth())
        .send({ boss_id: 1 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('怪物掉落 API', () => {
    it('怪物掉落列表、详情、增删改', async () => {
      const listRes = await request(app).get('/api/admin/monster_drop').set(auth()).expect(200);
      expect(listRes.body.code).toBe(0);
      const filterRes = await request(app).get('/api/admin/monster_drop?monster_id=1').set(auth()).expect(200);
      expect(filterRes.body.code).toBe(0);

      const createRes = await request(app)
        .post('/api/admin/monster_drop')
        .set(auth())
        .send({ monster_id: 1, item_id: 1, quantity: 1, probability: 30 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const getRes = await request(app).get(`/api/admin/monster_drop/${id}`).set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
      expect(getRes.body.data?.monster_id).toBe(1);

      const updateRes = await request(app)
        .put(`/api/admin/monster_drop/${id}`)
        .set(auth())
        .send({ quantity: 2, probability: 50 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/monster_drop/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('Boss API', () => {
    it('Boss 列表、详情', async () => {
      const listRes = await request(app).get('/api/admin/boss').set(auth()).expect(200);
      expect(listRes.body.code).toBe(0);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      const getRes = await request(app).get('/api/admin/boss/1').set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
      expect(getRes.body.data?.name).toBeDefined();
    });

    it('Boss 增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/boss')
        .set(auth())
        .send({ name: '_测试Boss_勿留', level: 1, hp: 200 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const updateRes = await request(app)
        .put(`/api/admin/boss/${id}`)
        .set(auth())
        .send({ name: '_测试Boss_已更新', level: 2, hp: 300 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/boss/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('商店 API', () => {
    it('商店列表、详情、type 筛选', async () => {
      const listRes = await request(app).get('/api/admin/shop').set(auth()).expect(200);
      expect(listRes.body.code).toBe(0);
      const typeRes = await request(app).get('/api/admin/shop?type=gold').set(auth()).expect(200);
      expect(typeRes.body.code).toBe(0);
      const getRes = await request(app).get('/api/admin/shop/1').set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
    });

    it('商店 POST 缺少参数返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/shop')
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/缺少|商店类型|物品|价格/);
    });

    it('商店 PUT 不存在的 id 返回 404', async () => {
      const res = await request(app)
        .put('/api/admin/shop/99999')
        .set(auth())
        .send({ price: 20 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/不存在|404/);
    });

    it('商店增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/shop')
        .set(auth())
        .send({ shop_type: 'gold', item_id: 2, price: 10, category: 'consumable' })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const updateRes = await request(app)
        .put(`/api/admin/shop/${id}`)
        .set(auth())
        .send({ price: 20, enabled: false })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/shop/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('等级经验 API', () => {
    it('等级列表、详情', async () => {
      const listRes = await request(app).get('/api/admin/level').set(auth()).expect(200);
      expect(listRes.body.code).toBe(0);
      const getRes = await request(app).get('/api/admin/level/1').set(auth()).expect(200);
      expect(getRes.body.code).toBe(0);
    });

    it('等级 POST 缺少 level 或 exp 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/level')
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/缺少|等级|经验/);
    });

    it('等级 PUT 不存在的 id 返回 404', async () => {
      const res = await request(app)
        .put('/api/admin/level/99999')
        .set(auth())
        .send({ level: 99, exp: 99999 })
        .expect(200);
      expect(res.body.code).not.toBe(0);
      expect(res.body.msg || '').toMatch(/不存在|404/);
    });

    it('等级增删改', async () => {
      const createRes = await request(app)
        .post('/api/admin/level')
        .set(auth())
        .send({ level: 99, exp: 99999 })
        .expect(200);
      expect(createRes.body.code).toBe(0);
      const id = createRes.body.data?.id;
      if (!id) return;

      const updateRes = await request(app)
        .put(`/api/admin/level/${id}`)
        .set(auth())
        .send({ level: 99, exp: 88888 })
        .expect(200);
      expect(updateRes.body.code).toBe(0);

      const delRes = await request(app).delete(`/api/admin/level/${id}`).set(auth()).expect(200);
      expect(delRes.body.code).toBe(0);
    });
  });

  describe('技能/掉落/地图/怪物/商店/等级', () => {
    it('技能列表', async () => {
      const res = await request(app).get('/api/admin/skill').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('怪物掉落列表', async () => {
      const res = await request(app).get('/api/admin/monster_drop').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Boss 掉落列表', async () => {
      const res = await request(app).get('/api/admin/boss_drop').set(auth()).expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('怪物/地图/商店/等级列表', async () => {
      const [mon, map, shop, lv] = await Promise.all([
        request(app).get('/api/admin/monster').set(auth()),
        request(app).get('/api/admin/map').set(auth()),
        request(app).get('/api/admin/shop').set(auth()),
        request(app).get('/api/admin/level').set(auth()),
      ]);
      expect(mon.body.code).toBe(0);
      expect(map.body.code).toBe(0);
      expect(shop.body.code).toBe(0);
      expect(lv.body.code).toBe(0);
    });
  });

  describe('装备一站式创建', () => {
    it('创建装备并同步 equip_base 后删除', async () => {
      const createRes = await request(app)
        .post('/api/admin/item')
        .set(auth())
        .send({
          name: '_测试装备_勿留',
          type: 2,
          pos: 1,
          description: 'API测试用',
          base_level: 1,
          base_phy_atk: 5,
        })
        .expect(200);
      if (createRes.body.code !== 0 || !createRes.body.data?.id) return;

      const id = createRes.body.data.id;
      const ebRes = await request(app).get('/api/admin/equip_base').set(auth());
      const found = ebRes.body.data?.find((e: any) => e.item_id === id);
      expect(found).toBeDefined();

      await request(app).delete(`/api/admin/item/${id}`).set(auth()).expect(200);
    });
  });

  describe('GM 发放', () => {
    it('发放金币和物品', async () => {
      const reg = await request(app)
        .post('/api/user/register')
        .send({ username: `_gm_give_${Date.now()}`, password: 'test123456' });
      if (reg.body.code !== 0) return;
      const uid = reg.body.data.uid;
      await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg.body.data.token}` }).send({ name: '_GM测试' });

      const goldRes = await request(app)
        .post('/api/admin/player/give-gold')
        .set(auth())
        .send({ uid, amount: 1000 })
        .expect(200);
      expect(goldRes.body.code).toBe(0);

      const itemRes = await request(app)
        .post('/api/admin/player/give-item')
        .set(auth())
        .send({ uid, item_id: 1, count: 5 })
        .expect(200);
      expect(itemRes.body.code).toBe(0);
    });
  });

  describe('GM 玩家管理', () => {
    it('物品列表、玩家详情、设置VIP、发放积分', async () => {
      const reg = await request(app)
        .post('/api/user/register')
        .send({ username: `_gm_player_${Date.now()}`, password: 'test123456' });
      if (reg.body.code !== 0) return;
      const uid = reg.body.data.uid;
      await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg.body.data.token}` }).send({ name: '_GM玩家测试' });

      const itemsRes = await request(app).get('/api/admin/player/items').set(auth()).expect(200);
      expect(itemsRes.body.code).toBe(0);
      expect(Array.isArray(itemsRes.body.data)).toBe(true);

      const detailRes = await request(app).get(`/api/admin/player/${uid}`).set(auth()).expect(200);
      expect(detailRes.body.code).toBe(0);
      expect(detailRes.body.data?.uid).toBe(uid);

      const vipRes = await request(app)
        .post('/api/admin/player/vip')
        .set(auth())
        .send({ uid, vip_level: 2, duration_hours: 24 })
        .expect(200);
      expect(vipRes.body.code).toBe(0);

      const pointsRes = await request(app)
        .post('/api/admin/player/give-points')
        .set(auth())
        .send({ uid, amount: 500 })
        .expect(200);
      expect(pointsRes.body.code).toBe(0);
    });

    it('玩家不存在返回错误', async () => {
      const res = await request(app).get('/api/admin/player/999999').set(auth()).expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('GM 用户管理', () => {
    it('解绑 IP', async () => {
      const username = `_gm_unbind_${Date.now()}`;
      const reg = await request(app)
        .post('/api/user/register')
        .send({ username, password: 'test123456' });
      if (reg.body.code !== 0) return;

      const res = await request(app)
        .post('/api/admin/user/unbind-ip')
        .set(auth())
        .send({ username })
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('解绑不存在的用户返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/user/unbind-ip')
        .set(auth())
        .send({ username: '_nonexistent_user_xyz_123' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });

    it('解绑缺少用户名返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/user/unbind-ip')
        .set(auth())
        .send({})
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('清除缓存', () => {
    it('clear-cache 有效 type 成功', async () => {
      const res = await request(app)
        .post('/api/admin/clear-cache')
        .set(auth())
        .send({ type: 'item' })
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('clear-cache 无效 type 返回错误', async () => {
      const res = await request(app)
        .post('/api/admin/clear-cache')
        .set(auth())
        .send({ type: 'invalid_type' })
        .expect(200);
      expect(res.body.code).not.toBe(0);
    });
  });

  describe('Admin API 分支覆盖补充', () => {
    describe('admin/auth 分支', () => {
      it('POST /api/admin/login 密码错误返回错误', async () => {
        const res = await request(app)
          .post('/api/admin/login')
          .send({ username: 'admin', password: 'wrongpassword' });
        expect(res.body.code).not.toBe(0);
      });

      it('POST /api/admin/clear-cache type=monster', async () => {
        const res = await request(app)
          .post('/api/admin/clear-cache')
          .set(auth())
          .send({ type: 'monster' });
        expect(res.body.code).toBe(0);
      });

      it('POST /api/admin/clear-cache type=skill', async () => {
        const res = await request(app)
          .post('/api/admin/clear-cache')
          .set(auth())
          .send({ type: 'skill' });
        expect(res.body.code).toBe(0);
      });

      it('POST /api/admin/clear-cache type=map', async () => {
        const res = await request(app)
          .post('/api/admin/clear-cache')
          .set(auth())
          .send({ type: 'map' });
        expect(res.body.code).toBe(0);
      });

      it('POST /api/admin/clear-cache type=item', async () => {
        const res = await request(app)
          .post('/api/admin/clear-cache')
          .set(auth())
          .send({ type: 'item' });
        expect(res.body.code).toBe(0);
      });
    });

    describe('admin/boss_drop PUT 分支', () => {
      let dropId: number;

      beforeAll(async () => {
        const res = await request(app)
          .post('/api/admin/boss_drop')
          .set(auth())
          .send({ boss_id: 1, item_id: 1, quantity: 1, probability: 10 });
        dropId = res.body.data?.id;
      });

      afterAll(async () => {
        if (dropId) await request(app).delete(`/api/admin/boss_drop/${dropId}`).set(auth());
      });

      it('PUT boss_drop 指向不存在的 boss 返回错误', async () => {
        if (!dropId) return;
        const res = await request(app)
          .put(`/api/admin/boss_drop/${dropId}`)
          .set(auth())
          .send({ boss_id: 99999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('PUT boss_drop 指向不存在的 item 返回错误', async () => {
        if (!dropId) return;
        const res = await request(app)
          .put(`/api/admin/boss_drop/${dropId}`)
          .set(auth())
          .send({ item_id: 99999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/monster_drop PUT 分支', () => {
      let dropId: number;

      beforeAll(async () => {
        const res = await request(app)
          .post('/api/admin/monster_drop')
          .set(auth())
          .send({ monster_id: 1, item_id: 1, quantity: 1, probability: 10 });
        dropId = res.body.data?.id;
      });

      afterAll(async () => {
        if (dropId) await request(app).delete(`/api/admin/monster_drop/${dropId}`).set(auth());
      });

      it('PUT monster_drop monster_id=99999 返回错误', async () => {
        if (!dropId) return;
        const res = await request(app)
          .put(`/api/admin/monster_drop/${dropId}`)
          .set(auth())
          .send({ monster_id: 99999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('PUT monster_drop item_id=99999 返回错误', async () => {
        if (!dropId) return;
        const res = await request(app)
          .put(`/api/admin/monster_drop/${dropId}`)
          .set(auth())
          .send({ item_id: 99999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/item 分支', () => {
      it('POST item type=4 + learn_skill 创建技能书', async () => {
        const res = await request(app)
          .post('/api/admin/item')
          .set(auth())
          .send({
            name: '_分支测试技能书_勿留',
            type: 4,
            description: 'branch test',
            effect_type: 'learn_skill',
            skill_name: '_分支测试技能_勿留',
            skill_type: 1,
            skill_damage: 15,
          });
        expect(res.body.code).toBe(0);
        const id = res.body.data?.id;
        if (id) await request(app).delete(`/api/admin/item/${id}`).set(auth());
      });

      it('PUT item 空 body 返回 "缺少名称或类型"', async () => {
        const createRes = await request(app)
          .post('/api/admin/item')
          .set(auth())
          .send({ name: '_空更新测试_勿留', type: 1, description: 'test' });
        const id = createRes.body.data?.id;
        if (!id) return;

        const res = await request(app)
          .put(`/api/admin/item/${id}`)
          .set(auth())
          .send({});
        expect(res.body.code).not.toBe(0);

        await request(app).delete(`/api/admin/item/${id}`).set(auth());
      });
    });

    describe('admin/equip_base 分支', () => {
      it('DELETE equip_base/99999 返回 "装备基础不存在"', async () => {
        const res = await request(app)
          .delete('/api/admin/equip_base/99999')
          .set(auth());
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('GET equip_base/99999 返回 404', async () => {
        const res = await request(app)
          .get('/api/admin/equip_base/99999')
          .set(auth());
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/item_effect PUT 分支', () => {
      let effId: number;
      let itemId: number;

      beforeAll(async () => {
        const itemRes = await request(app)
          .post('/api/admin/item')
          .set(auth())
          .send({ name: '_效果PUT测试_勿留', type: 4, description: 'test' });
        itemId = itemRes.body.data?.id;
        if (!itemId) return;

        const effRes = await request(app)
          .post('/api/admin/item_effect')
          .set(auth())
          .send({ item_id: itemId, effect_type: 'expand_bag', value: 20, max: 200 });
        effId = effRes.body.data?.id;
      });

      afterAll(async () => {
        if (effId) await request(app).delete(`/api/admin/item_effect/${effId}`).set(auth());
        if (itemId) await request(app).delete(`/api/admin/item/${itemId}`).set(auth());
      });

      it('PUT item_effect item_id=99999 返回 "物品不存在"', async () => {
        if (!effId) return;
        const res = await request(app)
          .put(`/api/admin/item_effect/${effId}`)
          .set(auth())
          .send({ item_id: 99999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/物品不存在/);
      });

      it('PUT item_effect expand_bag value+max 成功', async () => {
        if (!effId) return;
        const res = await request(app)
          .put(`/api/admin/item_effect/${effId}`)
          .set(auth())
          .send({ effect_type: 'expand_bag', value: 60, max: 600 });
        expect(res.body.code).toBe(0);
      });

      it('PUT item_effect add_stat attr+value 成功', async () => {
        if (!effId) return;
        const res = await request(app)
          .put(`/api/admin/item_effect/${effId}`)
          .set(auth())
          .send({ effect_type: 'add_stat', attr: 'phy_atk', value: 5 });
        expect(res.body.code).toBe(0);
      });
    });

    describe('admin/map 分支', () => {
      it('POST map 带 level_min + level_max 成功', async () => {
        const res = await request(app)
          .post('/api/admin/map')
          .set(auth())
          .send({ name: '_分支地图_勿留', level_min: 1, level_max: 10 });
        expect(res.body.code).toBe(0);
        const id = res.body.data?.id;
        if (id) await request(app).delete(`/api/admin/map/${id}`).set(auth());
      });

      it('PUT map/99999 返回 "地图不存在"', async () => {
        const res = await request(app)
          .put('/api/admin/map/99999')
          .set(auth())
          .send({ name: '_不存在_', description: 'x' });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/player 分支', () => {
      it('GET player/abc 返回 "无效的玩家UID"', async () => {
        const res = await request(app)
          .get('/api/admin/player/abc')
          .set(auth());
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/无效|UID/);
      });

      it('GET player/99999 返回 "玩家不存在"', async () => {
        const res = await request(app)
          .get('/api/admin/player/99999')
          .set(auth());
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('POST give-gold uid=99999 返回 "玩家不存在"', async () => {
        const res = await request(app)
          .post('/api/admin/player/give-gold')
          .set(auth())
          .send({ uid: 99999, amount: 100 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('POST give-points uid=99999 返回 "玩家不存在"', async () => {
        const res = await request(app)
          .post('/api/admin/player/give-points')
          .set(auth())
          .send({ uid: 99999, amount: 100 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('POST give-item uid=99999 返回 "玩家不存在"', async () => {
        const res = await request(app)
          .post('/api/admin/player/give-item')
          .set(auth())
          .send({ uid: 99999, item_id: 1, count: 1 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });

      it('POST give-item item_id=99999 返回 "物品不存在"', async () => {
        const user = await createTestUser(app, { prefix: 'bca' });
        const res = await request(app)
          .post('/api/admin/player/give-item')
          .set(auth())
          .send({ uid: user.uid, item_id: 99999, count: 1 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/物品不存在/);
      });

      it('POST vip uid=99999 返回 "玩家不存在"', async () => {
        const res = await request(app)
          .post('/api/admin/player/vip')
          .set(auth())
          .send({ uid: 99999, vip_level: 1, duration_hours: 24 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/shop 分支', () => {
      it('POST shop 带完整字段成功', async () => {
        const res = await request(app)
          .post('/api/admin/shop')
          .set(auth())
          .send({ shop_type: 'gold', item_id: 1, price: 50, category: 'consumable' });
        expect(res.body.code).toBe(0);
        const id = res.body.data?.id;
        if (id) await request(app).delete(`/api/admin/shop/${id}`).set(auth());
      });

      it('PUT shop/99999 返回 "商品不存在"', async () => {
        const res = await request(app)
          .put('/api/admin/shop/99999')
          .set(auth())
          .send({ price: 999 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/level 分支', () => {
      it('POST level 成功', async () => {
        const uniqueLevel = 9000 + Math.floor(Math.random() * 999);
        const res = await request(app)
          .post('/api/admin/level')
          .set(auth())
          .send({ level: uniqueLevel, exp: 999999 });
        expect(res.body.code).toBe(0);
        const id = res.body.data?.id;
        if (id) await request(app).delete(`/api/admin/level/${id}`).set(auth());
      });
    });

    describe('admin/skill 分支', () => {
      it('POST skill 缺少 name 返回错误', async () => {
        const res = await request(app)
          .post('/api/admin/skill')
          .set(auth())
          .send({ type: 1, damage: 10 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/缺少|参数/);
      });

      it('PUT skill/99999 返回 "技能不存在"', async () => {
        const res = await request(app)
          .put('/api/admin/skill/99999')
          .set(auth())
          .send({ name: '_不存在_', type: 1, damage: 10 });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });

    describe('admin/user 分支', () => {
      it('POST unbind-ip 不存在的用户返回错误', async () => {
        const res = await request(app)
          .post('/api/admin/user/unbind-ip')
          .set(auth())
          .send({ username: '_branch_cov_nonexistent_999' });
        expect(res.body.code).not.toBe(0);
        expect(res.body.msg || '').toMatch(/不存在/);
      });
    });
  });
});

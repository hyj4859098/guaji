/**
 * ItemEffectService 集成测试 - execute 各 effect_type 分支
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { ItemEffectService } from '../../service/item-effect.service';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { dataStorageService } from '../../service/data-storage.service';
import { giveItem } from '../../__test-utils__/integration-helpers';
import { ErrorCode } from '../../utils/error';

const app = createApp();
const UNIQUE = `_ie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('ItemEffectService 集成测试', () => {
  let uid: number;
  let adminToken: string;
  const bagService = new BagService();
  const playerService = new PlayerService();

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = adminRes.body.data?.token;
    if (!adminToken) throw new Error('admin login failed');

    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    uid = reg.body.data.uid;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg.body.data.token}` }).send({ name: '道具效果测试' });
  }, 10000);

  it('execute 无 effect 配置返回 ok:false', async () => {
    const result = await ItemEffectService.execute(uid, 99999, 1);
    expect(result.ok).toBe(false);
  });

  it('execute 无玩家抛错', async () => {
    await expect(ItemEffectService.execute(999999, 1, 1)).rejects.toThrow();
  });

  it('restore 仅 addMp 生效', async () => {
    const allItems = await dataStorageService.list('item', undefined);
    const mpOnlyItem = allItems.find((i: any) => (i.hp_restore || 0) <= 0 && (i.mp_restore || 0) > 0);
    if (mpOnlyItem) {
      const eff = await dataStorageService.getByCondition('item_effect', { item_id: mpOnlyItem.id });
      if (eff?.effect_type === 'restore') {
        await request(app).post('/api/admin/player/give-item').set({ Authorization: `Bearer ${adminToken}` }).send({ uid, item_id: mpOnlyItem.id, count: 1 });
        const list = await bagService.list(uid);
        const item = list.find((i: any) => i.item_id === mpOnlyItem.id);
        if (item) {
          const ok = await bagService.useItem(uid, item.original_id ?? item.id, 1);
          expect(ok).toBe(true);
        }
      }
    }
  });

  it('execute 未知 effect_type 返回 ok:false', async () => {
    const TEST_ITEM_ID = 999990001;
    await dataStorageService.insert('item', { id: TEST_ITEM_ID, name: '_unknown_effect_', type: 4, description: '' });
    await dataStorageService.insert('item_effect', { item_id: TEST_ITEM_ID, effect_type: 'unknown_type', create_time: 0, update_time: 0 });
    try {
      const result = await ItemEffectService.execute(uid, TEST_ITEM_ID, 1);
      expect(result.ok).toBe(false);
    } finally {
      await dataStorageService.deleteMany('item_effect', { item_id: TEST_ITEM_ID });
      await dataStorageService.delete('item', TEST_ITEM_ID);
    }
  });

  it('expand_bag actualCount 超过 maxUsable 抛错', async () => {
    const config = await dataStorageService.getByCondition('config', { name: 'functional_items' });
    const expandId = config?.value ? (typeof config.value === 'string' ? JSON.parse(config.value) : config.value).expand_bag : 11;
    if (!expandId) return;
    await request(app).post('/api/admin/player/give-item').set({ Authorization: `Bearer ${adminToken}` }).send({ uid, item_id: expandId, count: 5 });
    const players = await playerService.list(uid);
    if (players.length) {
      const currentCap = players[0].equipment_capacity ?? 100;
      await playerService.update(players[0].id, { equipment_capacity: 450 } as any);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === expandId && !i.equipment_uid && (i.count || 0) >= 2);
      if (item) {
        await expect(bagService.useItem(uid, item.original_id ?? item.id, 2)).rejects.toMatchObject({
          code: ErrorCode.INVALID_PARAMS,
        });
      }
      await playerService.update(players[0].id, { equipment_capacity: currentCap } as any);
    }
  });

  it('add_stat 永久属性果实使用成功', async () => {
    const statFruitIds = (await dataStorageService.getByCondition('config', { name: 'functional_items' }))?.value;
    const ids = statFruitIds ? (typeof statFruitIds === 'string' ? JSON.parse(statFruitIds) : statFruitIds).stat_fruit_ids : [120];
    if (!ids?.length) return;
    const fruitId = ids[0];
    await request(app).post('/api/admin/player/give-item').set({ Authorization: `Bearer ${adminToken}` }).send({ uid, item_id: fruitId, count: 1 });
    const list = await bagService.list(uid);
    const item = list.find((i: any) => i.item_id === fruitId && !i.equipment_uid);
    if (item) {
      const ok = await bagService.useItem(uid, item.original_id ?? item.id, 1);
      expect(ok).toBe(true);
    }
  });

  it('expand_bag 容量已达上限抛错', async () => {
    const config = await dataStorageService.getByCondition('config', { name: 'functional_items' });
    const expandId = config?.value ? (typeof config.value === 'string' ? JSON.parse(config.value) : config.value).expand_bag : 11;
    if (!expandId) return;
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: expandId, count: 1 });
    const players = await playerService.list(uid);
    if (players.length) {
      const max = 500;
      await playerService.update(players[0].id, { equipment_capacity: max } as any);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === expandId && !i.equipment_uid);
      if (item) {
        await expect(bagService.useItem(uid, item.original_id ?? item.id, 1)).rejects.toMatchObject({
          code: ErrorCode.INVALID_PARAMS,
        });
      }
      await playerService.update(players[0].id, { equipment_capacity: 100 } as any);
    }
  });

  it('execute vip 效果 - VIP卡使用成功', async () => {
    await giveItem(uid, 201, 1);
    const list = await bagService.list(uid);
    const vipItem = list.find((i: any) => i.item_id === 201 && !i.equipment_uid);
    expect(vipItem).toBeDefined();

    const itemInfo = await dataStorageService.getByCondition('item', { id: 201 });
    const result = await ItemEffectService.execute(uid, 201, 1, itemInfo);
    expect(result.ok).toBe(true);

    const players = await playerService.list(uid);
    expect(players[0].vip_level).toBe(1);
    expect(players[0].vip_expire_time).toBeGreaterThan(0);
  });

  it('execute learn_skill 效果 - 技能书使用成功', async () => {
    await giveItem(uid, 14, 1);
    const list = await bagService.list(uid);
    const bookItem = list.find((i: any) => i.item_id === 14 && !i.equipment_uid);
    expect(bookItem).toBeDefined();

    const ok = await bagService.useItem(uid, bookItem!.original_id ?? bookItem!.id, 1);
    expect(ok).toBe(true);
  });

  it('execute add_stat 效果 - 非 max_hp/max_mp 属性（phy_atk 果实）', async () => {
    const statFruitId = 122;
    await giveItem(uid, statFruitId, 1);
    const list = await bagService.list(uid);
    const fruit = list.find((i: any) => i.item_id === statFruitId && !i.equipment_uid);
    if (!fruit) return;

    const playersBefore = await playerService.list(uid);
    const atkBefore = (playersBefore[0] as any).phy_atk ?? 0;

    const ok = await bagService.useItem(uid, fruit.original_id ?? fruit.id, 1);
    expect(ok).toBe(true);

    const playersAfter = await playerService.list(uid);
    expect((playersAfter[0] as any).phy_atk).toBeGreaterThanOrEqual(atkBefore);
  });

  it('execute add_stat 效果 - max_hp with also_add_current', async () => {
    const statFruitId = 120;
    await giveItem(uid, statFruitId, 1);
    const list = await bagService.list(uid);
    const fruit = list.find((i: any) => i.item_id === statFruitId && !i.equipment_uid);
    if (!fruit) return;

    const ok = await bagService.useItem(uid, fruit.original_id ?? fruit.id, 1);
    expect(ok).toBe(true);
  });

  it('execute boost 效果 - 多倍卡使用成功', async () => {
    await giveItem(uid, 101, 1);
    const list = await bagService.list(uid);
    const boostItem = list.find((i: any) => i.item_id === 101 && !i.equipment_uid);
    expect(boostItem).toBeDefined();

    const itemInfo = await dataStorageService.getByCondition('item', { id: 101 });
    const result = await ItemEffectService.execute(uid, 101, 1, itemInfo);
    expect(result.ok).toBe(true);
  });
});

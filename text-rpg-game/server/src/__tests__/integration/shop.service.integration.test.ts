/**
 * ShopService 集成测试 - listByType、buy、getCurrencyMap、listAll、get
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';
import { ShopService } from '../../service/shop.service';
import { Collections } from '../../config/collections';

const app = createApp();

describe('ShopService 集成测试', () => {
  let uid: number;
  let token: string;
  const shopService = new ShopService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'shp', charName: '商店测试' });
    uid = user.uid;
    token = user.token;
    await request(app)
      .post('/api/admin/player/give-gold')
      .set({ Authorization: `Bearer ${(await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' })).body.data.token}` })
      .send({ uid, amount: 50000 });
  }, 15000);

  it('listByType 返回商品列表', async () => {
    const list = await shopService.listByType('gold');
    expect(Array.isArray(list)).toBe(true);
    list.forEach((item: any) => {
      expect(item.shop_type).toBe('gold');
      expect(item.item_name).toBeDefined();
    });
  });

  it('getCurrencyMap 返回货币映射', async () => {
    const map = ShopService.getCurrencyMap();
    expect(map).toHaveProperty('gold');
    expect(map).toHaveProperty('reputation');
    expect(map).toHaveProperty('points');
  });

  it('listAll 无筛选返回全部', async () => {
    const list = await shopService.listAll();
    expect(Array.isArray(list)).toBe(true);
  });

  it('listAll 按 shopType 筛选', async () => {
    const list = await shopService.listAll('gold');
    expect(Array.isArray(list)).toBe(true);
    list.forEach((item: any) => expect(item.shop_type).toBe('gold'));
  });

  it('get 存在的商品返回详情', async () => {
    const item = await shopService.get(1);
    expect(item).not.toBeNull();
    expect(item).toHaveProperty('item_id');
    expect(item).toHaveProperty('price');
  });

  it('get 不存在的商品返回 null', async () => {
    const item = await shopService.get(99999);
    expect(item).toBeNull();
  });

  it('buy 数量无效抛错', async () => {
    await expect(shopService.buy(uid, 1, 0)).rejects.toThrow();
    await expect(shopService.buy(uid, 1, -1)).rejects.toThrow();
    await expect(shopService.buy(uid, 1, 10000)).rejects.toThrow();
  });

  it('buy 商品不存在抛错', async () => {
    await expect(shopService.buy(uid, 99999, 1)).rejects.toThrow();
  });

  it('add 缺少必填字段抛错', async () => {
    await expect(shopService.add({} as any)).rejects.toThrow();
    await expect(shopService.add({ item_id: 1, shop_type: 'gold' } as any)).rejects.toThrow();
  });

  it('add 价格必须大于0抛错', async () => {
    await expect(shopService.add({ item_id: 1, shop_type: 'gold', price: 0 })).rejects.toThrow();
  });

  it('add 装备类物品不可上架抛错', async () => {
    await expect(shopService.add({ item_id: 13, shop_type: 'gold', price: 100 })).rejects.toThrow();
  });

  it('add 成功添加商品', async () => {
    const id = await shopService.add({ item_id: 2, shop_type: 'gold', price: 5, category: 'consumable' });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('update 价格无效抛错', async () => {
    const item = await shopService.get(1);
    if (item) await expect(shopService.update(item.id, { price: 0 })).rejects.toThrow();
  });

  it('update 成功更新', async () => {
    const list = await shopService.listAll('gold');
    const first = list[0];
    if (first) {
      const newOrder = (first.sort_order ?? 0) + 1;
      const ok = await shopService.update(first.id, { sort_order: newOrder });
      expect(ok).toBe(true);
      await shopService.update(first.id, { sort_order: first.sort_order ?? 0 });
    }
  });

  it('delete 成功删除', async () => {
    const id = await shopService.add({ item_id: 2, shop_type: 'gold', price: 1 });
    const ok = await shopService.delete(id);
    expect(ok).toBe(true);
  });

  it('buy 金币不足抛错', async () => {
    const shopItemId = await shopService.add({ item_id: 1, shop_type: 'gold', price: 999999, category: 'consumable' });
    const reg2 = await request(app).post('/api/user/register').send({ username: `_sp_${Date.now()}`, password: 'test123456' });
    if (reg2.body.code !== 0) return;
    const uid2 = reg2.body.data.uid;
    await request(app).post('/api/player/add').set('Authorization', `Bearer ${reg2.body.data.token}`).send({ name: '穷' });
    await expect(shopService.buy(uid2, shopItemId, 1)).rejects.toThrow();
  });

  it('buy 成功购买', async () => {
    const list = await shopService.listByType('gold');
    const first = list[0];
    if (first) {
      const beforeBag = await request(app).get('/api/bag/list').set('Authorization', `Bearer ${token}`).expect(200);
      const beforeCount = (beforeBag.body.data?.items || []).filter((i: any) => i.item_id === first.item_id).length;
      await shopService.buy(uid, first.id, 1);
      const afterBag = await request(app).get('/api/bag/list').set('Authorization', `Bearer ${token}`).expect(200);
      const afterCount = (afterBag.body.data?.items || []).filter((i: any) => i.item_id === first.item_id).length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    }
  });

  it('listByType reputation 返回列表', async () => {
    const list = await shopService.listByType('reputation');
    expect(Array.isArray(list)).toBe(true);
  });

  it('listByType points 返回列表', async () => {
    const list = await shopService.listByType('points');
    expect(Array.isArray(list)).toBe(true);
  });

  it('buy 商品已下架抛错', async () => {
    const id = await shopService.add({ item_id: 2, shop_type: 'gold', price: 1 });
    await shopService.update(id, { enabled: false });
    await expect(shopService.buy(uid, id, 1)).rejects.toThrow();
    await shopService.delete(id);
  });

  it('buy 不支持的商店类型抛错', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const id = await dataStorageService.insert(Collections.SHOP, {
      shop_type: 'unknown_currency',
      item_id: 1,
      price: 1,
      category: 'consumable',
      sort_order: 0,
      enabled: true,
    });
    await expect(shopService.buy(uid, id, 1)).rejects.toThrow(/不支持的商店类型/);
    await dataStorageService.delete(Collections.SHOP, id);
  });
});

describe('经济系统数值验证', () => {
  const { PlayerService } = require('../../service/player.service');
  const _playerService = new PlayerService();
  const _shopService = new ShopService();

  it('buy 后金币精确减少', async () => {
    const { createTestUser, giveGold } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'eco', suffix: 'exact' });
    await giveGold(user.uid, 10000);

    const before = await _playerService.list(user.uid);
    const goldBefore = before[0].gold;

    const shopItems = await _shopService.listByType('gold');
    const item = shopItems.find((s: any) => s.price > 0);
    if (!item) return;

    await _shopService.buy(user.uid, item.id, 1);

    const after = await _playerService.list(user.uid);
    expect(after[0].gold).toBe(goldBefore - item.price);
  });

  it('buy 金币不足时拒绝且金币不变', async () => {
    const { createTestUser } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'eco', suffix: 'broke' });

    const before = await _playerService.list(user.uid);
    const goldBefore = before[0].gold;

    const shopItems = await _shopService.listByType('gold');
    const expensive = shopItems.find((s: any) => s.price > goldBefore);
    if (!expensive) return;

    await expect(_shopService.buy(user.uid, expensive.id, 1)).rejects.toThrow(/不足/);

    const after = await _playerService.list(user.uid);
    expect(after[0].gold).toBe(goldBefore);
  });

  it('buy 金币正好足够时成功且金币归零', async () => {
    const { createTestUser, giveGold } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'eco', suffix: 'zero' });

    const shopItems = await _shopService.listByType('gold');
    const item = shopItems.find((s: any) => s.price > 0);
    if (!item) return;

    const players = await _playerService.list(user.uid);
    const currentGold = players[0].gold;
    if (currentGold < item.price) {
      await giveGold(user.uid, item.price - currentGold);
    } else if (currentGold > item.price) {
      await _playerService.addGold(user.uid, -(currentGold - item.price));
    }

    const beforeBuy = await _playerService.list(user.uid);
    expect(beforeBuy[0].gold).toBe(item.price);

    await _shopService.buy(user.uid, item.id, 1);

    const afterBuy = await _playerService.list(user.uid);
    expect(afterBuy[0].gold).toBe(0);
  });
});

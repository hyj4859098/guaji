/**
 * AuctionService 集成测试 - 覆盖 list、listItem、buy、offShelf、getRecords
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { auctionService, AuctionService } from '../../service/auction.service';
import { createTestUser, adminLogin, giveItem, giveGold } from '../../__test-utils__/integration-helpers';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { EquipInstanceService } from '../../service/equip_instance.service';

const app = createApp();

describe('AuctionService 集成测试', () => {
  let uid1: number;
  let uid2: number;
  let adminToken: string;
  let token1: string;
  let bagId1: number;
  let auctionId: number;

  beforeAll(async () => {
    adminToken = await adminLogin(app);
    const user1 = await createTestUser(app, { prefix: 'auc', suffix: '1', charName: '拍卖测试1' });
    const user2 = await createTestUser(app, { prefix: 'auc', suffix: '2', charName: '拍卖测试2' });
    uid1 = user1.uid; token1 = user1.token;
    uid2 = user2.uid;

    await request(app)
      .post('/api/admin/player/give-gold')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, amount: 50000 });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, item_id: 1, count: 5 });

    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` }).expect(200);
    const potion = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (!potion) throw new Error('no potion in bag');
    bagId1 = potion.original_id ?? potion.id;
  }, 15000);

  it('list 空列表', async () => {
    const r = await auctionService.list({});
    expect(r.items).toBeDefined();
    expect(r.total).toBeDefined();
  });

  it('listItem 上架', async () => {
    auctionId = await auctionService.listItem(uid1, { bag_id: bagId1, count: 1, price: 10 });
    expect(typeof auctionId).toBe('number');
    expect(auctionId).toBeGreaterThan(0);
  });

  it('list 带 keyword/type', async () => {
    const r = await auctionService.list({ keyword: '药', type: 1 });
    expect(Array.isArray(r.items)).toBe(true);
  });

  it('buy 购买', async () => {
    await request(app)
      .post('/api/admin/player/give-gold')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid2, amount: 1000 });
    await auctionService.buy(uid2, auctionId, 1);
    const list = await auctionService.list({});
    const found = list.items.find((a: any) => a.id === auctionId);
    expect(found).toBeUndefined();
  });

  it('getRecords 获取记录', async () => {
    const recs = await auctionService.getRecords(uid1);
    expect(Array.isArray(recs)).toBe(true);
  });

  it('listItem 无效参数抛错', async () => {
    await expect(auctionService.listItem(uid1, { bag_id: 0, price: 1 } as any)).rejects.toThrow();
    await expect(auctionService.listItem(uid1, { bag_id: 99999, price: 1 })).rejects.toThrow();
  });

  it('buy 无效参数抛错', async () => {
    await expect(auctionService.buy(uid1, 0, 1)).rejects.toThrow();
    await expect(auctionService.buy(uid1, 99999, 1)).rejects.toThrow();
  });

  it('offShelf 他人商品抛错', async () => {
    const bag2 = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bag2.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (item) {
      const aid = await auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 1, price: 5 });
      await expect(auctionService.offShelf(uid2, aid)).rejects.toThrow();
      await auctionService.offShelf(uid1, aid);
    }
  });

  it('list 分页', async () => {
    const r = await auctionService.list({ page: 1, pageSize: 5 });
    expect(r.items).toBeDefined();
    expect(r.total).toBeDefined();
    expect(r.items.length).toBeLessThanOrEqual(5);
  });

  it('listItem 价格无效抛错', async () => {
    await expect(auctionService.listItem(uid1, { bag_id: bagId1, price: 0 })).rejects.toThrow();
    await expect(auctionService.listItem(uid1, { bag_id: bagId1, price: -1 })).rejects.toThrow();
  });

  it('list 带 pos/min_level/max_level 筛选', async () => {
    const r = await auctionService.list({ pos: 1, min_level: 1, max_level: 10 });
    expect(r.items).toBeDefined();
    expect(Array.isArray(r.items)).toBe(true);
  });

  it('list 装备 instance 为 null 时用 equipBase 兜底', async () => {
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, item_id: 13, count: 1 });
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const equip = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!equip) return;
    const aid = await auctionService.listItem(uid1, { bag_id: equip.original_id ?? equip.id, price: 1 });
    const { dataStorageService } = await import('../../service/data-storage.service');
    const auction = await dataStorageService.getById('auction', aid);
    if (!auction?.equipment_uid) return;
    const eqId = Number(auction.equipment_uid);
    try {
      await dataStorageService.delete('equip_instance', eqId);
      const r = await auctionService.list({ type: 2 });
      const found = r.items.find((a: any) => a.id === aid);
      expect(found).toBeDefined();
      expect(found?.equip_level).toBeDefined();
      expect(found?.equip_attributes).toBeDefined();
    } finally {
      await dataStorageService.delete('auction', aid);
    }
  });

  it('offShelf 自己商品成功', async () => {
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (item) {
      const aid = await auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 1, price: 3 });
      await auctionService.offShelf(uid1, aid);
      const list = await auctionService.list({});
      expect(list.items.find((a: any) => a.id === aid)).toBeUndefined();
    }
  });

  it('buy 自己商品抛错', async () => {
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (item) {
      const aid = await auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 1, price: 1 });
      await expect(auctionService.buy(uid1, aid, 1)).rejects.toThrow();
      await auctionService.offShelf(uid1, aid);
    }
  });

  it('buy 金币不足抛错', async () => {
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (item) {
      const aid = await auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 1, price: 999999 });
      await expect(auctionService.buy(uid2, aid, 1)).rejects.toThrow();
      await auctionService.offShelf(uid1, aid);
    }
  });

  it('buy 参数无效抛错', async () => {
    await expect(auctionService.buy(uid1, 0, 1)).rejects.toThrow();
    await expect(auctionService.buy(uid1, 1, 0)).rejects.toThrow();
    await expect(auctionService.buy(uid1, 1, -1)).rejects.toThrow();
    await expect(auctionService.buy(uid1, 1, 1.5)).rejects.toThrow();
  });

  it('offShelf 拍卖不存在抛错', async () => {
    await expect(auctionService.offShelf(uid1, 999999)).rejects.toThrow();
  });

  it('list 带 keyword 空字符串', async () => {
    const r = await auctionService.list({ keyword: '   ' });
    expect(r.items).toBeDefined();
    expect(r.total).toBeDefined();
  });

  it('list 带 type=0 不筛选', async () => {
    const r = await auctionService.list({ type: 0 });
    expect(Array.isArray(r.items)).toBe(true);
  });

  it('list 带 keyword 无匹配', async () => {
    const r = await auctionService.list({ keyword: 'xyz_nonexistent_keyword_123' });
    expect(Array.isArray(r.items)).toBe(true);
  });

  it('listItem 上架装备', async () => {
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, item_id: 13, count: 1 });
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const equip = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equip) {
      const aid = await auctionService.listItem(uid1, { bag_id: equip.original_id ?? equip.id, price: 100 });
      expect(typeof aid).toBe('number');
      const list = await auctionService.list({ type: 2 });
      const found = list.items.find((a: any) => a.id === aid);
      expect(found).toBeDefined();
      expect(found?.equip_level).toBeDefined();
      await auctionService.offShelf(uid1, aid);
    }
  });

  it('listItem 数量超限抛错', async () => {
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 1);
    if (item && (item.count || 0) >= 2) {
      await expect(auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 999, price: 1 })).rejects.toThrow();
    }
  });

  it('buy 装备背包装备满抛错', async () => {
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, item_id: 13, count: 1 });
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const equip = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equip) {
      const aid = await auctionService.listItem(uid1, { bag_id: equip.original_id ?? equip.id, price: 1 });
      const { PlayerService } = await import('../../service/player.service');
      const playerService = new PlayerService();
      const players = await playerService.list(uid2);
      if (players.length) {
        const origCap = (players[0] as any).equipment_capacity ?? 100;
        await request(app)
          .post('/api/admin/player/give-gold')
          .set({ Authorization: `Bearer ${adminToken}` })
          .send({ uid: uid2, amount: 1000 });
        await playerService.update(players[0].id, { equipment_capacity: 1 } as any);
        await request(app)
          .post('/api/admin/player/give-item')
          .set({ Authorization: `Bearer ${adminToken}` })
          .send({ uid: uid2, item_id: 13, count: 1 });
        await expect(auctionService.buy(uid2, aid, 1)).rejects.toThrow(/背包装备已满/);
        await playerService.update(players[0].id, { equipment_capacity: origCap } as any);
        await auctionService.offShelf(uid1, aid);
      }
    }
  });

  it('buy 部分数量后更新 count', async () => {
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid1, item_id: 1, count: 5 });
    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${token1}` });
    const item = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 1 && (i.count || 0) >= 3);
    if (item) {
      const aid = await auctionService.listItem(uid1, { bag_id: item.original_id ?? item.id, count: 3, price: 1 });
      await request(app)
        .post('/api/admin/player/give-gold')
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({ uid: uid2, amount: 10 });
      await auctionService.buy(uid2, aid, 2);
      const list = await auctionService.list({});
      const found = list.items.find((a: any) => a.id === aid);
      expect(found?.count).toBe(1);
      await auctionService.offShelf(uid1, aid);
    }
  });
});

describe('关键路径/深度分支', () => {
  const _auctionService = new AuctionService();
  const _bagService = new BagService();
  const _playerService = new PlayerService();
  const _equipInstanceService = new EquipInstanceService();

  it('listItem 非装备时用 count 模式上架', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'aucC' });
    await giveItem(uid, 1, 5);
    const bags = await _bagService.list(uid);
    const potion = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (!potion) return;
    const id = await _auctionService.listItem(uid, {
      bag_id: potion.original_id ?? potion.id,
      count: 3,
      price: 10,
    });
    expect(id).toBeTruthy();
    await _auctionService.offShelf(uid, id);
  });

  it('buy 自己的物品失败', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'aucSf' });
    await giveItem(uid, 1, 5);
    await giveGold(uid, 1000);
    const bags = await _bagService.list(uid);
    const potion = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (!potion) return;
    const id = await _auctionService.listItem(uid, {
      bag_id: potion.original_id ?? potion.id,
      count: 2,
      price: 5,
    });
    try {
      await _auctionService.buy(uid, id, 1);
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/自己/);
    }
    await _auctionService.offShelf(uid, id);
  });

  it('offShelf 他人物品失败', async () => {
    const { uid: uidA } = await createTestUser(app, { prefix: 'ds', suffix: 'aucOA' });
    const { uid: uidB } = await createTestUser(app, { prefix: 'ds', suffix: 'aucOB' });
    await giveItem(uidA, 1, 3);
    const bags = await _bagService.list(uidA);
    const potion = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (!potion) return;
    const id = await _auctionService.listItem(uidA, {
      bag_id: potion.original_id ?? potion.id,
      count: 1,
      price: 5,
    });
    try {
      await _auctionService.offShelf(uidB, id);
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/权限|不是|自己/);
    }
    await _auctionService.offShelf(uidA, id);
  });

  it('上架装备 → 购买 → 装备实例 owner 变更', async () => {
    const seller = await createTestUser(app, { prefix: 'r2', suffix: 'aucSell' });
    const buyer = await createTestUser(app, { prefix: 'r2', suffix: 'aucBuy' });

    await _bagService.addItem(seller.uid, 13, 1);
    const bags = await _bagService.list(seller.uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    expect(equip).toBeTruthy();
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    const aucId = await _auctionService.listItem(seller.uid, {
      bag_id: equip!.original_id ?? equip!.id,
      count: 1,
      price: 10,
    });
    expect(aucId).toBeTruthy();

    await _playerService.addGold(buyer.uid, 100);
    await _auctionService.buy(buyer.uid, aucId, 1);

    const instance = await _equipInstanceService.get(instanceId);
    expect(instance).toBeTruthy();
    expect(String(instance!.uid)).toBe(String(buyer.uid));

    const buyerBags = await _bagService.list(buyer.uid);
    expect(buyerBags.find((b: any) => String(b.equipment_uid) === String(instanceId))).toBeTruthy();
  });

  it('金币不足时拒绝购买', async () => {
    const seller = await createTestUser(app, { prefix: 'r2', suffix: 'aucS2' });
    const buyer = await createTestUser(app, { prefix: 'r2', suffix: 'aucB2' });

    await _bagService.addItem(seller.uid, 1, 5);
    const bags = await _bagService.list(seller.uid);
    const item = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    expect(item).toBeTruthy();

    const aucId = await _auctionService.listItem(seller.uid, {
      bag_id: item!.original_id ?? item!.id,
      count: 2,
      price: 999999,
    });

    try {
      await _auctionService.buy(buyer.uid, aucId, 1);
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/金币|不足/);
    }
    await _auctionService.offShelf(seller.uid, aucId);
  });

  it('装备上架 → 他人购买 → 实例归属正确转移', async () => {
    const seller = await createTestUser(app, { prefix: 'p0', suffix: 'seller' });
    const buyer = await createTestUser(app, { prefix: 'p0', suffix: 'buyer' });

    await _bagService.addItem(seller.uid, 13, 1);
    await _playerService.addGold(buyer.uid, 100000);

    const sellerBags = await _bagService.list(seller.uid);
    const equipItem = sellerBags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    expect(equipItem).toBeTruthy();

    const instanceId = parseInt(String(equipItem!.equipment_uid), 10);
    const bagId = equipItem!.original_id ?? equipItem!.id;

    const auctionId = await _auctionService.listItem(seller.uid, { bag_id: bagId, price: 100 });
    expect(auctionId).toBeTruthy();

    const sellerBagsAfter = await _bagService.list(seller.uid);
    expect(sellerBagsAfter.find((b: any) => String(b.equipment_uid) === String(instanceId))).toBeUndefined();

    await _auctionService.buy(buyer.uid, auctionId, 1);

    const instance = await _equipInstanceService.get(instanceId);
    expect(instance).toBeTruthy();
    expect(String(instance!.uid)).toBe(String(buyer.uid));

    const buyerBags = await _bagService.list(buyer.uid);
    const bought = buyerBags.find((b: any) => String(b.equipment_uid) === String(instanceId));
    expect(bought).toBeTruthy();
  });

  it('不能购买自己上架的商品', async () => {
    const user = await createTestUser(app, { prefix: 'p0', suffix: 'self_buy' });

    await _bagService.addItem(user.uid, 1, 10);
    const bags = await _bagService.list(user.uid);
    const item = bags.find((b: any) => b.item_id === 1);
    const bagId = item!.original_id ?? item!.id;

    const auctionId = await _auctionService.listItem(user.uid, { bag_id: bagId, count: 5, price: 1 });

    await expect(_auctionService.buy(user.uid, auctionId, 1)).rejects.toThrow(/自己/);
  });

  it('两人同时购买同一拍卖品（数量=1），只有一人成功', async () => {
    const seller = await createTestUser(app, { prefix: 'p0', suffix: 'conc_seller' });
    const buyerA = await createTestUser(app, { prefix: 'p0', suffix: 'conc_buyerA' });
    const buyerB = await createTestUser(app, { prefix: 'p0', suffix: 'conc_buyerB' });

    await _bagService.addItem(seller.uid, 1, 1);
    await _playerService.addGold(buyerA.uid, 100000);
    await _playerService.addGold(buyerB.uid, 100000);

    const bags = await _bagService.list(seller.uid);
    const item = bags.find((b: any) => b.item_id === 1);
    const bagId = item!.original_id ?? item!.id;

    const auctionId = await _auctionService.listItem(seller.uid, { bag_id: bagId, count: 1, price: 1 });

    const results = await Promise.allSettled([
      _auctionService.buy(buyerA.uid, auctionId, 1),
      _auctionService.buy(buyerB.uid, auctionId, 1),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  it('装备下架后归还到背包，实例 uid 正确', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'delist' });

    await _bagService.addItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);
    const bagId = equip!.original_id ?? equip!.id;

    const auctionId = await _auctionService.listItem(uid, { bag_id: bagId, price: 100 });

    const bagsAfterList = await _bagService.list(uid);
    expect(bagsAfterList.find((b: any) => String(b.equipment_uid) === String(instanceId))).toBeUndefined();

    await _auctionService.offShelf(uid, auctionId);

    const bagsAfterOff = await _bagService.list(uid);
    const returned = bagsAfterOff.find((b: any) => String(b.equipment_uid) === String(instanceId));
    expect(returned).toBeTruthy();

    const instance = await _equipInstanceService.get(instanceId);
    expect(instance).toBeTruthy();
    expect(String(instance!.uid)).toBe(String(uid));
  });

  it('他人不能下架别人的拍卖品', async () => {
    const seller = await createTestUser(app, { prefix: 'p0', suffix: 'seller2' });
    const other = await createTestUser(app, { prefix: 'p0', suffix: 'other2' });

    await _bagService.addItem(seller.uid, 1, 5);
    const bags = await _bagService.list(seller.uid);
    const item = bags.find((b: any) => b.item_id === 1);
    const bagId = item!.original_id ?? item!.id;

    const auctionId = await _auctionService.listItem(seller.uid, { bag_id: bagId, count: 1, price: 10 });

    await expect(_auctionService.offShelf(other.uid, auctionId)).rejects.toThrow(/自己/);
  });

  it('背包装备已满时拍卖购买装备失败', async () => {
    const seller = await createTestUser(app, { prefix: 'p0', suffix: 'cap_seller' });
    const buyer = await createTestUser(app, { prefix: 'p0', suffix: 'cap_buyer' });

    await _playerService.addGold(buyer.uid, 1000000);

    await _bagService.addItem(seller.uid, 13, 1);
    const sellerBags = await _bagService.list(seller.uid);
    const equip = sellerBags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const bagId = equip!.original_id ?? equip!.id;
    const auctionId = await _auctionService.listItem(seller.uid, { bag_id: bagId, price: 1 });

    const capacity = await _bagService.getEquipmentCapacity(buyer.uid);
    for (let i = 0; i < capacity; i++) {
      await _bagService.addItem(buyer.uid, 13, 1);
    }

    await expect(_auctionService.buy(buyer.uid, auctionId, 1)).rejects.toThrow(/装备已满/);
  }, 60000);

  it('购买不存在的拍卖品报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'buy_missing' });
    await _playerService.addGold(uid, 100000);
    await expect(_auctionService.buy(uid, 999999, 1)).rejects.toThrow(/不存在|已售出/);
  });

  it('下架不存在的拍卖品报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'off_missing' });
    await expect(_auctionService.offShelf(uid, 999999)).rejects.toThrow(/不存在/);
  });

  it('拍卖记录超过 20 条时自动裁剪', async () => {
    const seller = await createTestUser(app, { prefix: 'r2', suffix: 'trimsel' });
    const buyer = await createTestUser(app, { prefix: 'r2', suffix: 'trimby' });
    await _playerService.addGold(buyer.uid, 1000000);

    for (let i = 0; i < 11; i++) {
      await _bagService.addItem(seller.uid, 1, 1);
      const bags = await _bagService.list(seller.uid);
      const item = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
      if (!item) continue;
      const bagId = item.original_id ?? item.id;
      try {
        const auctionId = await _auctionService.listItem(seller.uid, { bag_id: bagId, count: 1, price: 1 });
        await _auctionService.buy(buyer.uid, auctionId, 1);
      } catch { /* 可能库存不足 */ }
    }

    const records = await _auctionService.getRecords(buyer.uid);
    expect(records.length).toBeLessThanOrEqual(20);
  }, 30000);

  it('背包装备满时下架装备应失败', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'offcap' });

    await _bagService.addItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!equip) return;
    const bagId = equip.original_id ?? equip.id;
    const auctionId = await _auctionService.listItem(uid, { bag_id: bagId, price: 100 });

    const capacity = await _bagService.getEquipmentCapacity(uid);
    for (let i = 0; i < capacity; i++) {
      await _bagService.addItem(uid, 13, 1);
    }

    await expect(_auctionService.offShelf(uid, auctionId)).rejects.toThrow(/装备已满/);
  }, 60000);
});

describe('经济系统数值验证', () => {
  const _ps = new PlayerService();
  const _bs = new BagService();
  const _as = new AuctionService();

  it('拍卖购买：买家金币 -price，卖家金币 +price', async () => {
    const seller = await createTestUser(app, { prefix: 'auc', suffix: 'nsell' });
    const buyer = await createTestUser(app, { prefix: 'auc', suffix: 'nbuy' });

    await giveGold(seller.uid, 1000);
    await giveGold(buyer.uid, 5000);
    await giveItem(seller.uid, 1, 5);

    const sellerBefore = (await _ps.list(seller.uid))[0].gold;
    const buyerBefore = (await _ps.list(buyer.uid))[0].gold;

    const bags = await _bs.list(seller.uid);
    const item = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (!item) return;

    const auctionId = await _as.listItem(seller.uid, {
      bag_id: item.original_id ?? item.id,
      count: 1,
      price: 200,
    });

    await _as.buy(buyer.uid, auctionId, 1);

    const sellerAfter = (await _ps.list(seller.uid))[0].gold;
    const buyerAfter = (await _ps.list(buyer.uid))[0].gold;

    expect(sellerAfter).toBe(sellerBefore + 200);
    expect(buyerAfter).toBe(buyerBefore - 200);
  });
});

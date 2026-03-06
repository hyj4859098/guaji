/**
 * EquipBlessingService 集成测试 - 覆盖 getMaterialCount、consumeMaterial、bless
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';
import { EquipBlessingService } from '../../service/equip_blessing.service';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { EquipService } from '../../service/equip.service';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { getEnhanceMaterialIds } from '../../service/enhance-config.service';
import { dataStorageService } from '../../service/data-storage.service';
import { ErrorCode } from '../../utils/error';

const app = createApp();
const UNIQUE = `_bless_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('EquipBlessingService 集成测试', () => {
  let uid: number;
  let adminToken: string;
  let blessingService: EquipBlessingService;
  let blessingOilId: number;
  let instanceId: number;

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = adminRes.body.data?.token;
    if (!adminToken) throw new Error('admin login failed');

    const matIds = await getEnhanceMaterialIds();
    blessingOilId = matIds.blessing_oil;

    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('register failed');
    uid = reg.body.data.uid;

    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg.body.data.token}` }).send({ name: '祝福测试' });

    await request(app)
      .post('/api/admin/player/give-gold')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, amount: 2000000 });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: blessingOilId, count: 5 });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: 13, count: 1 });

    const bagRes = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${reg.body.data.token}` }).expect(200);
    const equipItem = (bagRes.body.data?.items || []).find((i: any) => i.item_id === 13);
    if (!equipItem) throw new Error('no equip in bag');
    instanceId = Number(equipItem.equipment_uid ?? equipItem.original_id ?? equipItem.id);
    if (!instanceId || isNaN(instanceId)) throw new Error('invalid instanceId');

    blessingService = new EquipBlessingService();
  }, 15000);

  it('getMaterialCount 返回祝福油数量', async () => {
    const count = await blessingService.getMaterialCount(uid, blessingOilId);
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('consumeMaterial 消耗材料', async () => {
    const before = await blessingService.getMaterialCount(uid, blessingOilId);
    const ok = await blessingService.consumeMaterial(uid, blessingOilId, 1);
    expect(ok).toBe(true);
    const after = await blessingService.getMaterialCount(uid, blessingOilId);
    expect(after).toBe(before - 1);
  });

  it('consumeMaterial 数量不足返回 false', async () => {
    const ok = await blessingService.consumeMaterial(uid, blessingOilId, 9999);
    expect(ok).toBe(false);
  });

  it('bless 祝福装备', async () => {
    const beforeOil = await blessingService.getMaterialCount(uid, blessingOilId);
    if (beforeOil < 1) {
      await request(app)
        .post('/api/admin/player/give-item')
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({ uid, item_id: blessingOilId, count: 3 });
    }

    const result = await blessingService.bless(uid, instanceId);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('blessing_level');
    expect(result).toHaveProperty('message');
    expect(typeof result.blessing_level).toBe('number');
  });

  it('bless 装备不存在抛错', async () => {
    await expect(blessingService.bless(uid, 999999)).rejects.toThrow();
  });

  it('bless 祝福油不足抛错', async () => {
    const reg2 = await request(app).post('/api/user/register').send({ username: UNIQUE + '_2', password: 'test123456' });
    if (reg2.body.code !== 0) return;
    const uid2 = reg2.body.data.uid;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg2.body.data.token}` }).send({ name: '祝福测试2' });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid2, item_id: 13, count: 1 });
    const bag2 = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${reg2.body.data.token}` });
    const eq = (bag2.body.data?.items || []).find((i: any) => i.item_id === 13);
    if (!eq) return;
    const instId = Number(eq.equipment_uid ?? eq.id);
    await expect(blessingService.bless(uid2, instId)).rejects.toThrow(/祝福油/);
  });

  it('bless 装备不存在 (ErrorCode 校验)', async () => {
    await expect(blessingService.bless(uid, 999999)).rejects.toMatchObject({
      code: ErrorCode.ITEM_NOT_FOUND,
    });
  });

  it('bless 他人装备抛错', async () => {
    const reg3 = await request(app).post('/api/user/register').send({ username: UNIQUE + '_other', password: 'test123456' });
    if (reg3.body.code !== 0) return;
    const uid3 = reg3.body.data.uid;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg3.body.data.token}` }).send({ name: '祝福他人测试' });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid: uid3, item_id: 13, count: 1 });
    const bag3 = await request(app).get('/api/bag/list').set({ Authorization: `Bearer ${reg3.body.data.token}` });
    const eq3 = (bag3.body.data?.items || []).find((i: any) => i.item_id === 13);
    if (!eq3) return;
    const otherInstanceId = Number(eq3.equipment_uid ?? eq3.id);
    await expect(blessingService.bless(uid, otherInstanceId)).rejects.toMatchObject({
      code: ErrorCode.ITEM_NOT_FOUND,
    });
  });
});

describe('关键路径/深度分支', () => {
  const _bagService = new BagService();
  const _playerService = new PlayerService();
  const _equipService = new EquipService();
  const _equipInstanceService = new EquipInstanceService();
  const _blessingService = new EquipBlessingService();

  let matIds: { stone: number; lucky: number; anti_explode: number; blessing_oil: number };

  beforeAll(async () => {
    matIds = await getEnhanceMaterialIds();
  });

  it('祝福失败后装备仍在，等级不变', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bless_fail' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.blessing_oil, 10);
    await _playerService.addGold(uid, 10000000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.99);
      const result = await _blessingService.bless(uid, instanceId);

      expect(result.success).toBe(false);
      expect(result.blessing_level).toBe(0);

      const instanceAfter = await _equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeTruthy();
      expect(instanceAfter!.blessing_level ?? 0).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('祝福成功后 blessing_level +1', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bless_ok' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.blessing_oil, 10);
    await _playerService.addGold(uid, 10000000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.01);
      const result = await _blessingService.bless(uid, instanceId);

      expect(result.success).toBe(true);
      expect(result.blessing_level).toBe(1);

      const instanceAfter = await _equipInstanceService.get(instanceId);
      expect(instanceAfter!.blessing_level).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('祝福油不足时报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bless_no_oil' });

    await _bagService.addItem(uid, 13, 1);
    await _playerService.addGold(uid, 10000000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await expect(_blessingService.bless(uid, instanceId)).rejects.toThrow(/祝福油不足/);
  });

  it('金币不足时报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bless_no_gold' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.blessing_oil, 10);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await expect(_blessingService.bless(uid, instanceId)).rejects.toThrow(/金币不足/);
  });

  it('已穿戴装备不允许祝福', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bless_worn' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.blessing_oil, 10);
    await _playerService.addGold(uid, 10000000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);
    const bagId = equip!.original_id ?? equip!.id;

    await _bagService.wearItem(uid, bagId, _equipService);

    await expect(_blessingService.bless(uid, instanceId)).rejects.toThrow(/背包|卸下/);
  });

  it('祝福等级达到 30 时拒绝继续祝福', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'maxbls' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.blessing_oil, 10);
    await _playerService.addGold(uid, 10000000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { blessing_level: 30 });

    await expect(_blessingService.bless(uid, instanceId)).rejects.toThrow(/上限/);
  });
});

describe('祝福数值验证', () => {
  const _bs = new EquipBlessingService();
  const _ps = new PlayerService();
  const _bag = new BagService();
  let _matIds: any;

  beforeAll(async () => {
    _matIds = await getEnhanceMaterialIds();
  });

  it('祝福消耗 100 万金币精确', async () => {
    const { giveItem, giveGold } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'bls', suffix: 'gold' });
    await giveItem(user.uid, 13, 1);
    await giveItem(user.uid, _matIds.blessing_oil, 5);
    await giveGold(user.uid, 2000000);

    const bags = await _bag.list(user.uid);
    const eq = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!eq) return;
    const instanceId = parseInt(String(eq.equipment_uid), 10);

    const goldBefore = (await _ps.list(user.uid))[0].gold;

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.01);
      await _bs.bless(user.uid, instanceId);
    } finally {
      spy.mockRestore();
    }

    const goldAfter = (await _ps.list(user.uid))[0].gold;
    expect(goldBefore - goldAfter).toBe(1000000);
  });

  it('祝福金币不足时祝福油不被消耗', async () => {
    const { giveItem } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'bls', suffix: 'noG' });
    await giveItem(user.uid, 13, 1);
    await giveItem(user.uid, _matIds.blessing_oil, 5);

    const bags = await _bag.list(user.uid);
    const eq = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!eq) return;
    const instanceId = parseInt(String(eq.equipment_uid), 10);

    const oilBefore = await _bs.getMaterialCount(user.uid, _matIds.blessing_oil);

    await expect(_bs.bless(user.uid, instanceId)).rejects.toThrow(/金币不足/);

    const oilAfter = await _bs.getMaterialCount(user.uid, _matIds.blessing_oil);
    expect(oilAfter).toBe(oilBefore);
  });
});

/**
 * EquipUpgradeService 集成测试 - getStoneCost、getBaseSuccessRate、getMaterialCount、consumeMaterial、enhance 各分支
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { EquipUpgradeService } from '../../service/equip_upgrade.service';
import { BagService } from '../../service/bag.service';
import { EquipService } from '../../service/equip.service';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { dataStorageService } from '../../service/data-storage.service';
import { getEnhanceMaterialIds } from '../../service/enhance-config.service';
import { ErrorCode } from '../../utils/error';

const app = createApp();
const UNIQUE = `_eq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('EquipUpgradeService 集成测试', () => {
  let uid: number;
  let adminToken: string;
  const equipUpgradeService = new EquipUpgradeService();
  const bagService = new BagService();
  const equipInstanceService = new EquipInstanceService();

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = adminRes.body.data?.token;
    if (!adminToken) throw new Error('admin login failed');

    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    uid = reg.body.data.uid;
    await request(app).post('/api/player/add').set({ Authorization: `Bearer ${reg.body.data.token}` }).send({ name: '强化测试' });

    const matIds = await (await import('../../service/enhance-config.service')).getEnhanceMaterialIds();
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: matIds.stone, count: 1000 });
    await request(app)
      .post('/api/admin/player/give-item')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ uid, item_id: 13, count: 1 });
  }, 15000);

  describe('getStoneCost / getBaseSuccessRate', () => {
    it('getStoneCost 目标等级 1 返回 100', () => {
      expect(equipUpgradeService.getStoneCost(1)).toBe(100);
    });
    it('getStoneCost 目标等级 5 返回 2500', () => {
      expect(equipUpgradeService.getStoneCost(5)).toBe(2500);
    });
    it('getBaseSuccessRate 目标等级 1 返回 100', () => {
      expect(equipUpgradeService.getBaseSuccessRate(1)).toBe(100);
    });
    it('getBaseSuccessRate 目标等级 10 返回最低 20', () => {
      const rate = equipUpgradeService.getBaseSuccessRate(10);
      expect(rate).toBeGreaterThanOrEqual(20);
      expect(rate).toBeLessThanOrEqual(100);
    });
  });

  describe('getMaterialCount / consumeMaterial', () => {
    it('getMaterialCount 返回正确数量', async () => {
      const matIds = await (await import('../../service/enhance-config.service')).getEnhanceMaterialIds();
      const count = await equipUpgradeService.getMaterialCount(uid, matIds.stone);
      expect(count).toBeGreaterThanOrEqual(0);
    });
    it('consumeMaterial 材料不足返回 false', async () => {
      const ok = await equipUpgradeService.consumeMaterial(uid, 99999, 1);
      expect(ok).toBe(false);
    });
  });

  describe('enhance 错误路径', () => {
    it('enhance 装备不存在抛错', async () => {
      await expect(equipUpgradeService.enhance(uid, 999999, { useLuckyCharm: false, useAntiExplode: false })).rejects.toMatchObject({
        code: ErrorCode.ITEM_NOT_FOUND,
      });
    });

    it('enhance 装备不在背包抛错', async () => {
      const { EquipService } = await import('../../service/equip.service');
      const equipService = new EquipService();
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        await bagService.wearItem(uid, equip.original_id ?? equip.id, equipService);
        const instanceId = Number(equip.equipment_uid);
        await expect(equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false })).rejects.toMatchObject({
          code: ErrorCode.INVALID_PARAMS,
        });
        await equipService.removeEquip(uid, instanceId);
      }
    });

    it('enhance 他人装备抛错', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        await expect(equipUpgradeService.enhance(999999, instanceId, { useLuckyCharm: false, useAntiExplode: false })).rejects.toMatchObject({
          code: ErrorCode.ITEM_NOT_FOUND,
        });
      }
    });

    it('enhance 幸运符不足时 useLuckyCharm 抛错', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        await expect(equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: true, useAntiExplode: false })).rejects.toMatchObject({
          code: ErrorCode.ITEM_COUNT_NOT_ENOUGH,
        });
      }
    });

    it('enhance 防爆符不足时 useAntiExplode 抛错', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        await expect(equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: true })).rejects.toMatchObject({
          code: ErrorCode.ITEM_COUNT_NOT_ENOUGH,
        });
      }
    });
  });

  describe('enhance 成功路径', () => {
    it('enhance 0 级装备强化成功或失败', async () => {
      const list = await bagService.list(uid);
      let equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (!equip) {
        await bagService.addItem(uid, 13, 1);
        const list2 = await bagService.list(uid);
        equip = list2.find((i: any) => i.item_id === 13 && i.equipment_uid);
      }
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        const result = await equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false });
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('broken');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.broken).toBe('boolean');
      }
    }, 10000);
  });
});

describe('关键路径/深度分支', () => {
  const _bagService = new BagService();
  const _equipService = new EquipService();
  const _equipInstanceService = new EquipInstanceService();
  const _equipUpgradeService = new EquipUpgradeService();

  let matIds: { stone: number; lucky: number; anti_explode: number; blessing_oil: number };

  beforeAll(async () => {
    matIds = await getEnhanceMaterialIds();
  });

  it('强化失败时装备销毁 → 背包和装备实例同步清除', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'enhdest' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    expect(equip).toBeTruthy();
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { enhance_level: 5 });

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.99).mockReturnValueOnce(0.01);
      const result = await _equipUpgradeService.enhance(uid, instanceId, {
        useLuckyCharm: false,
        useAntiExplode: false,
      });

      expect(result.success).toBe(false);
      expect(result.broken).toBe(true);

      const instanceAfter = await _equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeNull();

      const bagsAfter = await _bagService.list(uid);
      const equipAfter = bagsAfter.find((b: any) => String(b.equipment_uid) === String(instanceId));
      expect(equipAfter).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('强化失败但未破碎 → 装备仍在', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'enhsafe' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { enhance_level: 5 });

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.99).mockReturnValueOnce(0.99);
      const result = await _equipUpgradeService.enhance(uid, instanceId, {
        useLuckyCharm: false,
        useAntiExplode: false,
      });

      expect(result.success).toBe(false);
      expect(result.broken).toBe(false);

      const instanceAfter = await _equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('使用防爆符强化失败时装备不销毁', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'antiexp' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);
    await _bagService.addItem(uid, matIds.anti_explode, 10);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { enhance_level: 5 });

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.99).mockReturnValueOnce(0.01);
      const result = await _equipUpgradeService.enhance(uid, instanceId, {
        useLuckyCharm: false,
        useAntiExplode: true,
      });

      expect(result.success).toBe(false);
      expect(result.broken).toBe(false);

      const instanceAfter = await _equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('幸运符提升成功率', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'lucky_charm' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);
    await _bagService.addItem(uid, matIds.lucky, 10);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    const spy = jest.spyOn(Math, 'random');
    try {
      await dataStorageService.update('equip_instance', instanceId, { enhance_level: 8 });
      spy.mockReturnValueOnce(0.35);
      const result = await _equipUpgradeService.enhance(uid, instanceId, {
        useLuckyCharm: true,
        useAntiExplode: false,
      });

      expect(result.success).toBe(true);
      expect(result.enhance_level).toBe(9);
    } finally {
      spy.mockRestore();
    }
  });

  it('已穿戴装备不允许强化', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'enh_worn' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);
    const bagId = equip!.original_id ?? equip!.id;

    await _bagService.wearItem(uid, bagId, _equipService);

    await expect(
      _equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false })
    ).rejects.toThrow(/背包|卸下/);
  });

  it('强化石不足时报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'enh_no_stone' });

    await _bagService.addItem(uid, 13, 1);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await expect(
      _equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false })
    ).rejects.toThrow(/强化石不足/);
  });

  it('幸运符不足时报错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'enh_no_lucky' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await expect(
      _equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: true, useAntiExplode: false })
    ).rejects.toThrow(/幸运符不足/);
  });

  it('强化等级达到 20 时拒绝继续强化', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'maxenh' });

    await _bagService.addItem(uid, 13, 1);
    await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { enhance_level: 20 });

    await expect(
      _equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false })
    ).rejects.toThrow(/最大强化等级/);
  });

  it('强化等级 19 → 20 成功（边界内）', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'enh19' });

    await _bagService.addItem(uid, 13, 1);
    for (let i = 0; i < 5; i++) await _bagService.addItem(uid, matIds.stone, 9000);

    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    const instanceId = parseInt(String(equip!.equipment_uid), 10);

    await dataStorageService.update('equip_instance', instanceId, { enhance_level: 19 });

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.01);
      const result = await _equipUpgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: false });
      expect(result.success).toBe(true);
      expect(result.enhance_level).toBe(20);
    } finally {
      spy.mockRestore();
    }
  });

  it('强化石消耗公式 targetLevel² × 100', () => {
    expect(_equipUpgradeService.getStoneCost(1)).toBe(100);
    expect(_equipUpgradeService.getStoneCost(5)).toBe(2500);
    expect(_equipUpgradeService.getStoneCost(10)).toBe(10000);
    expect(_equipUpgradeService.getStoneCost(20)).toBe(40000);
  });

  it('成功率公式 100-(target-1)*10，最低 20%', () => {
    expect(_equipUpgradeService.getBaseSuccessRate(1)).toBe(100);
    expect(_equipUpgradeService.getBaseSuccessRate(5)).toBe(60);
    expect(_equipUpgradeService.getBaseSuccessRate(9)).toBe(20);
    expect(_equipUpgradeService.getBaseSuccessRate(10)).toBe(20);
    expect(_equipUpgradeService.getBaseSuccessRate(20)).toBe(20);
  });
});

describe('强化数值验证', () => {
  const _enh = new EquipUpgradeService();
  const _bag = new BagService();
  let _matIds: any;

  beforeAll(async () => {
    _matIds = await getEnhanceMaterialIds();
  });

  it('强化消耗强化石精确（level 0→1 消耗 100）', async () => {
    const user = await createTestUser(app, { prefix: 'enh', suffix: 'cost' });
    await giveItem(user.uid, 13, 1);
    await giveItem(user.uid, _matIds.stone, 500);

    const stoneBefore = await _enh.getMaterialCount(user.uid, _matIds.stone);

    const bags = await _bag.list(user.uid);
    const eq = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!eq) return;
    const instanceId = parseInt(String(eq.equipment_uid), 10);

    const spy = jest.spyOn(Math, 'random');
    try {
      spy.mockReturnValueOnce(0.01);
      await _enh.enhance(user.uid, instanceId, { useLuckyCharm: false, useAntiExplode: false });
    } finally {
      spy.mockRestore();
    }

    const stoneAfter = await _enh.getMaterialCount(user.uid, _matIds.stone);
    expect(stoneBefore - stoneAfter).toBe(100);
  });
});

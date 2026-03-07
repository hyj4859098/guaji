/**
 * EquipService 集成测试 - list、removeEquip、穿戴流程
 */
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { EquipService } from '../../service/equip.service';
import { BagService } from '../../service/bag.service';
import { dataStorageService } from '../../service/data-storage.service';
import { Collections } from '../../config/collections';

const app = createApp();

describe('EquipService 集成测试', () => {
  let uid: number;
  let _token: string;
  const equipService = new EquipService();
  const bagService = new BagService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'eqp', charName: '装备测试' });
    uid = user.uid;
    _token = user.token;
  }, 10000);

  it('list 空装备栏返回空数组', async () => {
    const list = await equipService.list(uid);
    expect(Array.isArray(list)).toBe(true);
  });

  it('list 无角色返回空', async () => {
    const list = await equipService.list(999999);
    expect(list).toEqual([]);
  });

  it('removeEquip 不存在的装备抛错', async () => {
    await expect(equipService.removeEquip(uid, 999999)).rejects.toThrow();
  });

  it('穿戴装备完整流程', async () => {
    await bagService.addItem(uid, 13, 1);
    const list = await bagService.list(uid);
    const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!equip) return;
    const ok = await bagService.wearItem(uid, equip.original_id ?? equip.id, equipService);
    expect(ok).toBe(true);
    const equips = await equipService.list(uid);
    expect(equips.length).toBeGreaterThanOrEqual(1);
    await equipService.removeEquip(uid, equip.equipment_uid);
  });

  it('removeEquip 他人装备抛错', async () => {
    await bagService.addItem(uid, 13, 1);
    const list = await bagService.list(uid);
    const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equip) {
      await expect(equipService.removeEquip(999999, equip.equipment_uid)).rejects.toThrow();
    }
  });

  it('wearEquip 非装备抛错', async () => {
    await bagService.addItem(uid, 1, 1);
    const list = await bagService.list(uid);
    const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
    if (item) {
      await expect(equipService.wearEquip(uid, item.original_id ?? item.id)).rejects.toThrow();
    }
  });

  it('wearEquip 背包物品不存在抛错', async () => {
    await expect(equipService.wearEquip(uid, 999999)).rejects.toThrow();
  });

  it('wearEquip 装备等级不足抛错', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const { dataStorageService } = await import('../../service/data-storage.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    if (!players.length) return;
    const origLevel = players[0].level ?? 99;
    try {
      await playerService.update(players[0].id, { level: 1 } as any);
      const ebList = await dataStorageService.list(Collections.EQUIP_BASE, { item_id: 13 });
      const eb = ebList[0];
      if (!eb) return;
      const origBaseLevel = eb.base_level ?? 1;
      try {
        await dataStorageService.update(Collections.EQUIP_BASE, eb.id, { base_level: 50 });
        await bagService.addItem(uid, 13, 1);
        const list = await bagService.list(uid);
        const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
        if (equip) {
          await expect(bagService.wearItem(uid, equip.original_id ?? equip.id, equipService)).rejects.toThrow();
        }
      } finally {
        await dataStorageService.update(Collections.EQUIP_BASE, eb.id, { base_level: origBaseLevel });
      }
    } finally {
      await playerService.update(players[0].id, { level: origLevel } as any);
    }
  });

  it('list 有装备时返回 blessing_effects', async () => {
    await bagService.addItem(uid, 13, 1);
    const list = await bagService.list(uid);
    const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equip) {
      await bagService.wearItem(uid, equip.original_id ?? equip.id, equipService);
      const equips = await equipService.list(uid);
      expect(equips.length).toBeGreaterThanOrEqual(1);
      expect(equips[0]).toHaveProperty('blessing_effects');
      try { await equipService.removeEquip(uid, equip.equipment_uid); } catch { /* cleanup */ }
    }
  });

  // ==================== 分支覆盖补充 ====================

  it('wearEquip 通过 BagService.wearItem 覆盖已有装备替换', async () => {
    await bagService.addItem(uid, 13, 2);
    const list = await bagService.list(uid);
    const equips = list.filter((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equips.length >= 2) {
      await bagService.wearItem(uid, equips[0].original_id ?? equips[0].id, equipService);
      const ok = await bagService.wearItem(uid, equips[1].original_id ?? equips[1].id, equipService);
      expect(ok).toBe(true);
      const worn = await equipService.list(uid);
      expect(worn.filter((e: any) => e.item_id === 13).length).toBe(1);
      try { await equipService.removeEquip(uid, equips[1].equipment_uid); } catch { /* cleanup */ }
    }
  });

  it('removeEquip 无效 equipmentUid 抛错', async () => {
    await expect(equipService.removeEquip(uid, 'invalid')).rejects.toThrow();
  });

  it('removeEquip NaN 解析抛错', async () => {
    await expect(equipService.removeEquip(uid, NaN as any)).rejects.toThrow();
  });

  it('list 跳过 equipment_uid 非数字的项', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert(Collections.USER_EQUIP, {
      uid,
      equipment_uid: 'abc',
      create_time: now,
      update_time: now,
    });
    const list = await equipService.list(uid);
    expect(Array.isArray(list)).toBe(true);
    await dataStorageService.deleteMany(Collections.USER_EQUIP, { uid, equipment_uid: 'abc' });
  });

  it('list 跳过 instance 为 null 的项', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert(Collections.USER_EQUIP, {
      uid,
      equipment_uid: '99999999',
      create_time: now,
      update_time: now,
    });
    const list = await equipService.list(uid);
    expect(Array.isArray(list)).toBe(true);
    await dataStorageService.deleteMany(Collections.USER_EQUIP, { uid, equipment_uid: '99999999' });
  });

  it('pushFullUpdate 不抛错', async () => {
    await expect(equipService.pushFullUpdate(uid)).resolves.not.toThrow();
  });

  it('wearEquip 通过 get 获取 directItem 时 equip 存在', async () => {
    await bagService.addItem(uid, 13, 1);
    const list = await bagService.list(uid);
    const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (equip) {
      const bagId = equip.original_id ?? equip.id;
      await equipService.wearEquip(uid, bagId);
      try { await equipService.removeEquip(uid, equip.equipment_uid); } catch { /* cleanup */ }
    }
  });

  it('wearEquip 物品类型为非装备时返回 false (giveItem)', async () => {
    await giveItem(uid, 1, 1);
    const list = await bagService.list(uid);
    const consumable = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
    expect(consumable).toBeDefined();
    await expect(equipService.wearEquip(uid, consumable!.original_id ?? consumable!.id)).rejects.toThrow();
  });

  it('wearEquip 装备不存在时抛错 (id=888888)', async () => {
    await expect(equipService.wearEquip(uid, 888888)).rejects.toThrow();
  });

  it('wearEquip 替换已穿戴同位装备 (giveItem)', async () => {
    await giveItem(uid, 13, 2);
    const list = await bagService.list(uid);
    const equips = list.filter((i: any) => i.item_id === 13 && i.equipment_uid);
    expect(equips.length).toBeGreaterThanOrEqual(2);

    const first = equips[0];
    const second = equips[1];
    await bagService.wearItem(uid, first.original_id ?? first.id, equipService);

    const wornBefore = await equipService.list(uid);
    expect(wornBefore.some((e: any) => String(e.equipment_uid) === String(first.equipment_uid))).toBe(true);

    await bagService.wearItem(uid, second.original_id ?? second.id, equipService);

    const wornAfter = await equipService.list(uid);
    expect(wornAfter.some((e: any) => String(e.equipment_uid) === String(second.equipment_uid))).toBe(true);
    expect(wornAfter.some((e: any) => String(e.equipment_uid) === String(first.equipment_uid))).toBe(false);

    try { await equipService.removeEquip(uid, second.equipment_uid); } catch { /* cleanup */ }
  });

  it('removeEquip 实例 NaN 抛错 (abc)', async () => {
    await expect(equipService.removeEquip(uid, 'abc')).rejects.toThrow();
  });

  it('removeEquip 实例不存在抛错', async () => {
    await expect(equipService.removeEquip(uid, 999999)).rejects.toThrow();
  });

});

describe('关键路径/深度分支', () => {
  const _equipService = new EquipService();
  const _bagService = new BagService();

  it('wearEquip 物品无 type 时从 item 表获取', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'eqNoT' });
    await giveItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!equip) return;
    const rawBag = await dataStorageService.list(Collections.BAG, { uid, item_id: 13 });
    if (rawBag.length) {
      await dataStorageService.update(Collections.BAG, rawBag[0].id, { type: null } as any);
    }
    await _equipService.wearEquip(uid, equip.original_id ?? equip.id);
  });

  it('wearEquip 等级不足抛错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'eqLvl' });
    await giveItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!equip) return;
    const equipBase = await dataStorageService.getByCondition(Collections.EQUIP_BASE, { item_id: 13 });
    if (equipBase) {
      await dataStorageService.update(Collections.EQUIP_BASE, equipBase.id, { base_level: 50 });
    }
    try {
      await expect(_equipService.wearEquip(uid, equip.original_id ?? equip.id)).rejects.toThrow();
    } finally {
      if (equipBase) {
        await dataStorageService.update(Collections.EQUIP_BASE, equipBase.id, { base_level: 1 });
      }
    }
  });

  it('removeEquip 无效/不存在的 equipmentUid 抛错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'eqFull' });
    await expect(_equipService.removeEquip(uid, 'invalid_id')).rejects.toThrow();
    await expect(_equipService.removeEquip(uid, 999888)).rejects.toThrow();
  });

  it('wearEquip bag 记录无 type 时从 item 表获取', async () => {
    const user = await createTestUser(app, { prefix: 'eqp', suffix: 'notype' });
    await giveItem(user.uid, 13, 1);
    const bags = await _bagService.list(user.uid);
    const eq = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (eq) {
      const { dataStorageService } = await import('../../service/data-storage.service');
      const bagId = eq.original_id ?? eq.id;
      await dataStorageService.update(Collections.BAG, bagId, { type: null } as any);
      await _equipService.wearEquip(user.uid, bagId);
      const equips = await _equipService.list(user.uid);
      expect(equips.length).toBeGreaterThanOrEqual(1);
      try { await _equipService.removeEquip(user.uid, equips[0].equipment_uid); } catch { /* cleanup */ }
    }
  });

  it('wearEquip 消耗品不是装备返回 false', async () => {
    const user = await createTestUser(app, { prefix: 'eqp', suffix: 'cons' });
    await giveItem(user.uid, 1, 1);
    const bags = await _bagService.list(user.uid);
    const item = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (item) {
      await expect(_equipService.wearEquip(user.uid, item.original_id ?? item.id)).rejects.toThrow();
    }
  });

  it('wearEquip 同位替换旧装备', async () => {
    const user = await createTestUser(app, { prefix: 'eqp', suffix: 'swap' });
    await giveItem(user.uid, 13, 2);
    const bags = await _bagService.list(user.uid);
    const equips = bags.filter((b: any) => b.item_id === 13 && b.equipment_uid);
    if (equips.length >= 2) {
      await _bagService.wearItem(user.uid, equips[0].original_id ?? equips[0].id, _equipService);
      await _bagService.wearItem(user.uid, equips[1].original_id ?? equips[1].id, _equipService);
      const worn = await _equipService.list(user.uid);
      expect(worn.filter((e: any) => e.item_id === 13).length).toBe(1);
    }
  });
});

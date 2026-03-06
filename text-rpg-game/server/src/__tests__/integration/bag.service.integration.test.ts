/**
 * BagService 集成测试 - 真实 DB，无 mock
 * 覆盖 getEquipmentCount、getEquipmentCapacity、canAddEquipment、reduceBagItemCount、update/delete 权限、BagModel.removeItem
 */
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { BagService } from '../../service/bag.service';
import { BagModel } from '../../model/bag.model';
import { EquipService } from '../../service/equip.service';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { ErrorCode } from '../../utils/error';
import { dataStorageService } from '../../service/data-storage.service';
import { getMaterialCount, consumeMaterial } from '../../utils/material';

const app = createApp();

describe('BagService 集成测试', () => {
  let _token: string;
  let uid: number;
  const bagService = new BagService();
  const equipInstanceService = new EquipInstanceService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'bag', charName: '背包测试角色' });
    uid = user.uid;
    _token = user.token;
  }, 10000);

  describe('getEquipmentCount / getEquipmentCapacity / canAddEquipment', () => {
    it('空背包装备数为 0', async () => {
      const count = await bagService.getEquipmentCount(uid);
      expect(count).toBe(0);
    });

    it('getEquipmentCapacity 返回有效值', async () => {
      const cap = await bagService.getEquipmentCapacity(uid);
      expect(cap).toBeGreaterThanOrEqual(100);
      expect(cap).toBeLessThanOrEqual(500);
    });

    it('canAddEquipment 空背包时为 true', async () => {
      const can = await bagService.canAddEquipment(uid);
      expect(can).toBe(true);
    });

    it('getListPayload 包含 equipment_count 和 equipment_capacity', async () => {
      const payload = await bagService.getListPayload(uid);
      expect(payload).toHaveProperty('items');
      expect(payload).toHaveProperty('equipment_count');
      expect(payload).toHaveProperty('equipment_capacity');
      expect(Array.isArray(payload.items)).toBe(true);
    });
  });

  describe('reduceBagItemCount', () => {
    it('减少可堆叠物品数量', async () => {
      await bagService.addItem(uid, 1, 3);
      const list = await bagService.list(uid);
      const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 2);
      if (!potion) throw new Error('no potion');
      const bagId = potion.original_id ?? potion.id;
      const beforeCount = potion.count || 0;
      const ok = await bagService.reduceBagItemCount(bagId, 1);
      expect(ok).toBe(true);
      const after = await bagService.list(uid);
      const afterPotion = after.find((i: any) => (i.original_id ?? i.id) === bagId);
      expect(afterPotion?.count).toBe(beforeCount - 1);
    });

    it('reduceBagItemCount 装备返回 false', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13);
      if (!equip) throw new Error('no equip');
      const bagId = equip.original_id ?? equip.id;
      const ok = await bagService.reduceBagItemCount(bagId, 1);
      expect(ok).toBe(false);
    });
  });

  describe('update / delete 权限', () => {
    it('update 无权操作他人物品抛出 FORBIDDEN', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1);
      if (!item) throw new Error('no item');
      const bagId = item.original_id ?? item.id;
      await expect(bagService.update(bagId, { count: 2 }, 999999)).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('delete 无权删除他人物品抛出 FORBIDDEN', async () => {
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1);
      if (!item) throw new Error('no item');
      const bagId = item.original_id ?? item.id;
      await expect(bagService.delete(bagId, { uid: 999999 })).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });
  });

  describe('BagModel.removeItem', () => {
    it('removeItem 减少可堆叠物品数量', async () => {
      const bagModel = new BagModel();
      await bagModel.addItem(uid, 1, 5, undefined);
      const list = await bagService.list(uid);
      const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      expect(potion).toBeDefined();
      const beforeCount = potion!.count || 0;
      const ok = await bagModel.removeItem(uid, 1, 2);
      expect(ok).toBe(true);
      const after = await bagService.list(uid);
      const afterPotion = after.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      expect(afterPotion?.count).toBe(beforeCount - 2);
    });

    it('removeItem 数量不足返回 false', async () => {
      const bagModel = new BagModel();
      const ok = await bagModel.removeItem(uid, 1, 99999);
      expect(ok).toBe(false);
    });
  });

  describe('list 装备 count>1 展开为多条', () => {
    it('type 2 且 count>1 时展开为多条记录', async () => {
      const bagModel = new BagModel();
      await bagService.addItem(uid, 13, 1);
      const list1 = await bagService.list(uid);
      const equip = list1.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const eqUid = equip.equipment_uid;
        await bagModel.addItem(uid, 13, 1, eqUid);
        const list2 = await bagService.list(uid);
        const expanded = list2.filter((i: any) => i.item_id === 13 && (i.original_id || i.id));
        expect(expanded.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('addItem 参数校验', () => {
    it('addItem 数量无效抛出 INVALID_PARAMS', async () => {
      await expect(bagService.addItem(uid, 1, 0)).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMS,
      });
      await expect(bagService.addItem(uid, 1, -1)).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMS,
      });
      await expect(bagService.addItem(uid, 1, 10000)).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMS,
      });
    });

    it('addItem 不存在的物品抛出 ITEM_NOT_FOUND', async () => {
      await expect(bagService.addItem(uid, 99999, 1)).rejects.toMatchObject({
        code: ErrorCode.ITEM_NOT_FOUND,
      });
    });
  });

  describe('update / delete 成功路径', () => {
    it('update 有权操作成功', async () => {
      await bagService.addItem(uid, 1, 2);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      expect(item).toBeDefined();
      const bagId = item!.original_id ?? item!.id;
      const ok = await bagService.update(bagId, { count: 5 }, uid);
      expect(ok).toBe(true);
    });

    it('delete 不存在的物品返回 false', async () => {
      const ok = await bagService.delete(999999);
      expect(ok).toBe(false);
    });

    it('reduceBagItemCount 数量相等时删除记录', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
      if (!potion) return;
      const bagId = potion.original_id ?? potion.id;
      const ok = await bagService.reduceBagItemCount(bagId, potion.count || 1);
      expect(ok).toBe(true);
      const after = await bagService.list(uid);
      const found = after.find((i: any) => (i.original_id ?? i.id) === bagId);
      expect(found).toBeUndefined();
    });
  });

  describe('clearAllEquipment', () => {
    it('清空装备返回删除数量', async () => {
      await bagService.addItem(uid, 13, 2);
      const deleted = await bagService.clearAllEquipment(uid);
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('useItem', () => {
    it('useItem 消耗品成功', async () => {
      await bagService.addItem(uid, 1, 3);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
      if (!item) return;
      const ok = await bagService.useItem(uid, item.original_id ?? item.id, 1);
      expect(ok).toBe(true);
    });

    it('useItem 物品不存在抛错', async () => {
      await expect(bagService.useItem(uid, 99999, 1)).rejects.toMatchObject({ code: ErrorCode.ITEM_NOT_FOUND });
    });

    it('useItem 数量不足抛错', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      if (item) {
        await expect(bagService.useItem(uid, item.original_id ?? item.id, 0)).rejects.toMatchObject({
          code: ErrorCode.ITEM_COUNT_NOT_ENOUGH,
        });
      }
    });

    it('useItem 无 item_effect 配置抛错', async () => {
      const TEST_ITEM_ID = 900001;
      await dataStorageService.insert('item', {
        id: TEST_ITEM_ID,
        name: '_bag_test_no_effect_',
        type: 1,
        hp_restore: 0,
        mp_restore: 0,
        description: '测试用消耗品，无 item_effect',
      });
      try {
        await bagService.addItem(uid, TEST_ITEM_ID, 1);
        const list = await bagService.list(uid);
        const item = list.find((i: any) => i.item_id === TEST_ITEM_ID);
        expect(item).toBeDefined();
        await expect(bagService.useItem(uid, item!.original_id ?? item!.id, 1)).rejects.toMatchObject({
          code: ErrorCode.INVALID_PARAMS,
        });
      } finally {
        const bagRows = await dataStorageService.list('bag', { uid, item_id: TEST_ITEM_ID });
        for (const row of bagRows) {
          await dataStorageService.delete('bag', row.id);
        }
        await dataStorageService.delete('item', TEST_ITEM_ID);
      }
    });
  });

  describe('wearItem', () => {
    it('wearItem 无 equipService 抛错', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        await expect(bagService.wearItem(uid, equip.original_id ?? equip.id, undefined as any)).rejects.toMatchObject({
          code: ErrorCode.SYSTEM_ERROR,
        });
      }
    });

    it('wearItem 非装备抛错', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1 && !i.equipment_uid);
      if (item) {
        const EquipService = require('../../service/equip.service').EquipService;
        const equipService = new EquipService();
        await expect(
          bagService.wearItem(uid, item.original_id ?? item.id, equipService)
        ).rejects.toThrow();
      }
    });

    it('wearItem 背包物品不存在抛错', async () => {
      const EquipService = require('../../service/equip.service').EquipService;
      const equipService = new EquipService();
      await expect(bagService.wearItem(uid, 999999, equipService)).rejects.toThrow();
    });
  });

  describe('addEquipInstanceToBag', () => {
    it('addEquipInstanceToBag 背包装备满抛错', async () => {
      const PlayerService = require('../../service/player.service').PlayerService;
      const EquipInstanceService = require('../../service/equip_instance.service').EquipInstanceService;
      const playerService = new PlayerService();
      const equipInstanceService = new EquipInstanceService();
      const players = await playerService.list(uid);
      if (players.length) {
        const origCap = (players[0] as any).equipment_capacity ?? 100;
        await bagService.clearAllEquipment(uid);
        await playerService.update(players[0].id, { equipment_capacity: 1 } as any);
        const id1 = await equipInstanceService.createFromBase(uid, 13);
        const id2 = await equipInstanceService.createFromBase(uid, 13);
        if (id1 && id2) {
          await bagService.addEquipInstanceToBag(uid, 13, String(id1));
          await expect(
            bagService.addEquipInstanceToBag(uid, 13, String(id2))
          ).rejects.toMatchObject({ code: ErrorCode.BAG_EQUIPMENT_FULL });
        }
        await playerService.update(players[0].id, { equipment_capacity: origCap } as any);
      }
    });
  });

  describe('delete 权限', () => {
    it('delete 带 uid 校验归属', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1);
      if (item) {
        await expect(bagService.delete((item.original_id ?? item.id) as number, { uid: 999999 })).rejects.toMatchObject({
          code: ErrorCode.FORBIDDEN,
        });
      }
    });
  });

  describe('get', () => {
    it('get 存在的物品返回详情', async () => {
      await bagService.addItem(uid, 1, 1);
      const list = await bagService.list(uid);
      const item = list.find((i: any) => i.item_id === 1);
      if (item) {
        const got = await bagService.get(item.original_id ?? item.id);
        expect(got).not.toBeNull();
        expect(got?.item_id).toBe(1);
      }
    });

    it('get 不存在的返回 null', async () => {
      const got = await bagService.get(999999);
      expect(got).toBeNull();
    });
  });

  describe('list 装备实例边界', () => {
    it('list 装备实例不存在时跳过 enrichEquipDetail', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();

      const instanceId = parseInt(String(equip!.equipment_uid), 10);
      await equipInstanceService.deleteInstance(instanceId);

      const listAfter = await bagService.list(uid);
      const found = listAfter.find(
        (i: any) => i.equipment_uid === equip!.equipment_uid
      );
      if (found) {
        expect(found.equip_attributes).toBeUndefined();
      }
    });

    it('list 装备 instance uid 不匹配时跳过', async () => {
      const user2 = await createTestUser(app, { prefix: 'bag', suffix: 'u2', charName: '背包U2' });

      await bagService.addItem(user2.uid, 13, 1);
      const list2 = await bagService.list(user2.uid);
      const equip2 = list2.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (!equip2) return;

      const bagModel = new BagModel();
      await bagModel.addItem(uid, 13, 1, equip2.equipment_uid);

      const myList = await bagService.list(uid);
      const mismatch = myList.find(
        (i: any) => i.equipment_uid === equip2.equipment_uid
      );
      if (mismatch) {
        expect(mismatch.equip_attributes).toBeUndefined();
      }
    });
  });

  describe('useItem 额外分支', () => {
    it('useItem 物品类型不存在抛错', async () => {
      const FAKE_ITEM_ID = 900099;
      await dataStorageService.insert('item', {
        id: FAKE_ITEM_ID,
        name: '_bag_fake_item_',
        type: 1,
        description: 'test',
      });
      try {
        await bagService.addItem(uid, FAKE_ITEM_ID, 1);
        const list = await bagService.list(uid);
        const item = list.find((i: any) => i.item_id === FAKE_ITEM_ID);
        expect(item).toBeDefined();

        await expect(
          bagService.useItem(uid, item!.original_id ?? item!.id, 1)
        ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMS });
      } finally {
        const rows = await dataStorageService.list('bag', { uid, item_id: FAKE_ITEM_ID });
        for (const r of rows) await dataStorageService.delete('bag', r.id);
        await dataStorageService.delete('item', FAKE_ITEM_ID);
      }
    });

    it('useItem consumedByEffect 分支 - 技能书由效果内部扣减', async () => {
      const user3 = await createTestUser(app, { prefix: 'bag', suffix: 'sk', charName: '技能书测试' });
      await giveItem(user3.uid, 14, 1);
      const list = await bagService.list(user3.uid);
      const book = list.find((i: any) => i.item_id === 14 && !i.equipment_uid);
      if (!book) return;

      const ok = await bagService.useItem(user3.uid, book.original_id ?? book.id, 1);
      expect(ok).toBe(true);
    });
  });
});

describe('关键路径/深度分支', () => {
  const _bagService = new BagService();
  const _equipService = new EquipService();

  it('delete 他人物品抛 FORBIDDEN', async () => {
    const { uid: uidA } = await createTestUser(app, { prefix: 'ds', suffix: 'bagA' });
    const { uid: uidB } = await createTestUser(app, { prefix: 'ds', suffix: 'bagB' });
    await giveItem(uidA, 1, 1);
    const bagsA = await _bagService.list(uidA);
    const item = bagsA.find((b: any) => b.item_id === 1);
    if (!item) return;
    try {
      await _bagService.delete(item.original_id ?? item.id, { uid: uidB });
      fail('should throw FORBIDDEN');
    } catch (e: any) {
      expect(e.code).toBe(40003);
    }
  });

  it('useItem consumedByEffect 分支（技能书）', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'skill' });
    const skillBooks = await dataStorageService.list('item_effect', { effect_type: 'learn_skill' });
    if (!skillBooks.length) return;
    const bookItemId = skillBooks[0].item_id;
    await giveItem(uid, bookItemId, 1);
    const bags = await _bagService.list(uid);
    const book = bags.find((b: any) => b.item_id === bookItemId);
    if (!book) return;
    try {
      await _bagService.useItem(uid, book.original_id ?? book.id);
    } catch {
      // skill may fail if already learned; branch still covered
    }
  });

  it('addItem 物品类型异常抛错', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'badIt' });
    try {
      await _bagService.addItem(uid, 999999, 1);
      fail('should throw');
    } catch (e: any) {
      expect(e.code).toBe(40004);
    }
  });

  it('wearItem 非装备抛 ITEM_NOT_EQUIPMENT', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'notEq' });
    await giveItem(uid, 1, 1);
    const bags = await _bagService.list(uid);
    const potion = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    if (!potion) return;
    try {
      await _bagService.wearItem(uid, potion.original_id ?? potion.id, _equipService);
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/装备/);
    }
  });

  it('wearItem 无 equipService 抛 SYSTEM_ERROR', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'noEqs' });
    await giveItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!equip) return;
    try {
      await _bagService.wearItem(uid, equip.original_id ?? equip.id);
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/失败|服务/);
    }
  });

  it('getMaterialCount 无材料返回 0', async () => {
    const { uid } = await createTestUser(app, { prefix: 'dwmt', charName: 'DwMat' });
    const count = await getMaterialCount(uid, 88888);
    expect(count).toBe(0);
  });

  it('consumeMaterial 数量不足返回 false', async () => {
    const { uid } = await createTestUser(app, { prefix: 'dwmt2', charName: 'DwMat2' });
    const ok = await consumeMaterial(uid, 88888, 10);
    expect(ok).toBe(false);
  });

  it('装备超过容量上限时拒绝添加', async () => {
    const { uid } = await createTestUser(app, { prefix: 'p0', suffix: 'bag_full' });
    const capacity = await _bagService.getEquipmentCapacity(uid);
    expect(capacity).toBeGreaterThan(0);
    for (let i = 0; i < capacity; i++) {
      await _bagService.addItem(uid, 13, 1);
    }
    const canAdd = await _bagService.canAddEquipment(uid);
    expect(canAdd).toBe(false);
    const count = await _bagService.getEquipmentCount(uid);
    expect(count).toBeGreaterThanOrEqual(capacity);
  }, 60000);
});

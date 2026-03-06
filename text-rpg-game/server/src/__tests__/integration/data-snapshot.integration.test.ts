/**
 * 数据快照集成测试
 *
 * 对关键操作做"操作前后快照对比"，确保数据不会凭空丢失、变异或增多。
 * 不逐个写场景，而是验证数据不变式在各种操作循环后依然成立。
 */
import { createApp } from '../../create-app';
import { createTestUser, giveItem as _giveItem, giveGold } from '../../__test-utils__/integration-helpers';
import { EquipService } from '../../service/equip.service';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { EquipUpgradeService } from '../../service/equip_upgrade.service';
import { EquipBlessingService } from '../../service/equip_blessing.service';

const app = createApp();
const equipService = new EquipService();
const bagService = new BagService();
const playerService = new PlayerService();
const equipInstanceService = new EquipInstanceService();

interface DataSnapshot {
  bagItemCount: number;
  bagEquipCount: number;
  equipSlotCount: number;
  gold: number;
  equipmentUids: string[];
  bagTypes: number[];
}

async function takeSnapshot(uid: number): Promise<DataSnapshot> {
  const [bag, equips, players] = await Promise.all([
    bagService.list(uid),
    equipService.list(uid),
    playerService.list(uid),
  ]);
  return {
    bagItemCount: bag.length,
    bagEquipCount: bag.filter((i: any) => i.type === 2).length,
    equipSlotCount: equips.length,
    gold: players[0]?.gold ?? 0,
    equipmentUids: [
      ...bag.filter((i: any) => i.equipment_uid).map((i: any) => String(i.equipment_uid)),
      ...equips.map((e: any) => String(e.equipment_uid)),
    ].sort(),
    bagTypes: bag.map((i: any) => i.type).sort(),
  };
}

describe('数据快照: 装备穿/卸循环', () => {
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'snap', charName: '快照测试' });
    uid = user.uid;
  }, 10000);

  it('穿戴→卸下 3 次循环后数据不变', async () => {
    await bagService.addItem(uid, 13, 1); // 测试木剑
    const initial = await takeSnapshot(uid);
    const sword = (await bagService.list(uid)).find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!sword) return;

    const eqUid = sword.equipment_uid;

    for (let i = 0; i < 3; i++) {
      // 穿戴
      const bagList = await bagService.list(uid);
      const item = bagList.find((b: any) => String(b.equipment_uid) === String(eqUid));
      expect(item).toBeDefined();
      expect(item!.type).toBe(2); // 每次穿戴前必须还是装备
      await bagService.wearItem(uid, item!.original_id ?? item!.id, equipService);

      // 验证：装备栏中有
      const equips = await equipService.list(uid);
      const worn = equips.find((e: any) => String(e.equipment_uid) === String(eqUid));
      expect(worn).toBeDefined();

      // 卸下
      await equipService.removeEquip(uid, eqUid);

      // 验证：回到背包，仍然是装备
      const after = await bagService.list(uid);
      const returned = after.find((b: any) => String(b.equipment_uid) === String(eqUid));
      expect(returned).toBeDefined();
      expect(returned!.type).toBe(2);
    }

    const final = await takeSnapshot(uid);
    expect(final.bagEquipCount).toBe(initial.bagEquipCount);
    expect(final.equipSlotCount).toBe(initial.equipSlotCount);
    expect(final.equipmentUids).toEqual(initial.equipmentUids);
  });

  it('穿戴→卸下后 equipment_uid 保持不变', async () => {
    await bagService.addItem(uid, 13, 1);
    const bag = await bagService.list(uid);
    const sword = bag.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!sword) return;

    const originalUid = String(sword.equipment_uid);

    await bagService.wearItem(uid, sword.original_id ?? sword.id, equipService);
    await equipService.removeEquip(uid, originalUid);

    const bagAfter = await bagService.list(uid);
    const returned = bagAfter.find((i: any) => String(i.equipment_uid) === originalUid);
    expect(returned).toBeDefined();
    expect(returned!.equipment_uid).toBeTruthy();
    expect(String(returned!.equipment_uid)).toBe(originalUid);
  });

  it('装备类型在穿/卸后不变异为消耗品', async () => {
    await bagService.addItem(uid, 13, 1);
    const bag = await bagService.list(uid);
    const sword = bag.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!sword) return;

    expect(sword.type).toBe(2);
    await bagService.wearItem(uid, sword.original_id ?? sword.id, equipService);
    await equipService.removeEquip(uid, sword.equipment_uid);

    const bagAfter = await bagService.list(uid);
    const returned = bagAfter.find((i: any) => String(i.equipment_uid) === String(sword.equipment_uid));
    expect(returned).toBeDefined();
    expect(returned!.type).toBe(2);
    // 绝对不能出现 "使用" 按钮对应的 type=1
    expect(returned!.type).not.toBe(1);
  });
});

describe('数据快照: 消耗品使用扣减', () => {
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'sncon', charName: '消耗品快照' });
    uid = user.uid;
  }, 10000);

  it('使用消耗品后 count 精确减少', async () => {
    await bagService.addItem(uid, 1, 5); // 小血瓶 ×5
    const before = await bagService.list(uid);
    const potion = before.find((i: any) => i.item_id === 1);
    expect(potion).toBeDefined();
    expect(potion!.count).toBe(5);

    await bagService.useItem(uid, potion!.original_id ?? potion!.id, 1);
    const after = await bagService.list(uid);
    const potionAfter = after.find((i: any) => i.item_id === 1);
    expect(potionAfter).toBeDefined();
    expect(potionAfter!.count).toBe(4);
  });

  it('使用全部消耗品后物品消失', async () => {
    await bagService.addItem(uid, 1, 1);
    const before = await bagService.list(uid);
    const potion = before.find((i: any) => i.item_id === 1 && i.count === 1);
    if (!potion) return;

    await bagService.useItem(uid, potion.original_id ?? potion.id, 1);
    const after = await bagService.list(uid);
    const gone = after.find((i: any) => i.id === potion.id && i.count > 0);
    // count 应该已经变为 0 或物品已删除
    if (gone) {
      expect(gone.count).toBe(0);
    }
  });
});

describe('数据快照: 商店购买金币对账', () => {
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'sngold', charName: '金币对账' });
    uid = user.uid;
  }, 10000);

  it('购买 price=0 商品后金币不变', async () => {
    const before = await takeSnapshot(uid);
    // price=0 的商品购买通过 API 测试，这里验证 addGold(0) 逻辑
    const goldOk = await playerService.addGold(uid, 0);
    expect(goldOk).toBe(true);
    const after = await takeSnapshot(uid);
    expect(after.gold).toBe(before.gold);
  });

  it('金币扣减不能导致负数', async () => {
    const players = await playerService.list(uid);
    const currentGold = players[0]?.gold ?? 0;
    const result = await playerService.addGold(uid, -(currentGold + 1));
    expect(result).toBe(false); // 应拒绝
    const after = await playerService.list(uid);
    expect(after[0]?.gold).toBe(currentGold); // 金币不变
  });
});

describe('数据快照: 强化后数据一致性', () => {
  let uid: number;
  const upgradeService = new EquipUpgradeService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'snenh', charName: '强化快照' });
    uid = user.uid;
    await giveGold(uid, 10000000);
  }, 10000);

  it('强化成功后 enhance_level 精确 +1', async () => {
    await bagService.addItem(uid, 13, 1);
    // 补充强化石
    const { getEnhanceMaterialIds } = await import('../../service/enhance-config.service');
    const matIds = await getEnhanceMaterialIds();
    await bagService.addItem(uid, matIds.stone, 10000);

    const bag = await bagService.list(uid);
    const sword = bag.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!sword) return;

    const instanceId = parseInt(String(sword.equipment_uid), 10);
    const instanceBefore = await equipInstanceService.get(instanceId);
    const levelBefore = instanceBefore?.enhance_level ?? 0;

    const result = await upgradeService.enhance(uid, instanceId, { useLuckyCharm: false, useAntiExplode: true });

    if (result.success) {
      const instanceAfter = await equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeDefined();
      expect(instanceAfter!.enhance_level).toBe(levelBefore + 1);
      // 装备实例 uid 不能变
      expect(String(instanceAfter!.uid)).toBe(String(uid));
    } else if (result.broken) {
      const instanceAfter = await equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeNull(); // 破碎后实例应被删除
    } else {
      const instanceAfter = await equipInstanceService.get(instanceId);
      expect(instanceAfter).toBeDefined();
      expect(instanceAfter!.enhance_level ?? 0).toBe(levelBefore); // 失败不变
    }
  });
});

describe('数据快照: 祝福后数据一致性', () => {
  let uid: number;
  const blessingService = new EquipBlessingService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'snbls', charName: '祝福快照' });
    uid = user.uid;
    await giveGold(uid, 100000000);
  }, 10000);

  it('祝福成功后 blessing_level 精确 +1', async () => {
    await bagService.addItem(uid, 13, 1);
    const { getEnhanceMaterialIds } = await import('../../service/enhance-config.service');
    const matIds = await getEnhanceMaterialIds();
    await bagService.addItem(uid, matIds.blessing_oil, 10);

    const bag = await bagService.list(uid);
    const sword = bag.find((i: any) => i.item_id === 13 && i.equipment_uid);
    if (!sword) return;

    const instanceId = parseInt(String(sword.equipment_uid), 10);
    const instanceBefore = await equipInstanceService.get(instanceId);
    const levelBefore = instanceBefore?.blessing_level ?? 0;

    const result = await blessingService.bless(uid, instanceId);

    const instanceAfter = await equipInstanceService.get(instanceId);
    expect(instanceAfter).toBeDefined();

    if (result.success) {
      expect(instanceAfter!.blessing_level).toBe(levelBefore + 1);
    } else {
      expect(instanceAfter!.blessing_level ?? 0).toBe(levelBefore);
    }
    // 祝福不会破坏装备
    expect(String(instanceAfter!.uid)).toBe(String(uid));
  });
});

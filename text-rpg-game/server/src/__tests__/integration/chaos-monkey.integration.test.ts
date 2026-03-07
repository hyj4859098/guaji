/**
 * 混沌猴测试
 *
 * 不写具体场景——定义"什么是对的"（不变式），
 * 然后随机执行 200 次游戏操作，自动找到违反不变式的操作序列。
 *
 * 每次运行走不同路径，跑 N 次 = 测 N×200 种组合。
 */
import { createApp } from '../../create-app';
import { createTestUser, giveItem as _giveItem, giveGold } from '../../__test-utils__/integration-helpers';
import { BagService } from '../../service/bag.service';
import { EquipService } from '../../service/equip.service';
import { PlayerService } from '../../service/player.service';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { EquipUpgradeService } from '../../service/equip_upgrade.service';
import { EquipBlessingService } from '../../service/equip_blessing.service';
import { AuctionService } from '../../service/auction.service';
import { ShopService } from '../../service/shop.service';
import { dataStorageService } from '../../service/data-storage.service';
import { Collections } from '../../config/collections';

const app = createApp();
const bagService = new BagService();
const equipService = new EquipService();
const playerService = new PlayerService();
const _equipInstanceService = new EquipInstanceService();
const upgradeService = new EquipUpgradeService();
const blessingService = new EquipBlessingService();
const auctionService = new AuctionService();
const _shopService = new ShopService();

const TEST_WEAPON_ID = 13;
const POTION_ID = 1;

// ==================== 快照 ====================

interface Snapshot {
  bagItems: any[];
  bagEquips: any[];
  equips: any[];
  gold: number;
  bagEquipUids: string[];
  equipSlotUids: string[];
  allEquipUids: string[];
}

async function takeSnapshot(uid: number): Promise<Snapshot> {
  const [bagItems, equips, players] = await Promise.all([
    bagService.list(uid),
    equipService.list(uid),
    playerService.list(uid),
  ]);
  const bagEquips = bagItems.filter((i: any) => i.equipment_uid);
  const bagEquipUids = bagEquips.map((i: any) => String(i.equipment_uid)).sort();
  const equipSlotUids = equips.map((e: any) => String(e.equipment_uid)).sort();
  return {
    bagItems,
    bagEquips,
    equips,
    gold: players[0]?.gold ?? 0,
    bagEquipUids,
    equipSlotUids,
    allEquipUids: [...bagEquipUids, ...equipSlotUids].sort(),
  };
}

// ==================== 不变式 ====================

interface Invariant {
  name: string;
  check: (snap: Snapshot) => boolean;
}

const INVARIANTS: Invariant[] = [
  {
    name: '装备type不变异:有equipment_uid的物品type必须为2',
    check: (s) => s.bagItems.every((i: any) => !i.equipment_uid || i.type === 2),
  },
  {
    name: '金币不为负',
    check: (s) => s.gold >= 0,
  },
  {
    name: '装备实例不重复:背包+装备栏中无重复equipment_uid',
    check: (s) => new Set(s.allEquipUids).size === s.allEquipUids.length,
  },
  {
    name: 'equipment_uid不丢:背包中装备必须有equipment_uid',
    check: (s) => s.bagEquips.every((i: any) => !!i.equipment_uid),
  },
  {
    name: '消耗品count不为负',
    check: (s) => s.bagItems.every((i: any) => (i.count ?? 0) >= 0),
  },
  {
    name: '装备栏物品必须有equipment_uid',
    check: (s) => s.equips.every((e: any) => !!e.equipment_uid),
  },
];

function checkInvariants(snap: Snapshot, step: number, opName: string): void {
  for (const inv of INVARIANTS) {
    if (!inv.check(snap)) {
      const detail = JSON.stringify({
        gold: snap.gold,
        bagCount: snap.bagItems.length,
        bagEquipCount: snap.bagEquips.length,
        equipSlotCount: snap.equips.length,
        allEquipUids: snap.allEquipUids,
      }, null, 2);
      throw new Error(
        `不变式违反: [${inv.name}]\n` +
        `在第 ${step} 步执行 "${opName}" 后\n` +
        `快照: ${detail}`
      );
    }
  }
}

// ==================== 操作池 ====================

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type Operation = (uid: number) => Promise<string>;

const buyEquip: Operation = async (uid) => {
  await bagService.addItem(uid, TEST_WEAPON_ID, 1);
  return 'buyEquip';
};

const buyConsumable: Operation = async (uid) => {
  const count = Math.floor(Math.random() * 3) + 1;
  await bagService.addItem(uid, POTION_ID, count);
  return `buyConsumable(×${count})`;
};

const wearEquip: Operation = async (uid) => {
  const bag = await bagService.list(uid);
  const equip = bag.find((i: any) => i.item_id === TEST_WEAPON_ID && i.equipment_uid);
  if (!equip) return 'wearEquip(skip:no equip in bag)';
  try {
    await bagService.wearItem(uid, equip.original_id ?? equip.id, equipService);
    return `wearEquip(${equip.equipment_uid})`;
  } catch {
    return 'wearEquip(skip:failed)';
  }
};

const removeEquip: Operation = async (uid) => {
  const equips = await equipService.list(uid);
  if (equips.length === 0) return 'removeEquip(skip:nothing equipped)';
  const target = randomPick(equips);
  try {
    await equipService.removeEquip(uid, target.equipment_uid);
    return `removeEquip(${target.equipment_uid})`;
  } catch {
    return 'removeEquip(skip:failed)';
  }
};

const useConsumable: Operation = async (uid) => {
  const bag = await bagService.list(uid);
  const potion = bag.find((i: any) => i.item_id === POTION_ID && (i.count ?? 0) > 0);
  if (!potion) return 'useConsumable(skip:no potion)';
  try {
    await bagService.useItem(uid, potion.original_id ?? potion.id, 1);
    return 'useConsumable';
  } catch {
    return 'useConsumable(skip:failed)';
  }
};

const enhance: Operation = async (uid) => {
  const bag = await bagService.list(uid);
  const equip = bag.find((i: any) => i.item_id === TEST_WEAPON_ID && i.equipment_uid);
  if (!equip) return 'enhance(skip:no equip)';
  const instanceId = parseInt(String(equip.equipment_uid), 10);
  if (isNaN(instanceId)) return 'enhance(skip:bad uid)';

  const { getEnhanceMaterialIds } = await import('../../service/enhance-config.service');
  const matIds = await getEnhanceMaterialIds();
  await bagService.addItem(uid, matIds.stone, 9999);

  try {
    const result = await upgradeService.enhance(uid, instanceId, {
      useLuckyCharm: false,
      useAntiExplode: Math.random() > 0.5,
    });
    return `enhance(${result.success ? 'success' : result.broken ? 'broken' : 'fail'})`;
  } catch {
    return 'enhance(skip:error)';
  }
};

const bless: Operation = async (uid) => {
  const bag = await bagService.list(uid);
  const equip = bag.find((i: any) => i.item_id === TEST_WEAPON_ID && i.equipment_uid);
  if (!equip) return 'bless(skip:no equip)';
  const instanceId = parseInt(String(equip.equipment_uid), 10);
  if (isNaN(instanceId)) return 'bless(skip:bad uid)';

  const { getEnhanceMaterialIds } = await import('../../service/enhance-config.service');
  const matIds = await getEnhanceMaterialIds();
  await bagService.addItem(uid, matIds.blessing_oil, 5);
  await giveGold(uid, 10000000);

  try {
    const result = await blessingService.bless(uid, instanceId);
    return `bless(${result.success ? 'success' : 'fail'})`;
  } catch {
    return 'bless(skip:error)';
  }
};

const auctionList: Operation = async (uid) => {
  const bag = await bagService.list(uid);
  const mat = bag.find((i: any) => i.type === 3 && (i.count ?? 0) > 0);
  if (!mat) return 'auctionList(skip:no material)';
  try {
    await auctionService.listItem(uid, {
      bag_id: mat.original_id ?? mat.id,
      count: 1,
      price: 1,
    });
    return 'auctionList';
  } catch {
    return 'auctionList(skip:failed)';
  }
};

const auctionDelist: Operation = async (uid) => {
  const listings = await dataStorageService.list(Collections.AUCTION, { seller_uid: uid });
  if (listings.length === 0) return 'auctionDelist(skip:none)';
  const target = randomPick(listings);
  try {
    await auctionService.offShelf(uid, target.id);
    return `auctionDelist(${target.id})`;
  } catch {
    return 'auctionDelist(skip:failed)';
  }
};

const addMaterial: Operation = async (uid) => {
  const { getEnhanceMaterialIds } = await import('../../service/enhance-config.service');
  const matIds = await getEnhanceMaterialIds();
  await bagService.addItem(uid, matIds.stone, 100);
  return 'addMaterial(强化石×100)';
};

const OPERATIONS: Operation[] = [
  buyEquip, buyEquip,
  buyConsumable,
  wearEquip, wearEquip, wearEquip,
  removeEquip, removeEquip, removeEquip,
  useConsumable,
  enhance,
  bless,
  auctionList,
  auctionDelist,
  addMaterial,
];

// ==================== 测试 ====================

describe('混沌猴测试', () => {
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'chaos', charName: '混沌猴' });
    uid = user.uid;
    await giveGold(uid, 100000000);
    await bagService.addItem(uid, TEST_WEAPON_ID, 3);
    await bagService.addItem(uid, POTION_ID, 10);
  }, 15000);

  it('200 次随机操作后数据不变式不被打破', async () => {
    const STEPS = 200;
    const log: string[] = [];

    for (let step = 0; step < STEPS; step++) {
      const op = randomPick(OPERATIONS);
      let opName: string;
      try {
        opName = await op(uid);
      } catch (e: any) {
        opName = `ERROR(${e.message?.slice(0, 50)})`;
      }
      log.push(`[${step}] ${opName}`);

      const snap = await takeSnapshot(uid);
      try {
        checkInvariants(snap, step, opName);
      } catch (err: any) {
        const recentOps = log.slice(Math.max(0, step - 10)).join('\n');
        throw new Error(`${err.message}\n\n最近操作:\n${recentOps}`);
      }
    }
  }, 120000);

  it('装备穿/卸快速交替 50 次不变式不被打破', async () => {
    await bagService.addItem(uid, TEST_WEAPON_ID, 1);

    for (let i = 0; i < 50; i++) {
      const bag = await bagService.list(uid);
      const equip = bag.find((b: any) => b.item_id === TEST_WEAPON_ID && b.equipment_uid);
      const equipped = await equipService.list(uid);

      if (equip) {
        try {
          await bagService.wearItem(uid, equip.original_id ?? equip.id, equipService);
        } catch { /* skip */ }
      } else if (equipped.length > 0) {
        try {
          await equipService.removeEquip(uid, equipped[0].equipment_uid);
        } catch { /* skip */ }
      }

      const snap = await takeSnapshot(uid);
      checkInvariants(snap, i, i % 2 === 0 ? 'wear' : 'remove');
    }
  }, 60000);
});

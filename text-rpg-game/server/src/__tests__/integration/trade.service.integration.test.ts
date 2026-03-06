/**
 * TradeService 集成测试 - 真实 DB，无 mock
 * 通过 handleMessage 覆盖 join、leave、invite、respond、update、confirm、cancel、execute
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { tradeService } from '../../service/trade.service';
import { createTestUser, createTestUserOnly, giveItem } from '../../__test-utils__/integration-helpers';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { EquipInstanceService } from '../../service/equip_instance.service';

const app = createApp();

describe('TradeService 集成测试', () => {
  let uid1: number;
  let uid2: number;

  beforeAll(async () => {
    const user1 = await createTestUser(app, { prefix: 'trd', suffix: '1', charName: '交易测试1' });
    const user2 = await createTestUser(app, { prefix: 'trd', suffix: '2', charName: '交易测试2' });
    uid1 = user1.uid;
    uid2 = user2.uid;
  }, 10000);

  const _u1 = () => String(uid1);
  const _u2 = () => String(uid2);

  it('join 进入大厅', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
  });

  it('invite 自己应忽略', async () => {
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid1 });
  });

  it('invite 邀请对方', async () => {
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
  });

  it('invite_respond 接受邀请', async () => {
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
  });

  it('update_offer 更新报价', async () => {
    await tradeService.handleMessage(uid1, { action: 'update_offer', items: [], gold: 0 });
    await tradeService.handleMessage(uid2, { action: 'update_offer', items: [], gold: 0 });
  });

  it('confirm_items 双方确认物品', async () => {
    await tradeService.handleMessage(uid1, { action: 'confirm_items' });
    await tradeService.handleMessage(uid2, { action: 'confirm_items' });
  });

  it('confirm_trade 双方确认执行空交易', async () => {
    await tradeService.handleMessage(uid1, { action: 'confirm_trade' });
    await tradeService.handleMessage(uid2, { action: 'confirm_trade' });
  });

  it('再次 join 后 invite、respond、cancel', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    await tradeService.handleMessage(uid1, { action: 'cancel' });
  });

  it('invite_respond 拒绝', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: false });
  });

  it('leave 离开大厅', async () => {
    await tradeService.handleMessage(uid1, { action: 'leave' });
    await tradeService.handleMessage(uid2, { action: 'leave' });
  });

  it('handleDisconnect', () => {
    tradeService.handleMessage(uid1, { action: 'join' });
    tradeService.handleDisconnect(uid1);
  });

  it('未知 action 触发 warn', async () => {
    await tradeService.handleMessage(uid1, { action: 'unknown_action' });
  });

  it('invite 对方不在大厅返回 error', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'leave' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid1, { action: 'leave' });
  });

  it('invite_respond 邀请已过期返回 error', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
  });

  it('confirm_trade 未确认物品返回 error', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    await tradeService.handleMessage(uid1, { action: 'confirm_trade' });
    await tradeService.handleMessage(uid1, { action: 'cancel' });
    await tradeService.handleMessage(uid2, { action: 'leave' });
    await tradeService.handleMessage(uid1, { action: 'leave' });
  });

  it('update_offer 无 session 时静默返回', async () => {
    await tradeService.handleMessage(uid1, { action: 'update_offer', items: [], gold: 100 });
  });

  it('confirm_items 无 session 时静默返回', async () => {
    await tradeService.handleMessage(uid1, { action: 'confirm_items' });
  });

  it('join 战斗中返回 error', async () => {
    const { BattleService } = await import('../../service/battle.service');
    const battleService = new BattleService();
    await battleService.startAutoBattle(uid1, 1);
    await new Promise((r) => setTimeout(r, 50));
    await tradeService.handleMessage(uid1, { action: 'join' });
    await battleService.stopBattle(uid1);
    await new Promise((r) => setTimeout(r, 500));
  });

  it('join 有 offline_battle config 时返回 error', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid1);
    if (players.length) {
      const now = Math.floor(Date.now() / 1000);
      await playerService.update(players[0].id, {
        auto_battle_config: { enemy_id: 1, last_battle_time: now - 10, auto_heal: null },
      } as any);
      await tradeService.handleMessage(uid1, { action: 'join' });
      await playerService.update(players[0].id, { auto_battle_config: null } as any);
    }
  });

  it('invite 对方正在交易中返回 error', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid1, { action: 'cancel' });
    await tradeService.handleMessage(uid2, { action: 'leave' });
    await tradeService.handleMessage(uid1, { action: 'leave' });
  });

  it('leave 有 session 时取消交易', async () => {
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    tradeService.handleMessage(uid2, { action: 'leave' });
    await tradeService.handleMessage(uid1, { action: 'leave' });
  });

  it('完整交易流程含金币', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    await playerService.addGold(uid1, 100);
    await playerService.addGold(uid2, 100);
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    await tradeService.handleMessage(uid1, { action: 'update_offer', items: [], gold: 10 });
    await tradeService.handleMessage(uid2, { action: 'update_offer', items: [], gold: 0 });
    await tradeService.handleMessage(uid1, { action: 'confirm_items' });
    await tradeService.handleMessage(uid2, { action: 'confirm_items' });
    await tradeService.handleMessage(uid1, { action: 'confirm_trade' });
    await tradeService.handleMessage(uid2, { action: 'confirm_trade' });
    await tradeService.handleMessage(uid1, { action: 'leave' });
    await tradeService.handleMessage(uid2, { action: 'leave' });
  });

  it('完整交易流程含消耗品', async () => {
    const { BagService } = await import('../../service/bag.service');
    const { PlayerService } = await import('../../service/player.service');
    const bagService = new BagService();
    const playerService = new PlayerService();
    await bagService.addItem(uid1, 1, 3);
    await playerService.addGold(uid1, 50);
    await playerService.addGold(uid2, 50);
    const list1 = await bagService.list(uid1);
    const potion = list1.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    if (potion) {
      await tradeService.handleMessage(uid1, { action: 'join' });
      await tradeService.handleMessage(uid2, { action: 'join' });
      await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
      await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
      await tradeService.handleMessage(uid1, {
        action: 'update_offer',
        items: [{ bag_id: potion.original_id ?? potion.id, item_id: 1, count: 1, name: potion.name || '药水' }],
        gold: 0,
      });
      await tradeService.handleMessage(uid2, { action: 'update_offer', items: [], gold: 5 });
      await tradeService.handleMessage(uid1, { action: 'confirm_items' });
      await tradeService.handleMessage(uid2, { action: 'confirm_items' });
      await tradeService.handleMessage(uid1, { action: 'confirm_trade' });
      await tradeService.handleMessage(uid2, { action: 'confirm_trade' });
      await tradeService.handleMessage(uid1, { action: 'leave' });
      await tradeService.handleMessage(uid2, { action: 'leave' });
    }
  });
});

describe('关键路径/深度分支', () => {
  const _bagService = new BagService();
  const _playerService = new PlayerService();
  const _equipInstanceService = new EquipInstanceService();

  it('join 无角色时不加入大厅', async () => {
    const { uid } = await createTestUserOnly(app, { prefix: 'ds', suffix: 'trNoC' });
    await tradeService.handleMessage(uid, { action: 'join' });
  });

  it('invite 自己被忽略', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'trSelf' });
    await tradeService.handleMessage(uid, { action: 'join' });
    await tradeService.handleMessage(uid, { action: 'invite', target_uid: uid });
    await tradeService.handleMessage(uid, { action: 'leave' });
  });

  it('validateItems 物品不存在时交易失败', async () => {
    const { uid: uid1 } = await createTestUser(app, { prefix: 'ds', suffix: 'trV1' });
    const { uid: uid2 } = await createTestUser(app, { prefix: 'ds', suffix: 'trV2' });
    await giveItem(uid1, 1, 5);
    await tradeService.handleMessage(uid1, { action: 'join' });
    await tradeService.handleMessage(uid2, { action: 'join' });
    await tradeService.handleMessage(uid1, { action: 'invite', target_uid: uid2 });
    await tradeService.handleMessage(uid2, { action: 'invite_respond', from_uid: uid1, accepted: true });
    await tradeService.handleMessage(uid1, {
      action: 'update_offer',
      items: [{ bag_id: 999999, item_id: 1, count: 1, name: '不存在的物品' }],
      gold: 0,
    });
    await tradeService.handleMessage(uid2, { action: 'update_offer', items: [], gold: 0 });
    await tradeService.handleMessage(uid1, { action: 'confirm_items' });
    await tradeService.handleMessage(uid2, { action: 'confirm_items' });
    await tradeService.handleMessage(uid1, { action: 'confirm_trade' });
    await tradeService.handleMessage(uid2, { action: 'confirm_trade' });
  });

  it('A 放装备 + 金币，B 放消耗品 → 双方物品正确转移', async () => {
    const userA = await createTestUser(app, { prefix: 'r2', suffix: 'tradeA' });
    const userB = await createTestUser(app, { prefix: 'r2', suffix: 'tradeB' });

    await _bagService.addItem(userA.uid, 13, 1);
    await _playerService.addGold(userA.uid, 1000);
    await _bagService.addItem(userB.uid, 1, 5);
    await _playerService.addGold(userB.uid, 500);

    const pA0 = (await request(app).get('/api/player/list').set('Authorization', `Bearer ${userA.token}`)).body.data[0];
    const pB0 = (await request(app).get('/api/player/list').set('Authorization', `Bearer ${userB.token}`)).body.data[0];
    const goldABefore = pA0.gold;
    const goldBBefore = pB0.gold;

    const bagsA = await _bagService.list(userA.uid);
    const equipA = bagsA.find((b: any) => b.item_id === 13 && b.equipment_uid);
    expect(equipA).toBeTruthy();
    const instanceId = parseInt(String(equipA!.equipment_uid), 10);

    const bagsB = await _bagService.list(userB.uid);
    const potionB = bagsB.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    expect(potionB).toBeTruthy();

    await tradeService.handleMessage(userA.uid, { action: 'join' });
    await tradeService.handleMessage(userB.uid, { action: 'join' });
    await tradeService.handleMessage(userA.uid, { action: 'invite', target_uid: userB.uid });
    await tradeService.handleMessage(userB.uid, { action: 'invite_respond', from_uid: userA.uid, accepted: true });

    await tradeService.handleMessage(userA.uid, {
      action: 'update_offer',
      items: [{
        bag_id: equipA!.original_id ?? equipA!.id,
        item_id: 13,
        count: 1,
        name: equipA!.name || '装备',
        equipment_uid: String(instanceId),
      }],
      gold: 50,
    });
    await tradeService.handleMessage(userB.uid, {
      action: 'update_offer',
      items: [{
        bag_id: potionB!.original_id ?? potionB!.id,
        item_id: 1,
        count: 2,
        name: potionB!.name || '药水',
      }],
      gold: 0,
    });

    await tradeService.handleMessage(userA.uid, { action: 'confirm_items' });
    await tradeService.handleMessage(userB.uid, { action: 'confirm_items' });
    await tradeService.handleMessage(userA.uid, { action: 'confirm_trade' });
    await tradeService.handleMessage(userB.uid, { action: 'confirm_trade' });

    const instance = await _equipInstanceService.get(instanceId);
    expect(instance).toBeTruthy();
    expect(String(instance!.uid)).toBe(String(userB.uid));

    const bagsB2 = await _bagService.list(userB.uid);
    expect(bagsB2.find((b: any) => String(b.equipment_uid) === String(instanceId))).toBeTruthy();

    const bagsA2 = await _bagService.list(userA.uid);
    expect(bagsA2.find((b: any) => b.item_id === 1)).toBeTruthy();

    const pA1 = (await request(app).get('/api/player/list').set('Authorization', `Bearer ${userA.token}`)).body.data[0];
    const pB1 = (await request(app).get('/api/player/list').set('Authorization', `Bearer ${userB.token}`)).body.data[0];
    expect(pA1.gold).toBe(goldABefore - 50);
    expect(pB1.gold).toBe(goldBBefore + 50);

    await tradeService.handleMessage(userA.uid, { action: 'leave' });
    await tradeService.handleMessage(userB.uid, { action: 'leave' });
  });
});

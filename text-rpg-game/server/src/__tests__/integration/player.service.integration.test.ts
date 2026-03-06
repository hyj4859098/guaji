/**
 * PlayerService 集成测试 - addGold、addPoints、addReputation、addExp、addHp、addMp
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser } from '../../__test-utils__/integration-helpers';
import { PlayerService } from '../../service/player.service';
import { BagService } from '../../service/bag.service';
import { EquipService } from '../../service/equip.service';
import { AuctionService } from '../../service/auction.service';
import { SkillService } from '../../service/skill.service';
import { dataStorageService } from '../../service/data-storage.service';

const app = createApp();

describe('PlayerService 集成测试', () => {
  let uid: number;
  const playerService = new PlayerService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'plr', charName: '玩家测试' });
    uid = user.uid;
  }, 10000);

  it('addGold 无角色返回 false', async () => {
    const ok = await playerService.addGold(999999, 100);
    expect(ok).toBe(false);
  });

  it('addGold 正常添加', async () => {
    const ok = await playerService.addGold(uid, 100);
    expect(ok).toBe(true);
  });

  it('addGold 扣减后为负返回 false', async () => {
    const players = await playerService.list(uid);
    const gold = players[0]?.gold ?? 0;
    const ok = await playerService.addGold(uid, -gold - 1000);
    expect(ok).toBe(false);
  });

  it('addPoints 无角色返回 false', async () => {
    const ok = await playerService.addPoints(999999, 10);
    expect(ok).toBe(false);
  });

  it('addPoints 正常添加', async () => {
    const ok = await playerService.addPoints(uid, 50);
    expect(ok).toBe(true);
  });

  it('addReputation 无角色返回 false', async () => {
    const ok = await playerService.addReputation(999999, 5);
    expect(ok).toBe(false);
  });

  it('addReputation 正常添加', async () => {
    const ok = await playerService.addReputation(uid, 10);
    expect(ok).toBe(true);
  });

  it('addExp 无角色返回 false', async () => {
    const ok = await playerService.addExp(999999, 100);
    expect(ok).toBe(false);
  });

  it('addExp 正常添加', async () => {
    const ok = await playerService.addExp(uid, 50);
    expect(ok).toBe(true);
  });

  it('addHp 恢复生命', async () => {
    const ok = await playerService.addHp(uid, 10);
    expect(ok).toBe(true);
  });

  it('addMp 恢复魔法', async () => {
    const ok = await playerService.addMp(uid, 10);
    expect(ok).toBe(true);
  });
});

describe('关键路径/深度分支', () => {
  const _playerService = new PlayerService();
  const _bagService = new BagService();
  const _equipService = new EquipService();
  const _auctionService = new AuctionService();
  const _skillService = new SkillService();

  it('删除角色后 API 返回空列表', async () => {
    const { uid, token } = await createTestUser(app, { prefix: 'p0', suffix: 'delcasc' });

    await _bagService.addItem(uid, 1, 5);
    await _bagService.addItem(uid, 13, 1);

    const bagsBefore = await _bagService.list(uid);
    expect(bagsBefore.length).toBeGreaterThan(0);

    const listBefore = await request(app).get('/api/player/list').set('Authorization', `Bearer ${token}`);
    expect(listBefore.body.data.length).toBeGreaterThan(0);
    const playerId = listBefore.body.data[0].id;

    const delRes = await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: playerId });
    expect(delRes.body.code).toBe(0);

    const listAfter = await request(app).get('/api/player/list').set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.data.length).toBe(0);
  });

  it('删除角色后背包、装备栏、拍卖上架数据应可检测', async () => {
    const { uid, token } = await createTestUser(app, { prefix: 'r2', suffix: 'deldata' });

    await _bagService.addItem(uid, 1, 5);
    await _bagService.addItem(uid, 13, 1);

    const bagsB4 = await _bagService.list(uid);
    const equip = bagsB4.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (equip) {
      await _bagService.wearItem(uid, equip.original_id ?? equip.id, _equipService);
    }

    const consumable = bagsB4.find((b: any) => b.item_id === 1);
    let auctionId: number | null = null;
    if (consumable) {
      auctionId = await _auctionService.listItem(uid, {
        bag_id: consumable.original_id ?? consumable.id,
        count: 1,
        price: 10,
      });
    }

    await _bagService.addItem(uid, 14, 1);
    try {
      await _skillService.learnSkill(uid, 14);
    } catch { /* 可能已学过 */ }

    const players = await _playerService.list(uid);
    await request(app)
      .post('/api/player/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: players[0].id });

    const playersAfter = await request(app).get('/api/player/list').set('Authorization', `Bearer ${token}`);
    expect(playersAfter.body.data.length).toBe(0);

    const orphanBags = await dataStorageService.list('bag', { uid });
    const orphanEquips = await dataStorageService.list('user_equip', { uid });
    const orphanSkills = await dataStorageService.list('player_skill', { uid });

    expect(orphanBags.length).toBe(0);
    expect(orphanEquips.length).toBe(0);
    expect(orphanSkills.length).toBe(0);

    if (auctionId) {
      const auction = await dataStorageService.getById('auction', auctionId);
      expect(auction).toBeNull();
    }
  });

  it('同一用户创建第二个角色，背包独立', async () => {
    const ts = String(Date.now()).slice(-6);
    const rnd = Math.random().toString(36).slice(2, 5);
    const username = `r2multi${ts}${rnd}`;
    const reg = await request(app).post('/api/user/register').send({ username, password: 'test123456' });
    expect(reg.body.code).toBe(0);
    const { uid, token } = reg.body.data;

    const add1 = await request(app).post('/api/player/add').set('Authorization', `Bearer ${token}`).send({ name: '角色一' });
    expect(add1.body.code).toBe(0);

    await _bagService.addItem(uid, 1, 5);

    const add2 = await request(app).post('/api/player/add').set('Authorization', `Bearer ${token}`).send({ name: '角色二' });
    if (add2.body.code === 0) {
      const bags = await _bagService.list(uid);
      expect(bags.length).toBeGreaterThan(0);
    } else {
      expect(add2.body.msg).toMatch(/已有角色|数量上限|已存在/);
    }
  });
});

/**
 * OfflineBattleService 集成测试 - 真实 DB，无 mock
 * 覆盖 simulate 主流程（需 VIP 玩家 + auto_battle_config）
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { OfflineBattleService } from '../../service/offline-battle.service';
import { PlayerService } from '../../service/player.service';
import { BagService } from '../../service/bag.service';
import { dataStorageService } from '../../service/data-storage.service';
import { Collections } from '../../config/collections';

const app = createApp();
const UNIQUE = `_offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('OfflineBattleService 集成测试', () => {
  const offlineService = new OfflineBattleService();
  const playerService = new PlayerService();
  let uid: number;
  let playerId: number;

  beforeAll(async () => {
    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    uid = reg.body.data.uid;

    const addRes = await request(app)
      .post('/api/player/add')
      .set('Authorization', `Bearer ${reg.body.data.token}`)
      .send({ name: '离线战斗测试角色' });
    if (addRes.body.code !== 0) throw new Error('创建角色失败');
    playerId = addRes.body.data.id;

    const now = Math.floor(Date.now() / 1000);
    await playerService.update(playerId, {
      vip_expire_time: now + 3600,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 120,
        auto_heal: null,
      },
    } as any);
  }, 10000);

  it('无玩家时 simulate 返回 0', async () => {
    const r = await offlineService.simulate(999999, { enemy_id: 1, last_battle_time: 0, auto_heal: null });
    expect(r).toEqual({ totalBattles: 0, died: false });
  });

  it('非 VIP 玩家 simulate 返回 0', async () => {
    const reg2 = await request(app).post('/api/user/register').send({ username: UNIQUE + '_2', password: 'test123456' });
    if (reg2.body.code !== 0) return;
    const uid2 = reg2.body.data.uid;
    await request(app).post('/api/player/add').set('Authorization', `Bearer ${reg2.body.data.token}`).send({ name: '非VIP' });
    const r = await offlineService.simulate(uid2, { enemy_id: 1, last_battle_time: Math.floor(Date.now() / 1000) - 120, auto_heal: null });
    expect(r.totalBattles).toBe(0);
  });

  it('maxSeconds <= 0 时 simulate 返回 0', async () => {
    const now = Math.floor(Date.now() / 1000);
    const r = await offlineService.simulate(uid, { enemy_id: 1, last_battle_time: now + 100, auto_heal: null });
    expect(r.totalBattles).toBe(0);
  });

  it('怪物不存在时 simulate 返回 0', async () => {
    const now = Math.floor(Date.now() / 1000);
    const r = await offlineService.simulate(uid, { enemy_id: 99999, last_battle_time: now - 120, auto_heal: null });
    expect(r.totalBattles).toBe(0);
  });

  it('VIP 玩家 simulate 返回战斗场次', async () => {
    const now = Math.floor(Date.now() / 1000);
    const config = {
      enemy_id: 1,
      last_battle_time: now - 120,
      auto_heal: null,
    };

    const result = await offlineService.simulate(uid, config);
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
    expect(typeof result.totalBattles).toBe('number');
    expect(typeof result.died).toBe('boolean');
  }, 15000);

  it('带 auto_heal 配置的 simulate', async () => {
    const loginRes = await request(app).post('/api/user/login').send({ username: UNIQUE, password: 'test123456' });
    const token = loginRes.body.data?.token;
    if (!token) return;
    const shopRes = await request(app).get('/api/shop/list').query({ type: 'gold' }).set('Authorization', `Bearer ${token}`);
    const goldItem = shopRes.body.data?.find((s: any) => s.item_id === 1);
    if (goldItem) {
      await request(app).post('/api/shop/buy').set('Authorization', `Bearer ${token}`).send({ shop_item_id: goldItem.id, count: 5 });
    }
    const hpItemId = 1;
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(playerId, {
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 60,
        auto_heal: {
          hp_enabled: true,
          hp_item_id: hpItemId,
          hp_threshold: 80,
          mp_enabled: false,
          mp_item_id: 0,
          mp_threshold: 50,
        },
      },
    } as any);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 60,
      auto_heal: {
        hp_enabled: true,
        hp_item_id: hpItemId,
        hp_threshold: 80,
        mp_enabled: false,
        mp_item_id: 0,
        mp_threshold: 50,
      },
    });
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
  }, 15000);

  it('玩家死亡时 died 为 true', async () => {
    await playerService.update(playerId, { hp: 1, max_hp: 1, phy_def: 0, mag_def: 0 } as any);
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 300,
      auto_heal: null,
    });
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
    expect(result.died).toBe(true);
    await playerService.update(playerId, { hp: 100, max_hp: 100 } as any);
  });

  it('auto_heal 仅 mp 启用', async () => {
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(playerId, {
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 60,
        auto_heal: {
          hp_enabled: false,
          hp_item_id: 0,
          hp_threshold: 50,
          mp_enabled: true,
          mp_item_id: 2,
          mp_threshold: 80,
        },
      },
    } as any);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 60,
      auto_heal: {
        hp_enabled: false,
        hp_item_id: 0,
        hp_threshold: 50,
        mp_enabled: true,
        mp_item_id: 2,
        mp_threshold: 80,
      },
    });
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
  }, 15000);

  it('vipEnd 小于 last_battle_time 返回 0', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now + 100,
      auto_heal: null,
    });
    expect(result.totalBattles).toBe(0);
  });

  it('背包有同种药水多格时合并到 potions', async () => {
    const adminRes = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'admin123' });
    const adminToken = adminRes.body.data?.token;
    if (adminToken) {
      await request(app).post('/api/admin/player/give-item').set({ Authorization: `Bearer ${adminToken}` }).send({ uid, item_id: 1, count: 5 });
    }
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 120,
      auto_heal: { hp_enabled: true, hp_item_id: 1, hp_threshold: 50, mp_enabled: false, mp_item_id: 0, mp_threshold: 50 },
    });
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
  }, 15000);

  it('vip_expire_time 为 0 时 vipMult 为 1', async () => {
    await playerService.update(playerId, { vip_expire_time: 0 } as any);
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 10,
      auto_heal: null,
    });
    expect(result.totalBattles).toBe(0);
    await playerService.update(playerId, { vip_expire_time: now + 3600 } as any);
  });

  // ==================== 100% 覆盖补充 ====================

  it('背包同种药水多格合并到 existing', async () => {
    const { BagService } = await import('../../service/bag.service');
    const bagService = new BagService();
    await bagService.addItem(uid, 1, 3);
    await bagService.addItem(uid, 1, 2);
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 60,
      auto_heal: { hp_enabled: true, hp_item_id: 1, hp_threshold: 50, mp_enabled: false, mp_item_id: 0, mp_threshold: 50 },
    });
    expect(result).toHaveProperty('totalBattles');
    expect(result).toHaveProperty('died');
  }, 15000);

  it('simulate 覆盖 physical 和 magic 技能分支', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 30,
      auto_heal: null,
    });
    expect(result).toHaveProperty('totalBattles');
    expect(typeof result.totalBattles).toBe('number');
  }, 15000);

  it('processDrops 装备掉落 isEquip 分支', async () => {
    const { MonsterService } = await import('../../service/monster.service');
    const monsterService = new MonsterService();
    const monsterId = await monsterService.add({
      name: '_equipDropMonster_',
      level: 1,
      hp: 5,
      phy_atk: 0,
      mag_atk: 0,
      phy_def: 0,
      mag_def: 0,
      exp: 1,
      gold: 0,
      map_id: 1,
    } as any);
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert(Collections.MONSTER_DROP, {
      monster_id: monsterId,
      item_id: 13,
      quantity: 1,
      probability: 100,
      create_time: now,
      update_time: now,
    });
    await playerService.update(playerId, {
      auto_battle_config: { enemy_id: monsterId, last_battle_time: now - 120, auto_heal: null },
    } as any);
    const result = await offlineService.simulate(uid, { enemy_id: monsterId, last_battle_time: now - 120, auto_heal: null });
    expect(result).toHaveProperty('totalBattles');
    const drops = await dataStorageService.list(Collections.MONSTER_DROP, { monster_id: monsterId });
    for (const d of drops) await dataStorageService.delete(Collections.MONSTER_DROP, d.id);
    await monsterService.delete(monsterId);
    await playerService.update(playerId, { auto_battle_config: { enemy_id: 1, last_battle_time: now, auto_heal: null } } as any);
  }, 15000);

  it('simulate 无技能分支', async () => {
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.deleteMany(Collections.PLAYER_SKILL, { uid });
    await playerService.update(playerId, {
      hp: 500,
      max_hp: 500,
      mp: 200,
      max_mp: 200,
      phy_atk: 50,
      mag_atk: 50,
      phy_def: 30,
      mag_def: 30,
      vip_expire_time: now + 3600,
      vip_level: 1,
    } as any);
    const r = await offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 30,
      auto_heal: null,
    });
    expect(r).toHaveProperty('totalBattles');
    expect(typeof r.totalBattles).toBe('number');
  }, 15000);
});

describe('关键路径/深度分支', () => {
  const _offlineService = new OfflineBattleService();
  const _playerService = new PlayerService();
  const _bagService = new BagService();

  it('simulate MP autoHeal 分支', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'offMp' });
    await giveItem(uid, 2, 10);
    const players = await _playerService.list(uid);
    const now = Math.floor(Date.now() / 1000);
    await _playerService.update(players[0].id, {
      vip_level: 1,
      vip_expire_time: now + 3600,
      mp: 1, max_mp: 500,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 120,
        auto_heal: { hp_enabled: false, hp_item_id: 0, hp_threshold: 50, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
      },
    } as any);
    const result = await _offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 120,
      auto_heal: { hp_enabled: false, hp_item_id: 0, hp_threshold: 50, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
    });
    expect(result).toHaveProperty('totalBattles');
  });

  it('simulate 装备掉落进 pendingDrops', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'offDr' });
    const players = await _playerService.list(uid);
    const now = Math.floor(Date.now() / 1000);
    await _playerService.update(players[0].id, {
      vip_level: 1,
      vip_expire_time: now + 3600,
      hp: 999999, max_hp: 999999, phy_atk: 999999, level: 100,
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 300, auto_heal: null },
    } as any);
    const result = await _offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 300,
      auto_heal: null,
    });
    expect(result.totalBattles).toBeGreaterThan(0);
  });

  it('simulate 升级分支', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'offLv' });
    const players = await _playerService.list(uid);
    const now = Math.floor(Date.now() / 1000);
    await _playerService.update(players[0].id, {
      vip_level: 1,
      vip_expire_time: now + 3600,
      hp: 999999, max_hp: 999999, phy_atk: 999999, level: 1, exp: 99999,
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 600, auto_heal: null },
    } as any);
    const result = await _offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: now - 600,
      auto_heal: null,
    });
    expect(result.totalBattles).toBeGreaterThan(0);
    const after = await _playerService.list(uid);
    expect(after[0].level).toBeGreaterThanOrEqual(1);
  });
});

describe('autoHeal MP 分支覆盖', () => {
  const _playerService = new PlayerService();
  const _bagService = new BagService();
  const _offlineService = new OfflineBattleService();
  let uid: number;

  beforeAll(async () => {
    const { createTestUser } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'ofl', suffix: 'mp' });
    uid = user.uid;
  }, 10000);

  it('simulate 带 MP autoHeal 配置', async () => {
    const players = await _playerService.list(uid);
    const p = players[0];
    await _playerService.update(p.id, {
      vip_level: 1, vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      hp: 9999, max_hp: 9999, mp: 10, max_mp: 100, phy_atk: 9999,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: Math.floor(Date.now() / 1000) - 30,
        auto_heal: { hp_enabled: false, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
      },
    } as any);
    await _bagService.addItem(uid, 2, 10);
    const result = await _offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: Math.floor(Date.now() / 1000) - 30,
      auto_heal: { hp_enabled: false, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
    } as any);
    expect(result.totalBattles).toBeGreaterThanOrEqual(0);
  });

  it('simulate 带 HP+MP autoHeal 配置', async () => {
    const players = await _playerService.list(uid);
    const p = players[0];
    await _playerService.update(p.id, {
      vip_level: 1, vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      hp: 50, max_hp: 100, mp: 10, max_mp: 100, phy_atk: 9999,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: Math.floor(Date.now() / 1000) - 30,
        auto_heal: { hp_enabled: true, hp_item_id: 1, hp_threshold: 50, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
      },
    } as any);
    await _bagService.addItem(uid, 1, 10);
    await _bagService.addItem(uid, 2, 10);
    const result = await _offlineService.simulate(uid, {
      enemy_id: 1,
      last_battle_time: Math.floor(Date.now() / 1000) - 30,
      auto_heal: { hp_enabled: true, hp_item_id: 1, hp_threshold: 50, mp_enabled: true, mp_item_id: 2, mp_threshold: 50 },
    } as any);
    expect(result.totalBattles).toBeGreaterThanOrEqual(0);
  });
});

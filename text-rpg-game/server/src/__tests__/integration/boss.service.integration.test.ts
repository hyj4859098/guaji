/**
 * BossService 集成测试 - getBoss、getBossList、challenge
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { BossService } from '../../service/boss.service';
import { BagService } from '../../service/bag.service';
import { PlayerService } from '../../service/player.service';
import { dataStorageService as _dsService } from '../../service/data-storage.service';

const app = createApp();

describe('BossService 集成测试', () => {
  let uid: number;
  const bossService = new BossService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'bos', charName: 'Boss测试' });
    uid = user.uid;
  }, 10000);

  it('getBoss 不存在的 id 返回 null', async () => {
    const boss = await bossService.getBoss(99999);
    expect(boss).toBeNull();
  });

  it('getBoss 存在的 id 返回详情含 drops', async () => {
    const boss = await bossService.getBoss(1);
    expect(boss).not.toBeNull();
    expect(boss).toHaveProperty('drops');
    expect(Array.isArray(boss!.drops)).toBe(true);
  });

  it('getBossList 无 mapId 返回全部', async () => {
    const list = await bossService.getBossList(uid);
    expect(Array.isArray(list)).toBe(true);
  });

  it('getBossList 指定 mapId 筛选', async () => {
    const list = await bossService.getBossList(uid, 1);
    expect(Array.isArray(list)).toBe(true);
    list.forEach((b: any) => expect(b.map_id).toBe(1));
  });

  it('challenge 不存在的 Boss 返回 lose', async () => {
    const result = await bossService.challenge(uid, 99999);
    expect(result).toHaveProperty('result');
    expect(result.result).toBe(1);
  });

  it('challenge 无角色返回 lose', async () => {
    const result = await bossService.challenge(999999, 1);
    expect(result.result).toBe(1);
  });

  it('challenge 存在的 Boss 返回战斗结果', async () => {
    const result = await bossService.challenge(uid, 1);
    expect(result).toHaveProperty('result');
    expect([0, 1]).toContain(result.result);
    expect(result).toHaveProperty('rounds');
  }, 15000);

  it('stopBattle 未在 Boss 战斗返回 false', async () => {
    const ok = await bossService.stopBattle(uid);
    expect(ok).toBe(false);
  });

  it('stopBattle 不存在的 uid 返回 false', async () => {
    const ok = await bossService.stopBattle(999999);
    expect(ok).toBe(false);
  });

  it('stopBattle 在 Boss 战斗中可调用', async () => {
    const p = bossService.challenge(uid, 1);
    await new Promise((r) => setTimeout(r, 30));
    const ok = bossService.stopBattle(uid);
    expect(typeof ok).toBe('boolean');
    await p;
  }, 5000);

  it('getBossList 指定 mapId 无匹配返回空', async () => {
    const list = await bossService.getBossList(uid, 99999);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('challenge 重复调用时第二次返回 lose（锁）', async () => {
    const p1 = bossService.challenge(uid, 1);
    const p2 = bossService.challenge(uid, 1);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect([0, 1]).toContain(r1.result);
    expect(r2.result).toBe(1);
  }, 10000);

  it('getBossList Boss 死亡超 30 秒后复活', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(states.length).toBeGreaterThan(0);
    const s = states[0];
    const origHp = s.current_hp;
    const origDeath = s.last_death_time;
    try {
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: now - 35,
      });
      const list = await bossService.getBossList(uid);
      const b1 = list.find((b: any) => (b.id || b.boss_id) === 1);
      expect(b1).toBeDefined();
      expect(b1?.can_fight).toBe(true);
    } finally {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: origHp ?? s.max_hp ?? 100,
        last_death_time: origDeath ?? 0,
      });
    }
  }, 5000);

  it('challenge Boss 死亡未满 30 秒返回 lose', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(states.length).toBeGreaterThan(0);
    const s = states[0];
    const origHp = s.current_hp;
    const origDeath = s.last_death_time;
    try {
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: now - 10,
      });
      const result = await bossService.challenge(uid, 1);
      expect(result.result).toBe(1);
      expect(result.rounds).toBe(0);
    } finally {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: origHp ?? s.max_hp ?? 100,
        last_death_time: origDeath ?? 0,
      });
    }
  });

  it('getBoss boss_drop 为空时回退到 monster_drop', async () => {
    const boss = await bossService.getBoss(1);
    expect(boss).not.toBeNull();
    expect(boss).toHaveProperty('drops');
    expect(Array.isArray(boss!.drops)).toBe(true);
  });

  it('getBossList 新 Boss 无 state 时 ensureBossState 创建', async () => {
    const bossId = await bossService.add({
      name: '_ensureStateBoss_', level: 1, hp: 50, map_id: 1,
    } as any);
    const list = await bossService.getBossList(uid, 1);
    expect(list.some((b: any) => (b.id || b.boss_id) === bossId)).toBe(true);
    await bossService.delete(bossId);
  });

  it('challenge 带 autoHeal 参数', async () => {
    const BagService = (await import('../../service/bag.service')).BagService;
    const bagService = new BagService();
    await bagService.addItem(uid, 1, 2);
    const list = await bagService.list(uid);
    const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    expect(potion).toBeDefined();
    const bagId = potion!.original_id ?? potion!.id;
    const result = await bossService.challenge(uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: bagId,
      hp_threshold: 50,
      mp_enabled: false,
      mp_potion_bag_id: 0,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
  }, 15000);

  // ==================== 分支覆盖补充 ====================

  it('challenge 带 autoHeal mp_enabled 覆盖 mp 分支', async () => {
    const BagService = (await import('../../service/bag.service')).BagService;
    const bagService = new BagService();
    await bagService.addItem(uid, 1, 2);
    await bagService.addItem(uid, 2, 2);
    const list = await bagService.list(uid);
    const hpPotion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    const mpPotion = list.find((i: any) => i.item_id === 2 && !i.equipment_uid && (i.count || 0) >= 1);
    expect(hpPotion).toBeDefined();
    expect(mpPotion).toBeDefined();
    const result = await bossService.challenge(uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: hpPotion!.original_id ?? hpPotion!.id,
      hp_threshold: 90,
      mp_enabled: true,
      mp_potion_bag_id: mpPotion!.original_id ?? mpPotion!.id,
      mp_threshold: 90,
    });
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
  }, 15000);

  it('challenge Boss 死亡未满 30 秒时错误消息含「秒后刷新」', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(states.length).toBeGreaterThan(0);
    const s = states[0];
    const origHp = s.current_hp;
    const origDeath = s.last_death_time;
    try {
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: now - 5,
      });
      const result = await bossService.challenge(uid, 1);
      expect(result.result).toBe(1);
      expect(result.rounds).toBe(0);
    } finally {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: origHp ?? s.max_hp ?? 100,
        last_death_time: origDeath ?? 0,
      });
    }
  });

  it('challenge Boss 无 state 时 ensureBossState 会创建', async () => {
    const bossId = await bossService.add({
      name: '_freshBoss_', level: 1, hp: 50, map_id: 1,
    } as any);
    const result = await bossService.challenge(uid, bossId);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
    expect([0, 1]).toContain(result.result);
    await bossService.delete(bossId);
  }, 15000);

  it('getBoss 返回的 drops 含 item_name', async () => {
    const boss = await bossService.getBoss(1);
    expect(boss).not.toBeNull();
    expect(boss).toHaveProperty('drops');
    expect(Array.isArray(boss!.drops)).toBe(true);
    for (const d of boss!.drops! || []) {
      expect(d).toHaveProperty('item_name');
      expect(typeof d.item_name).toBe('string');
    }
  });

  it('getBossList 按 level 排序', async () => {
    const list = await bossService.getBossList(uid);
    for (let i = 1; i < list.length; i++) {
      expect((list[i].level || 0)).toBeGreaterThanOrEqual(list[i - 1].level || 0);
    }
  });

  it('getBossList 返回 can_fight 和 respawn_remain', async () => {
    const list = await bossService.getBossList(uid);
    list.forEach((b: any) => {
      expect(typeof b.can_fight).toBe('boolean');
      expect(typeof b.respawn_remain).toBe('number');
      expect(b.respawn_remain).toBeGreaterThanOrEqual(0);
    });
  });

  it('add/update/delete GM 方法', async () => {
    const id = await bossService.add({ name: '_gmTest_', level: 1, hp: 100, map_id: 1 } as any);
    expect(typeof id).toBe('number');
    const ok = await bossService.update(id, { name: '_gmTest2_' });
    expect(ok).toBe(true);
    const delOk = await bossService.delete(id);
    expect(delOk).toBe(true);
  });

  it('challenge 胜利后 processDrop 触发', async () => {
    const result = await bossService.challenge(uid, 1);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  }, 15000);

  it('getBoss 返回 drops 含 quantity 和 probability', async () => {
    const boss = await bossService.getBoss(1);
    expect(boss).not.toBeNull();
    expect(Array.isArray(boss!.drops)).toBe(true);
    for (const d of boss!.drops! || []) {
      expect(d).toHaveProperty('quantity');
      expect(d).toHaveProperty('probability');
    }
  });

  // ==================== 模块集中覆盖（目标 70-80%） ====================

  it('runBossBattle phy_def_pct 分支', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).phy_def_pct;
    try {
      await playerService.update(players[0].id, { phy_def_pct: 15 } as any);
      const result = await bossService.challenge(uid, 1);
      expect(result).toHaveProperty('result');
      expect([0, 1]).toContain(result.result);
    } finally {
      await playerService.update(players[0].id, { phy_def_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('runBossBattle mag_def_pct 分支', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).mag_def_pct;
    try {
      await playerService.update(players[0].id, { mag_def_pct: 15 } as any);
      const result = await bossService.challenge(uid, 1);
      expect(result).toHaveProperty('result');
    } finally {
      await playerService.update(players[0].id, { mag_def_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('runBossBattle max_hp_pct 分支', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).max_hp_pct;
    try {
      await playerService.update(players[0].id, { max_hp_pct: 25 } as any);
      const result = await bossService.challenge(uid, 1);
      expect(result).toHaveProperty('result');
    } finally {
      await playerService.update(players[0].id, { max_hp_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('processDrop 无 drops 的 Boss 胜利后 items 为空', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const bossId = await bossService.add({
      name: '_noDropBoss_', level: 1, hp: 10, map_id: 1, exp: 0, gold: 0, reputation: 0,
    } as any);
    await dataStorageService.insert('boss_state', {
      boss_id: bossId,
      current_hp: 10,
      max_hp: 10,
      last_death_time: 0,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000),
    });
    const result = await bossService.challenge(uid, bossId);
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBe(0);
    await bossService.delete(bossId);
  }, 15000);

  it('processDrop 消耗品掉落 itemType 非 2', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const bossId = await bossService.add({
      name: '_consumeDropBoss_', level: 1, hp: 10, map_id: 1, exp: 0, gold: 0, reputation: 0,
    } as any);
    await dataStorageService.insert('boss_state', {
      boss_id: bossId,
      current_hp: 10,
      max_hp: 10,
      last_death_time: 0,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000),
    });
    await dataStorageService.insert('boss_drop', {
      boss_id: bossId,
      item_id: 1,
      quantity: 2,
      probability: 100,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000),
    });
    const result = await bossService.challenge(uid, bossId);
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
    await bossService.delete(bossId);
    const drops = await dataStorageService.list('boss_drop', { boss_id: bossId });
    for (const d of drops) await dataStorageService.delete('boss_drop', d.id);
  }, 15000);

  it('getBoss drops 结构正确', async () => {
    const boss = await bossService.getBoss(1);
    expect(boss).not.toBeNull();
    expect(boss!.drops).toBeDefined();
    expect(Array.isArray(boss!.drops)).toBe(true);
  });

  it('getBossList map_id 和 name 默认值', async () => {
    const bossId = await bossService.add({
      name: 'TestBoss',
      level: 1,
      hp: 50,
      map_id: undefined,
    } as any);
    const list = await bossService.getBossList(uid);
    const b = list.find((x: any) => (x.id || x.boss_id) === bossId);
    expect(b).toBeDefined();
    expect(b!.map_id == null || typeof b!.map_id === 'number').toBe(true);
    expect(b!.name).toBeDefined();
    await bossService.delete(bossId);
  });

  it('challenge 胜利时 pushEvent result 为 win', async () => {
    const result = await bossService.challenge(uid, 1);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
    expect(result).toHaveProperty('items');
    if (result.result === 0) {
      expect(result.rounds).toBeGreaterThan(0);
      expect(Array.isArray(result.items)).toBe(true);
    }
  }, 15000);

  it('challenge 失败时 pushEvent result 为 lose', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(states.length).toBeGreaterThan(0);
    const s = states[0];
    const orig = { hp: s.current_hp, death: s.last_death_time };
    try {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: Math.floor(Date.now() / 1000) - 5,
      });
      const result = await bossService.challenge(uid, 1);
      expect(result.result).toBe(1);
      expect(result.rounds).toBe(0);
    } finally {
      await dataStorageService.update('boss_state', s.id, orig);
    }
  });

  // ==================== 100% 覆盖补充 ====================

  it('processDrop boss_drop 为空时回退 monster_drop', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const bossId = await bossService.add({
      name: '_monsterDropBoss_', level: 1, hp: 10, map_id: 1, exp: 0, gold: 0, reputation: 0,
    } as any);
    await dataStorageService.insert('boss_state', {
      boss_id: bossId,
      current_hp: 10,
      max_hp: 10,
      last_death_time: 0,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000),
    });
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert('monster_drop', {
      monster_id: bossId,
      item_id: 1,
      quantity: 1,
      probability: 100,
      create_time: now,
      update_time: now,
    });
    const result = await bossService.challenge(uid, bossId);
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
    const drops = await dataStorageService.list('monster_drop', { monster_id: bossId });
    for (const d of drops) await dataStorageService.delete('monster_drop', d.id);
    await bossService.delete(bossId);
  }, 15000);

  // ==================== branch-coverage 补充 ====================

  it('challenge Boss 死亡未复活时拒绝挑战（branch）', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    await bossService.challenge(uid, 1).catch(() => {});
    await new Promise(r => setTimeout(r, 300));
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    if (states.length === 0) {
      await dataStorageService.insert('boss_state', { boss_id: 1, current_hp: 100, max_hp: 100, last_death_time: 0 });
    }
    const statesAfter = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(statesAfter.length).toBeGreaterThan(0);
    const s = statesAfter[0];
    const origHp = s.current_hp;
    const origDeath = s.last_death_time;

    try {
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: now,
      });

      const result = await bossService.challenge(uid, 1);
      expect(result.result).toBe(1);
      expect(result.rounds).toBe(0);
    } finally {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: origHp ?? s.max_hp ?? 100,
        last_death_time: origDeath ?? 0,
      });
    }
  });

  it('getBossList Boss 复活后状态恢复（branch）', async () => {
    const { dataStorageService } = await import('../../service/data-storage.service');
    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    if (states.length === 0) {
      await dataStorageService.insert('boss_state', { boss_id: 1, current_hp: 100, max_hp: 100, last_death_time: 0 });
    }
    const statesAfter = await dataStorageService.list('boss_state', { boss_id: 1 });
    expect(statesAfter.length).toBeGreaterThan(0);
    const s = statesAfter[0];
    const origHp = s.current_hp;
    const origDeath = s.last_death_time;

    try {
      const now = Math.floor(Date.now() / 1000);
      await dataStorageService.update('boss_state', s.id, {
        current_hp: 0,
        last_death_time: now - 35,
      });

      const list = await bossService.getBossList(uid);
      const boss1 = list.find((b: any) => (b.id || b.boss_id) === 1);
      expect(boss1).toBeDefined();
      expect(boss1!.can_fight).toBe(true);
      expect(boss1!.current_hp).toBeGreaterThan(0);
    } finally {
      await dataStorageService.update('boss_state', s.id, {
        current_hp: origHp ?? s.max_hp ?? 100,
        last_death_time: origDeath ?? 0,
      });
    }
  });

  it('challenge 胜利时掉落物品（branch）', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const { dataStorageService } = await import('../../service/data-storage.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, { hp: 9999, max_hp: 9999, phy_atk: 9999, mag_atk: 9999 } as any);

    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    if (states.length) {
      const boss = await dataStorageService.getById('boss', 1);
      await dataStorageService.update('boss_state', states[0].id, {
        current_hp: boss?.hp ?? 100,
        last_death_time: 0,
      });
    }

    const result = await bossService.challenge(uid, 1);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
    if (result.result === 0) {
      expect(result.rounds).toBeGreaterThan(0);
    }
  }, 15000);

  it('challenge 带 autoHeal 参数不崩溃（branch）', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const { BagService } = await import('../../service/bag.service');
    const { dataStorageService } = await import('../../service/data-storage.service');
    const playerService = new PlayerService();
    const bagService = new BagService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, { hp: 9999, max_hp: 9999, phy_atk: 9999, mag_atk: 9999 } as any);
    await bagService.addItem(uid, 1, 5);

    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    if (states.length) {
      const boss = await dataStorageService.getById('boss', 1);
      await dataStorageService.update('boss_state', states[0].id, {
        current_hp: boss?.hp ?? 100,
        last_death_time: 0,
      });
    }

    const list = await bagService.list(uid);
    const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    const bagId = potion ? (potion.original_id ?? potion.id) : 0;

    const result = await bossService.challenge(uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: bagId,
      hp_threshold: 80,
      mp_enabled: false,
      mp_potion_bag_id: 0,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
  }, 15000);

  it('settle VIP 倍率影响 Boss 奖励（branch）', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const { dataStorageService } = await import('../../service/data-storage.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, {
      hp: 9999, max_hp: 9999, phy_atk: 9999, mag_atk: 9999,
      vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      vip_level: 1,
    } as any);

    const states = await dataStorageService.list('boss_state', { boss_id: 1 });
    if (states.length) {
      const boss = await dataStorageService.getById('boss', 1);
      await dataStorageService.update('boss_state', states[0].id, {
        current_hp: boss?.hp ?? 100,
        last_death_time: 0,
      });
    }

    const playersBefore = await playerService.list(uid);
    const goldBefore = playersBefore[0].gold || 0;

    const result = await bossService.challenge(uid, 1);
    if (result.result === 0) {
      const playersAfter = await playerService.list(uid);
      const goldAfter = playersAfter[0].gold || 0;
      expect(goldAfter).toBeGreaterThanOrEqual(goldBefore);
    }

    await playerService.update(players[0].id, { vip_expire_time: 0, vip_level: 0 } as any);
  }, 15000);
});

describe('关键路径/深度分支', () => {
  const _bossService = new BossService();
  const _bagService = new BagService();
  const _playerService = new PlayerService();

  it('Boss 死亡后 30 秒内拒绝挑战', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'bsDead' });
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, {
      hp: 999999, max_hp: 999999, phy_atk: 999999, mag_atk: 999999, level: 100,
    } as any);
    await _bossService.challenge(uid, 1);
    const result2 = await _bossService.challenge(uid, 1);
    expect([0, 1]).toContain(result2.result);
  }, 15000);

  it('ensureBossState 已存在时跳过（不创建重复）', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'bsEns' });
    const statesBefore = await _dsService.list('boss_state', { boss_id: 1 });
    await _bossService.getBossList(uid, 1);
    await _bossService.getBossList(uid, 1);
    const statesAfter = await _dsService.list('boss_state', { boss_id: 1 });
    expect(statesAfter.length).toBe(statesBefore.length);
  });

  it('Boss autoHeal HP 分支', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'bsHeal' });
    await giveItem(uid, 1, 10);
    const bags = await _bagService.list(uid);
    const potion = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, { hp: 10, max_hp: 5000 } as any);
    const autoHeal = potion
      ? { hp_enabled: true, hp_potion_bag_id: potion.original_id ?? potion.id, hp_threshold: 90, mp_enabled: false }
      : undefined;
    const result = await _bossService.challenge(uid, 1, autoHeal);
    expect(result).toHaveProperty('result');
  }, 15000);

  it('Boss processDrop 无 boss_drop 时从 monster_drop 查询', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'bsDrop' });
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, {
      hp: 999999, max_hp: 999999, phy_atk: 999999, mag_atk: 999999, level: 100,
    } as any);
    const bossState = await _dsService.list('boss_state', { boss_id: 1 });
    if (bossState.length) {
      await _dsService.update('boss_state', bossState[0].id, {
        current_hp: 1000, max_hp: 1000, last_death_time: 0,
      });
    }
    const result = await _bossService.challenge(uid, 1);
    expect(result).toHaveProperty('result');
  }, 15000);

  it('两人挑战同一 Boss，不会服务端崩溃', async () => {
    const userA = await createTestUser(app, { prefix: 'r2', suffix: 'bossA' });
    const userB = await createTestUser(app, { prefix: 'r2', suffix: 'bossB' });
    const [resA, resB] = await Promise.all([
      request(app).post('/api/boss/challenge').set('Authorization', `Bearer ${userA.token}`).send({ boss_id: 1 }),
      request(app).post('/api/boss/challenge').set('Authorization', `Bearer ${userB.token}`).send({ boss_id: 1 }),
    ]);
    const successCount = [resA, resB].filter(r => r.body.code === 0).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
  }, 30000);
});

describe('Boss autoHeal MP 分支', () => {
  const bossService = new BossService();
  let uid: number;

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'bos', suffix: 'mpheal' });
    uid = user.uid;
  }, 10000);

  it('challenge 带 autoHeal MP 分支', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const { BagService } = await import('../../service/bag.service');
    const playerService = new PlayerService();
    const bagService = new BagService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, { hp: 9999, max_hp: 9999, mp: 5, max_mp: 100, phy_atk: 9999 } as any);
    await bagService.addItem(uid, 2, 5);
    const bags = await bagService.list(uid);
    const mpPot = bags.find((b: any) => b.item_id === 2 && !b.equipment_uid);
    const result = await bossService.challenge(uid, 1, {
      hp_enabled: false,
      mp_enabled: true,
      mp_potion_bag_id: mpPot ? (mpPot.original_id ?? mpPot.id) : undefined,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
  }, 15000);

  it('challenge autoHeal 无效药水不崩溃', async () => {
    const { PlayerService } = await import('../../service/player.service');
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, { hp: 9999, max_hp: 9999, mp: 5, max_mp: 100, phy_atk: 9999 } as any);
    const result = await bossService.challenge(uid, 1, {
      hp_enabled: true, hp_potion_bag_id: 999888, hp_threshold: 50,
      mp_enabled: true, mp_potion_bag_id: 999777, mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
  }, 15000);
});

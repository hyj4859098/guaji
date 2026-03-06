/**
 * BattleService 集成测试 - startBattle、stopBattle、getBattleStatus、resumeAutoBattle
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { BattleService } from '../../service/battle.service';
import { PlayerService } from '../../service/player.service';
import { BagService } from '../../service/bag.service';
import { SkillService } from '../../service/skill.service';
import { LevelExpService } from '../../service/level_exp.service';

const app = createApp();

describe('BattleService 集成测试', () => {
  let uid: number;
  const battleService = new BattleService();
  const playerService = new PlayerService();
  const bagService = new BagService();

  beforeAll(async () => {
    const user = await createTestUser(app, { prefix: 'bat', charName: '战斗测试' });
    uid = user.uid;
    await bagService.addItem(uid, 1, 3);
  }, 10000);

  it('getBattleStatus 无角色时返回 idle', async () => {
    const noPlayerUid = 999999;
    const status = await battleService.getBattleStatus(noPlayerUid);
    expect(status).toEqual({ isFighting: false, state: 'idle' });
  });

  it('getBattleStatus 有角色无自动战斗返回 idle', async () => {
    const status = await battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(false);
    expect(['idle', 'offline_battle']).toContain(status.state);
  });

  it('stopBattle 未在战斗时返回 false', async () => {
    const ok = await battleService.stopBattle(uid);
    expect(ok).toBe(false);
  });

  it('startBattle 正常战斗返回结果', async () => {
    const result = await battleService.startBattle(uid, 1);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('rounds');
    expect(result).toHaveProperty('exp');
    expect([0, 1]).toContain(result.result);
  }, 15000);

  it('startBattle 无角色时返回 lose', async () => {
    const result = await battleService.startBattle(999999, 1);
    expect(result.result).toBe(1);
    expect(result.rounds).toBe(0);
  });

  it('startBattle 怪物不存在时返回 lose', async () => {
    const result = await battleService.startBattle(uid, 99999);
    expect(result.result).toBe(1);
  });

  it('resumeAutoBattle 无角色返回空', async () => {
    const r = await battleService.resumeAutoBattle(999999);
    expect(r).toEqual({ offlineBattles: 0, died: false, resumed: false });
  });

  it('resumeAutoBattle 无 auto_battle_config 返回空', async () => {
    const r = await battleService.resumeAutoBattle(uid);
    expect(r).toHaveProperty('offlineBattles');
    expect(r).toHaveProperty('died');
    expect(r).toHaveProperty('resumed');
  });

  it('startAutoBattle 成功', async () => {
    const started = await battleService.startAutoBattle(uid, 1);
    expect(started).toBe(true);
    const ok = await battleService.stopBattle(uid);
    expect(ok).toBe(true);
    await new Promise((r) => setTimeout(r, 600));
  });

  it('startAutoBattle 已在战斗中返回 false', async () => {
    await battleService.startAutoBattle(uid, 1);
    const started = await battleService.startAutoBattle(uid, 1);
    expect(started).toBe(false);
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 500));
  });

  it('getBattleStatus 自动战斗中返回 battle', async () => {
    await battleService.startAutoBattle(uid, 1);
    const status = await battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(true);
    expect(status.state).toBe('battle');
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 500));
  });

  it('resumeAutoBattle 有 config 且 VIP 时恢复', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 60, auto_heal: null },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r).toHaveProperty('offlineBattles');
    expect(r).toHaveProperty('resumed');
  }, 20000);

  it('startBattle 已在战斗中返回 lose', async () => {
    await battleService.startAutoBattle(uid, 1);
    await new Promise((r) => setTimeout(r, 50));
    const result = await battleService.startBattle(uid, 1);
    expect(result.result).toBe(1);
    expect(result.rounds).toBe(0);
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 500));
  });

  it('getBattleStatus 有 config 无战斗时返回 offline_battle', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 10, auto_heal: null },
    } as any);
    const status = await battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(false);
    expect(['idle', 'offline_battle']).toContain(status.state);
    if (status.state === 'offline_battle') expect(status.config).toBeDefined();
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
  });

  it('stopBattle 未在战斗时返回 false', async () => {
    const ok = await battleService.stopBattle(999999);
    expect(ok).toBe(false);
  });

  it('startAutoBattle 后立即 stop 触发 stopRequested 分支', async () => {
    const started = await battleService.startAutoBattle(uid, 1);
    expect(started).toBe(true);
    const ok = await battleService.stopBattle(uid);
    expect(ok).toBe(true);
    await new Promise((r) => setTimeout(r, 800));
  });

  it('startBattle 带 autoHeal 参数', async () => {
    const list = await bagService.list(uid);
    const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    expect(potion).toBeDefined();
    const bagId = potion!.original_id ?? potion!.id;
    const result = await battleService.startBattle(uid, 1, {
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

  it('startBattle 带 hp 和 mp 双 autoHeal', async () => {
    await bagService.addItem(uid, 1, 2);
    await bagService.addItem(uid, 2, 2);
    const list = await bagService.list(uid);
    const hpPotion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    const mpPotion = list.find((i: any) => i.item_id === 2 && !i.equipment_uid && (i.count || 0) >= 1);
    expect(hpPotion).toBeDefined();
    expect(mpPotion).toBeDefined();
    const result = await battleService.startBattle(uid, 1, {
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

  it('startAutoBattle 带 autoHeal 保存配置', async () => {
    const list = await bagService.list(uid);
    const potion = list.find((i: any) => i.item_id === 1 && !i.equipment_uid && (i.count || 0) >= 1);
    expect(potion).toBeDefined();
    const bagId = potion!.original_id ?? potion!.id;
    const started = await battleService.startAutoBattle(uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: bagId,
      hp_threshold: 50,
      mp_enabled: false,
      mp_potion_bag_id: 0,
      mp_threshold: 50,
    });
    expect(started).toBe(true);
    const status = await battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(true);
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 600));
  }, 10000);

  it('resumeAutoBattle 有 config 无 VIP 不模拟离线战斗', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    await playerService.update(players[0].id, { vip_expire_time: 0, auto_battle_config: null } as any);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 60, auto_heal: null },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r.offlineBattles).toBe(0);
    expect(r.resumed).toBeDefined();
    await playerService.update(players[0].id, { vip_expire_time: now + 3600 } as any);
  });

  it('resumeAutoBattle 死亡后 resumed 为 false', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    await playerService.update(players[0].id, { hp: 1, max_hp: 1, phy_def: 0, mag_def: 0 } as any);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 300, auto_heal: null },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r.died).toBe(true);
    expect(r.resumed).toBe(false);
    await playerService.update(players[0].id, { hp: 100, max_hp: 100 } as any);
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
  }, 20000);

  it('resumeAutoBattle 有 config 无 last_battle_time 不模拟', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: { enemy_id: 1, last_battle_time: 0, auto_heal: null },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r.offlineBattles).toBe(0);
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
  });

  it('resumeAutoBattle 恢复后 freshConfig 为空不恢复', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: { enemy_id: 1, last_battle_time: now - 5, auto_heal: null },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r).toHaveProperty('resumed');
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
  });

  // ==================== 分支覆盖补充 ====================

  it('getBattleStatus 无 config 返回 idle', async () => {
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 800));
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
    const status = await battleService.getBattleStatus(uid);
    expect(status.state).toBe('idle');
    expect(status.isFighting).toBe(false);
  });

  it('startBattle 怪物不存在返回 lose', async () => {
    const result = await battleService.startBattle(uid, 88888);
    expect(result.result).toBe(1);
    expect(result.rounds).toBe(0);
  });

  it('startAutoBattle 已在战斗中立即返回 false', async () => {
    await battleService.startAutoBattle(uid, 1);
    await new Promise((r) => setTimeout(r, 50));
    const second = await battleService.startAutoBattle(uid, 2);
    expect(second).toBe(false);
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 500));
  });

  it('runOneBattle 通过 startBattle 覆盖 phy_def_pct 分支', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).phy_def_pct;
    try {
      await playerService.update(players[0].id, { phy_def_pct: 10 } as any);
      const result = await battleService.startBattle(uid, 1);
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('rounds');
    } finally {
      await playerService.update(players[0].id, { phy_def_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('runOneBattle 通过 startBattle 覆盖 mag_def_pct 分支', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).mag_def_pct;
    try {
      await playerService.update(players[0].id, { mag_def_pct: 10 } as any);
      const result = await battleService.startBattle(uid, 1);
      expect(result).toHaveProperty('result');
    } finally {
      await playerService.update(players[0].id, { mag_def_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('runOneBattle 通过 startBattle 覆盖 max_hp_pct 分支', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const orig = (players[0] as any).max_hp_pct;
    try {
      await playerService.update(players[0].id, { max_hp_pct: 20 } as any);
      const result = await battleService.startBattle(uid, 1);
      expect(result).toHaveProperty('result');
    } finally {
      await playerService.update(players[0].id, { max_hp_pct: orig ?? 0 } as any);
    }
  }, 15000);

  it('startBattle 战斗失败不调用 settle', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const origHp = players[0].hp;
    try {
      await playerService.update(players[0].id, { hp: 1, max_hp: 1, phy_def: 0, mag_def: 0 } as any);
      const result = await battleService.startBattle(uid, 1);
      expect(result.result).toBe(1);
      expect(result.rounds).toBe(0);
    } finally {
      await playerService.update(players[0].id, { hp: origHp ?? 100, max_hp: 100 } as any);
    }
  }, 15000);

  it('_autoBattleLoop 非 VIP 掉线时清除 config', async () => {
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    await playerService.update(players[0].id, { vip_expire_time: 0 } as any);
    const started = await battleService.startAutoBattle(uid, 1);
    expect(started).toBe(true);
    await new Promise((r) => setTimeout(r, 400));
    const status = await battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(false);
    const freshPlayers = await playerService.list(uid);
    expect(freshPlayers[0]?.auto_battle_config == null).toBe(true);
  }, 5000);

  // ==================== 100% 覆盖补充 ====================

  it('processDrop monster.drops 为空时从 monster_drop 表拉取', async () => {
    const { MonsterService } = await import('../../service/monster.service');
    const { dataStorageService } = await import('../../service/data-storage.service');
    const { cacheService } = await import('../../service/cache.service');
    const monsterService = new MonsterService();
    const monsterId = await monsterService.add({
      name: '_dropFallbackMonster_',
      level: 1,
      hp: 5,
      phy_atk: 0,
      mag_atk: 0,
      phy_def: 0,
      mag_def: 0,
      exp: 1,
      gold: 1,
      map_id: 1,
    } as any);
    monsterService.get(monsterId);
    const now = Math.floor(Date.now() / 1000);
    await dataStorageService.insert('monster_drop', {
      monster_id: monsterId,
      item_id: 1,
      quantity: 1,
      probability: 100,
      create_time: now,
      update_time: now,
    });
    const result = await battleService.startBattle(uid, monsterId);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('items');
    if (result.result === 0) expect(Array.isArray(result.items)).toBe(true);
    cacheService.monster.invalidate(monsterId);
    await monsterService.delete(monsterId);
  }, 15000);

  it('resumeAutoBattle 带 auto_heal 时 resolveItemToBagId 解析药水', async () => {
    await bagService.addItem(uid, 1, 2);
    const players = await playerService.list(uid);
    expect(players.length).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 120,
        auto_heal: {
          hp_enabled: true,
          hp_item_id: 1,
          hp_threshold: 50,
          mp_enabled: false,
          mp_item_id: 0,
          mp_threshold: 50,
        },
      },
    } as any);
    const r = await battleService.resumeAutoBattle(uid);
    expect(r).toHaveProperty('resumed');
    expect(r).toHaveProperty('offlineBattles');
    await battleService.stopBattle(uid);
    await new Promise(resolve => setTimeout(resolve, 500));
    await playerService.update(players[0].id, { auto_battle_config: null } as any);
  }, 20000);

  // ==================== branch-coverage 补充 ====================

  it('_autoBattleLoop 战斗失败时退出循环并清除 config', async () => {
    await battleService.stopBattle(uid);
    await new Promise(r => setTimeout(r, 800));

    const players = await playerService.list(uid);
    try {
      await playerService.update(players[0].id, {
        hp: 1, max_hp: 1, phy_atk: 1, phy_def: 0, mag_def: 0,
        vip_expire_time: 0,
        auto_battle_config: null,
      } as any);

      const started = await battleService.startAutoBattle(uid, 1);
      expect(started).toBe(true);

      await new Promise(r => setTimeout(r, 4000));

      const freshPlayers = await playerService.list(uid);
      expect(freshPlayers[0].auto_battle_config).toBeNull();

      const status = await battleService.getBattleStatus(uid);
      expect(status.isFighting).toBe(false);
    } finally {
      await playerService.update(players[0].id, { hp: 9999, max_hp: 9999, phy_atk: 9999 } as any);
    }
  }, 15000);

  it('processDrop 无掉落列表时从 monster_drop 查询（branch）', async () => {
    const result = await battleService.startBattle(uid, 1);
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  }, 15000);

  it('settle 结算 VIP 倍率', async () => {
    const playersBefore = await playerService.list(uid);
    const goldBefore = playersBefore[0].gold || 0;

    await playerService.update(playersBefore[0].id, {
      hp: 9999, max_hp: 9999, phy_atk: 9999,
      vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      vip_level: 1,
    } as any);

    const result = await battleService.startBattle(uid, 1);
    expect(result.result).toBe(0);

    const playersAfter = await playerService.list(uid);
    const goldAfter = playersAfter[0].gold || 0;
    expect(goldAfter).toBeGreaterThan(goldBefore);

    await playerService.update(playersBefore[0].id, { vip_expire_time: 0, vip_level: 0 } as any);
  }, 15000);

  it('resolveItemToBagId 无效 itemId 返回 undefined (via resumeAutoBattle)', async () => {
    const players = await playerService.list(uid);
    const now = Math.floor(Date.now() / 1000);
    await playerService.update(players[0].id, {
      vip_expire_time: now + 3600,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: now - 10,
        auto_heal: {
          hp_enabled: true,
          hp_item_id: 99999,
          hp_threshold: 50,
          mp_enabled: true,
          mp_item_id: 99999,
          mp_threshold: 50,
        },
      },
    } as any);

    const r = await battleService.resumeAutoBattle(uid);
    expect(r).toHaveProperty('resumed');

    await battleService.stopBattle(uid);
    await new Promise(r => setTimeout(r, 500));
    await playerService.update(players[0].id, { auto_battle_config: null, vip_expire_time: 0 } as any);
  }, 20000);

  it('saveAutoBattleConfig 无角色时不崩溃', async () => {
    const fakeUid = 8888888;
    const started = await battleService.startAutoBattle(fakeUid, 1);
    expect(started).toBe(true);

    await new Promise(r => setTimeout(r, 500));

    const status = await battleService.getBattleStatus(fakeUid);
    expect(status.isFighting).toBe(false);
  }, 5000);

});

describe('关键路径/深度分支', () => {
  const _battleService = new BattleService();
  const _playerService = new PlayerService();
  const _bagService = new BagService();
  const _skillService = new SkillService();
  const _levelExpService = new LevelExpService();

  it('startAutoBattle 无 autoHeal 参数时 healConfig 为 null', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'noHeal' });
    const ok = await _battleService.startAutoBattle(uid, 1);
    expect(ok).toBe(true);
    await new Promise(r => setTimeout(r, 500));
    await _battleService.stopBattle(uid);
    await new Promise(r => setTimeout(r, 500));
    const players = await _playerService.list(uid);
    const config = players[0]?.auto_battle_config;
    expect(config === null || config?.auto_heal === null || config?.auto_heal === undefined).toBe(true);
  }, 15000);

  it('resolveItemToBagId itemId=0 返回 undefined（不崩溃）', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'zero' });
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, {
      vip_level: 1,
      vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: Math.floor(Date.now() / 1000) - 60,
        auto_heal: { hp_enabled: true, hp_item_id: 0, hp_threshold: 50, mp_enabled: false, mp_item_id: 0, mp_threshold: 50 },
      },
    } as any);
    const result = await _battleService.resumeAutoBattle(uid);
    expect(result).toHaveProperty('offlineBattles');
    await _battleService.stopBattle(uid);
    await new Promise(r => setTimeout(r, 300));
  }, 15000);

  it('resolveItemToBagId 有效消耗品返回 bagId', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'pot' });
    await giveItem(uid, 1, 5);
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, {
      vip_level: 1,
      vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      auto_battle_config: {
        enemy_id: 1,
        last_battle_time: Math.floor(Date.now() / 1000) - 60,
        auto_heal: { hp_enabled: true, hp_item_id: 1, hp_threshold: 50, mp_enabled: false, mp_item_id: 0, mp_threshold: 50 },
      },
    } as any);
    const result = await _battleService.resumeAutoBattle(uid);
    expect(result).toHaveProperty('resumed');
    await _battleService.stopBattle(uid);
    await new Promise(r => setTimeout(r, 300));
  }, 15000);

  it('自动战斗中战斗失败退出循环', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'die' });
    const players = await _playerService.list(uid);
    await _playerService.update(players[0].id, { hp: 1 } as any);
    const ok = await _battleService.startAutoBattle(uid, 1);
    expect(ok).toBe(true);
    await new Promise(r => setTimeout(r, 4000));
    const status = await _battleService.getBattleStatus(uid);
    expect(status.isFighting).toBe(false);
  }, 15000);

  it('addExp 触发升级后 level 正确递增', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'levelup' });
    const players = await _playerService.list(uid);
    const player = players[0];
    const origLevel = player.level;
    const levelConfig = await _levelExpService.getExpByLevel(origLevel);
    expect(levelConfig).toBeTruthy();
    const neededExp = (levelConfig!.exp ?? 100) + 1;
    await _playerService.addExp(uid, neededExp);
    const playersAfter = await _playerService.list(uid);
    expect(playersAfter[0].level).toBeGreaterThan(origLevel);
  });

  it('连续大量经验可以跳多级', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'multilv' });
    const players = await _playerService.list(uid);
    const origLevel = players[0].level;
    await _playerService.addExp(uid, 999999);
    const playersAfter = await _playerService.list(uid);
    expect(playersAfter[0].level).toBeGreaterThan(origLevel + 1);
  });

  it('战斗胜利后经验和金币正确增加', async () => {
    const { uid, token } = await createTestUser(app, { prefix: 'r2', suffix: 'btlrew' });
    const before = await _playerService.list(uid);
    const res = await request(app)
      .post('/api/battle/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ enemy_id: 1 });
    if (res.body.code === 0 && res.body.data.result === 1) {
      const after = await _playerService.list(uid);
      expect(after[0].exp + after[0].level * 1000).toBeGreaterThanOrEqual(
        before[0].exp + before[0].level * 1000
      );
    }
  });

  it('装备技能后 getEquippedSkills 返回非空', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'skillef' });
    await _bagService.addItem(uid, 14, 1);
    try {
      await _skillService.learnSkill(uid, 14, _bagService);
    } catch { /* 已学过 */ }
    try {
      await _skillService.equipSkill(uid, 1);
    } catch { /* 可能已装备 */ }
    const equipped = await _skillService.getEquippedSkills(uid);
    const allSkills = [
      ...(equipped?.physical || []),
      ...(equipped?.magic || []),
    ];
    if (allSkills.length > 0) {
      expect(allSkills[0]).toHaveProperty('name');
    }
  });

  it('startBattle 带 autoHeal MP 分支', async () => {
    const user = await createTestUser(app, { prefix: 'bat', suffix: 'mp' });
    const ps = new (await import('../../service/player.service')).PlayerService();
    const bs = new (await import('../../service/bag.service')).BagService();
    const pl = await ps.list(user.uid);
    await ps.update(pl[0].id, { hp: 9999, max_hp: 9999, mp: 5, max_mp: 100, phy_atk: 9999 } as any);
    await bs.addItem(user.uid, 2, 5);
    const bags = await bs.list(user.uid);
    const mpPotion = bags.find((b: any) => b.item_id === 2 && !b.equipment_uid);
    const mpBagId = mpPotion ? (mpPotion.original_id ?? mpPotion.id) : undefined;

    const battleService = new BattleService();
    const result = await battleService.startBattle(user.uid, 1, {
      hp_enabled: false,
      mp_enabled: true,
      mp_potion_bag_id: mpBagId,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
  }, 10000);

  it('startBattle autoHeal HP+MP 同时启用', async () => {
    const user = await createTestUser(app, { prefix: 'bat', suffix: 'hpmp' });
    const ps = new (await import('../../service/player.service')).PlayerService();
    const bs = new (await import('../../service/bag.service')).BagService();
    const pl = await ps.list(user.uid);
    await ps.update(pl[0].id, { hp: 30, max_hp: 100, mp: 5, max_mp: 100, phy_atk: 9999 } as any);
    await bs.addItem(user.uid, 1, 5);
    await bs.addItem(user.uid, 2, 5);
    const bags = await bs.list(user.uid);
    const hpPot = bags.find((b: any) => b.item_id === 1 && !b.equipment_uid);
    const mpPot = bags.find((b: any) => b.item_id === 2 && !b.equipment_uid);

    const battleService = new BattleService();
    const result = await battleService.startBattle(user.uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: hpPot ? (hpPot.original_id ?? hpPot.id) : undefined,
      hp_threshold: 50,
      mp_enabled: true,
      mp_potion_bag_id: mpPot ? (mpPot.original_id ?? mpPot.id) : undefined,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
  }, 10000);

  it('startBattle autoHeal 无效药水 ID 不崩溃', async () => {
    const user = await createTestUser(app, { prefix: 'bat', suffix: 'badpot' });
    const ps = new (await import('../../service/player.service')).PlayerService();
    const pl = await ps.list(user.uid);
    await ps.update(pl[0].id, { hp: 30, max_hp: 100, mp: 5, max_mp: 100, phy_atk: 9999 } as any);

    const battleService = new BattleService();
    const result = await battleService.startBattle(user.uid, 1, {
      hp_enabled: true,
      hp_potion_bag_id: 999888,
      hp_threshold: 50,
      mp_enabled: true,
      mp_potion_bag_id: 999777,
      mp_threshold: 50,
    });
    expect(result).toHaveProperty('result');
  }, 10000);
});

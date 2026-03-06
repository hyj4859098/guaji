/**
 * MonsterService 集成测试 - get、list、listByLevel、listByMapId、cache 分支
 */
import { MonsterService } from '../../service/monster.service';
import { cacheService } from '../../service/cache.service';
import { dataStorageService } from '../../service/data-storage.service';

describe('MonsterService 集成测试', () => {
  const monsterService = new MonsterService();

  it('get 缓存未命中时从 DB 加载', async () => {
    cacheService.monster.invalidate(1);
    const monster = await monsterService.get(1);
    expect(monster).not.toBeNull();
    expect((monster as any)).toHaveProperty('drops');
  });

  it('get 存在的怪物返回详情含 drops', async () => {
    const monster = await monsterService.get(1);
    expect(monster).not.toBeNull();
    expect((monster as any)).toHaveProperty('drops');
    expect(Array.isArray((monster as any).drops)).toBe(true);
  });

  it('get 不存在的怪物返回 null', async () => {
    const monster = await monsterService.get(99999);
    expect(monster).toBeNull();
  });

  it('list 返回全部怪物', async () => {
    const list = await monsterService.list();
    expect(Array.isArray(list)).toBe(true);
  });

  it('listByLevel 按等级筛选', async () => {
    const list = await monsterService.listByLevel(1, 10);
    expect(Array.isArray(list)).toBe(true);
  });

  it('listByMapId 按地图筛选', async () => {
    const list = await monsterService.listByMapId(1);
    expect(Array.isArray(list)).toBe(true);
  });

  it('get 缓存命中时直接返回', async () => {
    const m1 = await monsterService.get(1);
    expect(m1).not.toBeNull();
    const m2 = await monsterService.get(1);
    expect(m2).toEqual(m1);
  });

  it('update 成功后清除缓存', async () => {
    cacheService.monster.invalidate(1);
    const before = await monsterService.get(1);
    if (before) {
      await monsterService.update(1, { name: (before as any).name });
      const after = await monsterService.get(1);
      expect(after).not.toBeNull();
    }
  });

  it('delete 成功后清除缓存', async () => {
    const id = await monsterService.add({
      name: '测试怪', level: 1, hp: 10, mp: 0, phy_atk: 1, mag_atk: 0, phy_def: 0, mag_def: 0,
      hit_rate: 80, dodge_rate: 5, crit_rate: 5, exp: 1, gold: 1, reputation: 0, map_id: 1,
      skill1: '', skill2: '',
    } as any);
    await monsterService.get(id);
    await monsterService.delete(id);
    const got = await monsterService.get(id);
    expect(got).toBeNull();
  });

  it('get 掉落物品名不存在时使用 fallback', async () => {
    // 使用高 ID 避免与其他测试或 init 数据冲突
    const TEMP_ITEM_ID = 999990002;
    await dataStorageService.insert('item', {
      id: TEMP_ITEM_ID,
      name: '_monster_test_temp_',
      type: 1,
      description: '临时物品，用于测试 fallback',
    });
    const monsterId = await monsterService.add({
      name: '_fallback怪_', level: 1, hp: 10, mp: 0, phy_atk: 1, mag_atk: 0, phy_def: 0, mag_def: 0,
      hit_rate: 80, dodge_rate: 5, crit_rate: 5, exp: 1, gold: 1, reputation: 0, map_id: 1,
      skill1: '', skill2: '',
    } as any);
    const dropId = await dataStorageService.insert('monster_drop', {
      monster_id: monsterId,
      item_id: TEMP_ITEM_ID,
      quantity: undefined,
      probability: undefined,
    });
    await dataStorageService.delete('item', TEMP_ITEM_ID);
    cacheService.monster.invalidate(monsterId);
    const monster = await monsterService.get(monsterId);
    expect(monster).not.toBeNull();
    expect((monster as any).drops?.length).toBeGreaterThan(0);
    const drop = (monster as any).drops?.find((d: any) => d.item_id === TEMP_ITEM_ID);
    expect(drop?.item_name).toBe(`物品${TEMP_ITEM_ID}`);
    expect(drop?.quantity).toBe(1);
    expect(drop?.probability).toBe(0);
    await dataStorageService.delete('monster_drop', dropId);
    await monsterService.delete(monsterId);
  });
});

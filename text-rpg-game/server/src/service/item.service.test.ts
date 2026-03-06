/**
 * ItemService 单元测试 - 纯逻辑，无 mock
 */
import { ItemService, ItemType } from './item.service';

describe('ItemService', () => {
  const service = new ItemService();

  describe('calculateItemAttributes', () => {
    it('消耗品(type=1)返回 hp_restore/mp_restore', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.CONSUMABLE,
        hp_restore: 50,
        mp_restore: 0,
      });
      expect(attrs.hp).toBe(50);
      expect(attrs.mp).toBe(0);
    });

    it('消耗品同时恢复 HP 和 MP', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.CONSUMABLE,
        hp_restore: 30,
        mp_restore: 20,
      });
      expect(attrs.hp).toBe(30);
      expect(attrs.mp).toBe(20);
    });

    it('消耗品兼容 hp/mp 字段', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.CONSUMABLE,
        hp: 100,
        mp: 50,
      });
      expect(attrs.hp).toBe(100);
      expect(attrs.mp).toBe(50);
    });

    it('装备(type=2)返回 attack/defense/hit_rate 等', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.EQUIP,
        attack: 50,
        defense: 20,
        hit_rate: 90,
        dodge_rate: 5,
        crit_rate: 10,
      });
      expect(attrs.attack).toBe(50);
      expect(attrs.defense).toBe(20);
      expect(attrs.hitRate).toBe(90);
      expect(attrs.dodgeRate).toBe(5);
      expect(attrs.critRate).toBe(10);
    });

    it('装备缺省时返回 0', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.EQUIP,
      });
      expect(attrs.attack).toBe(0);
      expect(attrs.defense).toBe(0);
      expect(attrs.hitRate).toBe(0);
    });

    it('材料(type=3)返回空属性', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.MATERIAL,
      });
      expect(attrs).toEqual({});
    });

    it('道具(type=4)返回空属性', async () => {
      const attrs = await service.calculateItemAttributes({
        type: ItemType.TOOL,
      });
      expect(attrs).toEqual({});
    });

    it('未知类型返回空属性', async () => {
      const attrs = await service.calculateItemAttributes({
        type: 99,
      });
      expect(attrs).toEqual({});
    });
  });
});

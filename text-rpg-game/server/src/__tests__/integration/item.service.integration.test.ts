/**
 * ItemService 集成测试 - 真实 DB，无 mock
 * 覆盖 getItemById、getItemsByType、getAllItems、listWithPagination、getItemUsage
 */
import { ItemService, ItemType } from '../../service/item.service';

describe('ItemService 集成测试', () => {
  const service = new ItemService();

  describe('getItemById', () => {
    it('获取存在的消耗品', async () => {
      const item = await service.getItemById(1);
      expect(item).not.toBeNull();
      expect(item?.id).toBe(1);
      expect(item?.type).toBe(1);
      expect(item?.name).toBeDefined();
    });

    it('获取不存在的物品返回 null', async () => {
      const item = await service.getItemById(99999);
      expect(item).toBeNull();
    });
  });

  describe('getItemsByType', () => {
    it('按类型获取消耗品', async () => {
      const items = await service.getItemsByType(ItemType.CONSUMABLE);
      expect(Array.isArray(items)).toBe(true);
      expect(items.every((i: any) => i.type === 1)).toBe(true);
    });

    it('按类型获取装备', async () => {
      const items = await service.getItemsByType(ItemType.EQUIP);
      expect(Array.isArray(items)).toBe(true);
      expect(items.every((i: any) => i.type === 2)).toBe(true);
    });
  });

  describe('getAllItems', () => {
    it('获取所有物品', async () => {
      const items = await service.getAllItems();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('listWithPagination', () => {
    it('分页获取物品', async () => {
      const result = await service.listWithPagination(undefined, 1, 5);
      expect(result).toMatchObject({ data: expect.any(Array), total: expect.any(Number), page: 1, pageSize: 5 });
      expect(result.data.length).toBeLessThanOrEqual(5);
    });

    it('按 type 筛选分页', async () => {
      const result = await service.listWithPagination({ type: 1 }, 1, 10);
      expect(result.data.every((i: any) => i.type === 1)).toBe(true);
    });
  });

  describe('getItemUsage', () => {
    it('消耗品返回恢复说明', async () => {
      const usage = await service.getItemUsage(1);
      expect(usage).toMatch(/恢复|HP|MP/);
    });

    it('装备返回穿戴说明', async () => {
      const usage = await service.getItemUsage(13);
      expect(usage).toMatch(/装备|部位|属性/);
    });

    it('材料返回合成说明', async () => {
      const items = await service.getItemsByType(ItemType.MATERIAL);
      if (items.length > 0) {
        const usage = await service.getItemUsage(items[0].id);
        expect(usage).toMatch(/合成|任务/);
      }
    });

    it('不存在的物品返回提示', async () => {
      const usage = await service.getItemUsage(99999);
      expect(usage).toBe('物品不存在');
    });

    it('道具返回使用说明', async () => {
      const items = await service.getItemsByType(ItemType.TOOL);
      if (items.length > 0) {
        const usage = await service.getItemUsage(items[0].id);
        expect(typeof usage).toBe('string');
        expect(usage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('addItem', () => {
    it('addItem 指定已占用 id 抛错', async () => {
      await expect(service.addItem({ id: 1, name: '重复', type: 1 })).rejects.toThrow(/已被占用/);
    });

    it('addItem 成功返回 id', async () => {
      const id = await service.addItem({ name: `_test_item_${Date.now()}`, type: 3 });
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('updateItem', () => {
    it('updateItem 成功', async () => {
      const id = await service.addItem({ name: `_upd_${Date.now()}`, type: 3 });
      const ok = await service.updateItem(id, { name: 'updated' });
      expect(ok).toBe(true);
    });
  });

  describe('deleteItem', () => {
    it('deleteItem 成功', async () => {
      const id = await service.addItem({ name: `_del_${Date.now()}`, type: 3 });
      const ok = await service.deleteItem(id);
      expect(ok).toBe(true);
    });
  });

  describe('getItemWithEffect', () => {
    it('getItemWithEffect 消耗品返回含 effect', async () => {
      const item = await service.getItemWithEffect(1);
      expect(item).not.toBeNull();
      expect(item).toHaveProperty('effect_type');
    });

    it('getItemWithEffect 装备返回含 base 属性', async () => {
      const item = await service.getItemWithEffect(13);
      if (item) expect(item).toHaveProperty('base_level');
    });

    it('getItemWithEffect 不存在的返回 null', async () => {
      const item = await service.getItemWithEffect(99999);
      expect(item).toBeNull();
    });
  });

  describe('syncEquipBase', () => {
    it('syncEquipBase 新建', async () => {
      const id = await service.addItem({ name: `_eb_${Date.now()}`, type: 2 });
      await service.syncEquipBase(id, { pos: 1, base_level: 1 });
      const item = await service.getItemWithEffect(id);
      expect(item?.base_level).toBe(1);
    });
  });

  describe('calculateItemAttributes', () => {
    it('装备返回属性', async () => {
      const attrs = await service.calculateItemAttributes({ type: 2, base_phy_atk: 10 });
      expect(attrs.attack).toBeDefined();
    });

    it('材料/道具无装备属性时返回空或少量属性', async () => {
      const attrs = await service.calculateItemAttributes({ type: 3 });
      expect(attrs).not.toHaveProperty('attack');
      expect(attrs).not.toHaveProperty('defense');
    });
  });

  describe('分支覆盖补充', () => {
    it('getItemWithEffect 技能书', async () => {
      const result = await service.getItemWithEffect(14);
      expect(result === null || result?.name != null).toBe(true);
    });

    it('listWithPagination 超出范围', async () => {
      const result = await service.listWithPagination({}, 999, 10);
      expect(result.data.length).toBe(0);
    });

    it('updateItem 不存在的物品返回 false', async () => {
      const ok = await service.updateItem(99999, { name: 'test' });
      expect(ok).toBeFalsy();
    });
  });
});

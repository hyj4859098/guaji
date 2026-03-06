import { getItemType, isEquipment } from './item-type';

describe('item-type', () => {
  describe('getItemType', () => {
    it('type 1 返回 consumable', () => {
      expect(getItemType({ type: 1 })).toBe('consumable');
    });
    it('type 2 返回 equipment', () => {
      expect(getItemType({ type: 2 })).toBe('equipment');
    });
    it('type 3 返回 material', () => {
      expect(getItemType({ type: 3 })).toBe('material');
    });
    it('type 4/5/6 返回 tool', () => {
      expect(getItemType({ type: 4 })).toBe('tool');
      expect(getItemType({ type: 5 })).toBe('tool');
      expect(getItemType({ type: 6 })).toBe('tool');
    });
    it('无 type 或 0 返回 tool', () => {
      expect(getItemType({})).toBe('tool');
      expect(getItemType({ type: 0 })).toBe('tool');
    });
    it('null/undefined 返回 tool', () => {
      expect(getItemType(null)).toBe('tool');
      expect(getItemType(undefined)).toBe('tool');
    });
  });

  describe('isEquipment', () => {
    it('type 2 返回 true', () => {
      expect(isEquipment({ type: 2 })).toBe(true);
    });
    it('有 equipment_uid 返回 true', () => {
      expect(isEquipment({ equipment_uid: '123' })).toBe(true);
      expect(isEquipment({ equipment_uid: 456 })).toBe(true);
    });
    it('type 非 2 且无 equipment_uid 返回 false', () => {
      expect(isEquipment({ type: 1 })).toBe(false);
      expect(isEquipment({ type: 3 })).toBe(false);
    });
    it('null/undefined 返回 false', () => {
      expect(isEquipment(null)).toBe(false);
      expect(isEquipment(undefined)).toBe(false);
    });
  });
});

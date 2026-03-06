import {
  calculateRandomAttr,
  getEquipMainAttr,
  getEquipTypeName,
  getBaseMainValue,
  MAIN_ATTR_MAP,
  WEAPON_POS,
} from './equip';

describe('equip', () => {
  describe('calculateRandomAttr', () => {
    it('在 baseValue 的 80%~120% 范围内', () => {
      for (let i = 0; i < 50; i++) {
        const v = calculateRandomAttr(100);
        expect(v).toBeGreaterThanOrEqual(80);
        expect(v).toBeLessThanOrEqual(120);
      }
    });

    it('baseValue 为 0 时返回 0', () => {
      expect(calculateRandomAttr(0)).toBe(0);
    });

    it('baseValue 较小时仍有效', () => {
      const v = calculateRandomAttr(5);
      expect(v).toBeGreaterThanOrEqual(4);
      expect(v).toBeLessThanOrEqual(6);
    });
  });

  describe('getEquipMainAttr', () => {
    it('已知部位返回正确主属性', () => {
      expect(getEquipMainAttr(1)).toBe('phy_atk');
      expect(getEquipMainAttr(2)).toBe('phy_def');
      expect(getEquipMainAttr(5)).toBe('dodge_rate');
      expect(getEquipMainAttr(8)).toBe('hp');
    });

    it('未知部位返回 phy_atk 默认值', () => {
      expect(getEquipMainAttr(99)).toBe('phy_atk');
    });
  });

  describe('getEquipTypeName', () => {
    it('已知部位返回正确名称', () => {
      expect(getEquipTypeName(1)).toBe('武器');
      expect(getEquipTypeName(2)).toBe('衣服');
      expect(getEquipTypeName(8)).toBe('坐骑');
    });

    it('未知部位返回 装备', () => {
      expect(getEquipTypeName(99)).toBe('装备');
    });
  });

  describe('getBaseMainValue', () => {
    it('武器(pos=1)返回 main 和 main2', () => {
      const base = { base_phy_atk: 50, base_mag_atk: 30 };
      const r = getBaseMainValue(base, WEAPON_POS);
      expect(r.main).toBe(50);
      expect(r.main2).toBe(30);
    });

    it('非武器部位只返回 main', () => {
      const base = { base_phy_def: 20 };
      const r = getBaseMainValue(base, 2);
      expect(r.main).toBe(20);
      expect(r.main2).toBeUndefined();
    });

    it('无 base_ 前缀时使用 attr 直接值', () => {
      const base = { phy_atk: 10 };
      const r = getBaseMainValue(base, 1);
      expect(r.main).toBe(10);
    });

    it('无值时返回 0', () => {
      const r = getBaseMainValue({}, 2);
      expect(r.main).toBe(0);
    });
  });

  describe('MAIN_ATTR_MAP', () => {
    it('覆盖 1-8 部位', () => {
      expect(MAIN_ATTR_MAP[1]).toBe('phy_atk');
      expect(MAIN_ATTR_MAP[8]).toBe('hp');
    });
  });
});

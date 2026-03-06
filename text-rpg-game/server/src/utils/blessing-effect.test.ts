import {
  calcBlessingEffects,
  extractBlessingAttrs,
  BlessingEffect,
} from './blessing-effect';

describe('blessing-effect', () => {
  describe('calcBlessingEffects', () => {
    it('K<=0 返回空数组', () => {
      expect(calcBlessingEffects(1, 0, 1)).toEqual([]);
      expect(calcBlessingEffects(1, -1, 1)).toEqual([]);
    });

    it('未知部位返回空数组', () => {
      expect(calcBlessingEffects(99, 5, 1)).toEqual([]);
    });

    it('武器(pos=1)返回正确效果', () => {
      const effects = calcBlessingEffects(1, 10, 100);
      expect(effects.length).toBeGreaterThan(0);
      expect(effects[0].target).toBe('phy_skill_prob');
      expect(effects[0].value).toBe(10);
    });

    it('衣服(pos=2)有闪避、物防、法防、生命', () => {
      const effects = calcBlessingEffects(2, 5, 200);
      const targets = effects.map((e) => e.target);
      expect(targets).toContain('dodge_rate');
      expect(targets).toContain('phy_def_pct');
      expect(targets).toContain('max_hp_pct');
    });

    it('equipLevel 为 0 时按 1 计算', () => {
      const effects = calcBlessingEffects(1, 10, 0);
      expect(effects.length).toBeGreaterThan(0);
    });

    it('pos 3-8 返回对应效果', () => {
      expect(calcBlessingEffects(3, 5, 100).length).toBeGreaterThan(0);
      expect(calcBlessingEffects(4, 5, 100).some(e => e.target === 'elem_water')).toBe(true);
      expect(calcBlessingEffects(8, 5, 100).some(e => e.target === 'elem_metal')).toBe(true);
    });

    it('pos 5 鞋子有 elem_earth', () => {
      const effects = calcBlessingEffects(5, 5, 100);
      expect(effects.some(e => e.target === 'elem_earth')).toBe(true);
      expect(effects.some(e => e.target === 'phy_def_pct')).toBe(true);
    });

    it('pos 6 戒指有 elem_wood', () => {
      const effects = calcBlessingEffects(6, 5, 100);
      expect(effects.some(e => e.target === 'elem_wood')).toBe(true);
      expect(effects.some(e => e.target === 'hit_rate')).toBe(true);
    });

    it('pos 7 项链有 max_hp_pct', () => {
      const effects = calcBlessingEffects(7, 5, 100);
      expect(effects.some(e => e.target === 'max_hp_pct')).toBe(true);
    });

    it('default 未知 pos 返回空数组', () => {
      expect(calcBlessingEffects(0, 5, 100)).toEqual([]);
      expect(calcBlessingEffects(100, 5, 100)).toEqual([]);
    });
  });

  describe('extractBlessingAttrs', () => {
    it('空数组返回空对象', () => {
      expect(extractBlessingAttrs([])).toEqual({});
    });

    it('只提取 mode=attr 且 value>0 的效果', () => {
      const effects: BlessingEffect[] = [
        { label: 'a', value: 5, target: 'phy_atk', mode: 'attr', suffix: '' },
        { label: 'b', value: 0, target: 'mag_atk', mode: 'attr', suffix: '' },
        { label: 'c', value: 3, target: 'display_only', mode: 'display', suffix: '' },
      ];
      const attrs = extractBlessingAttrs(effects);
      expect(attrs.phy_atk).toBe(5);
      expect(attrs.mag_atk).toBeUndefined();
      expect(attrs.display_only).toBeUndefined();
    });

    it('同 target 累加', () => {
      const effects: BlessingEffect[] = [
        { label: 'a', value: 5, target: 'hit_rate', mode: 'attr', suffix: '' },
        { label: 'b', value: 3, target: 'hit_rate', mode: 'attr', suffix: '' },
      ];
      const attrs = extractBlessingAttrs(effects);
      expect(attrs.hit_rate).toBe(8);
    });
  });
});

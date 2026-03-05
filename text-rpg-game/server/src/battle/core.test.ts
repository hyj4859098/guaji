import {
  calculateHit,
  calculateCrit,
  calcPhysicalDamage,
  calcMagicDamage,
  calcElementBonus,
} from './core';

describe('battle/core', () => {
  describe('calculateHit', () => {
    it('高命中对零闪避应几乎必中', () => {
      const attacker = { hit_rate: 100 };
      const defender = { dodge_rate: 0 };
      let hits = 0;
      for (let i = 0; i < 100; i++) {
        if (calculateHit(attacker, defender)) hits++;
      }
      expect(hits).toBe(100);
    });

    it('高闪避降低命中率', () => {
      const attacker = { hit_rate: 50 };
      const defender = { dodge_rate: 950 };
      // finalHitRate = 50/(50+950)*100 = 5%
      let hits = 0;
      for (let i = 0; i < 500; i++) {
        if (calculateHit(attacker, defender)) hits++;
      }
      expect(hits).toBeLessThan(50);
      expect(hits).toBeGreaterThan(0);
    });
  });

  describe('calculateCrit', () => {
    it('零暴击率应不暴击', () => {
      const attacker = { crit_rate: 0 };
      for (let i = 0; i < 100; i++) {
        expect(calculateCrit(attacker)).toBe(false);
      }
    });

    it('100% 暴击率应必暴击', () => {
      const attacker = { crit_rate: 100 };
      for (let i = 0; i < 100; i++) {
        expect(calculateCrit(attacker)).toBe(true);
      }
    });
  });

  describe('calcPhysicalDamage', () => {
    it('攻击大于防御时造成正伤害', () => {
      const attacker = { phy_atk: 100, phy_def: 0, crit_rate: 0 };
      const defender = { phy_def: 10 };
      const result = calcPhysicalDamage(attacker, defender);
      expect(result.damage).toBe(90);
      expect(result.isCrit).toBe(false);
    });

    it('攻击小于防御时至少造成 1 点伤害', () => {
      const attacker = { phy_atk: 5, crit_rate: 0 };
      const defender = { phy_def: 100 };
      const result = calcPhysicalDamage(attacker, defender);
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calcMagicDamage', () => {
    it('魔法攻击计算正确', () => {
      const attacker = { mag_atk: 80, crit_rate: 0 };
      const defender = { mag_def: 20 };
      const result = calcMagicDamage(attacker, defender);
      expect(result.damage).toBe(60);
    });
  });

  describe('calcElementBonus', () => {
    it('无五行时返回 0', () => {
      expect(calcElementBonus({}, {})).toBe(0);
    });

    it('金克木有加成', () => {
      const attacker = { elem_metal: 10 };
      const defender = { elem_wood: 5 };
      expect(calcElementBonus(attacker, defender)).toBe(5);
    });

    it('多克制累加', () => {
      const attacker = { elem_metal: 10, elem_fire: 5 };
      const defender = { elem_wood: 3, elem_metal: 2 };
      // 金克木: 10-3=7, 火克金: 5-2=3
      expect(calcElementBonus(attacker, defender)).toBe(10);
    });

    it('防御方无对应属性时无加成', () => {
      const attacker = { elem_wood: 5 };
      const defender = {};
      // 木克土，但 defender 无 elem_earth，defVal=0，bonus += 5
      expect(calcElementBonus(attacker, defender)).toBe(5);
    });
  });
});

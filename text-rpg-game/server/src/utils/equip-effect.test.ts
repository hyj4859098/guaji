/**
 * equip-effect 纯逻辑测试 - 无 mock
 * buildEquipAttrMap 为纯函数，无外部依赖
 */
import { buildEquipAttrMap } from './equip-effect';

describe('equip-effect', () => {
  describe('buildEquipAttrMap', () => {
    it('空对象返回全 0', () => {
      const map = buildEquipAttrMap({});
      expect(map.hp).toBe(0);
      expect(map.phy_atk).toBe(0);
      expect(map.phy_def).toBe(0);
      expect(map.mp).toBe(0);
      expect(map.mag_atk).toBe(0);
      expect(map.mag_def).toBe(0);
      expect(map.hit_rate).toBe(0);
      expect(map.dodge_rate).toBe(0);
      expect(map.crit_rate).toBe(0);
    });

    it('使用 equip_attributes 优先', () => {
      const equip = {
        id: 1,
        item_id: 13,
        equip_attributes: { phy_atk: 50, phy_def: 20 },
      };
      const map = buildEquipAttrMap(equip);
      expect(map.phy_atk).toBe(50);
      expect(map.phy_def).toBe(20);
      expect(map.hp).toBe(0);
    });

    it('无 equip_attributes 时使用 equip 自身', () => {
      const equip = { phy_atk: 100, mag_atk: 30, hp: 500 };
      const map = buildEquipAttrMap(equip);
      expect(map.phy_atk).toBe(100);
      expect(map.mag_atk).toBe(30);
      expect(map.hp).toBe(500);
    });

    it('覆盖全部属性字段', () => {
      const attrs = {
        hp: 100,
        phy_atk: 10,
        phy_def: 5,
        mp: 50,
        mag_def: 3,
        mag_atk: 8,
        hit_rate: 1,
        dodge_rate: 2,
        crit_rate: 3,
        phy_skill_prob: 4,
        mag_skill_prob: 5,
        skill_dmg_pct: 6,
        phy_def_pct: 7,
        mag_def_pct: 8,
        max_hp_pct: 9,
        elem_metal: 10,
        elem_wood: 11,
        elem_water: 12,
        elem_fire: 13,
        elem_earth: 14,
      };
      const map = buildEquipAttrMap({ equip_attributes: attrs });
      expect(map).toEqual(attrs);
    });

    it('undefined/null 转为 0', () => {
      const map = buildEquipAttrMap({ equip_attributes: { phy_atk: undefined, phy_def: null } });
      expect(map.phy_atk).toBe(0);
      expect(map.phy_def).toBe(0);
    });
  });
});

import { applyBattleBonuses } from './combat-bonus';

describe('applyBattleBonuses', () => {
  it('无百分比加成时返回原值', () => {
    const p = { hp: 100, max_hp: 100, phy_def: 10, mag_def: 5 };
    const r = applyBattleBonuses(p);
    expect(r.hp).toBe(100);
    expect(r.phy_def).toBe(10);
    expect(r.mag_def).toBe(5);
  });

  it('不修改原对象', () => {
    const p = { hp: 100, max_hp: 100, phy_def: 10, mag_def: 5, phy_def_pct: 20 };
    applyBattleBonuses(p);
    expect(p.phy_def).toBe(10);
  });

  it('phy_def_pct 加成', () => {
    const r = applyBattleBonuses({ hp: 100, max_hp: 100, phy_def: 100, phy_def_pct: 20 });
    expect(r.phy_def).toBe(120);
  });

  it('mag_def_pct 加成', () => {
    const r = applyBattleBonuses({ hp: 100, max_hp: 100, mag_def: 50, mag_def_pct: 10 });
    expect(r.mag_def).toBe(55);
  });

  it('max_hp_pct 加成 hp 和 max_hp', () => {
    const r = applyBattleBonuses({ hp: 80, max_hp: 100, max_hp_pct: 20 });
    expect(r.max_hp).toBe(120);
    expect(r.hp).toBe(100);
  });

  it('三种加成同时生效', () => {
    const r = applyBattleBonuses({
      hp: 100, max_hp: 100, phy_def: 10, mag_def: 10,
      phy_def_pct: 50, mag_def_pct: 100, max_hp_pct: 10,
    });
    expect(r.phy_def).toBe(15);
    expect(r.mag_def).toBe(20);
    expect(r.max_hp).toBe(110);
    expect(r.hp).toBe(110);
  });
});

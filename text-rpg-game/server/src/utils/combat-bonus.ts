/**
 * 战斗属性预处理：百分比加成（祝福等效果产生的 phy_def_pct、mag_def_pct、max_hp_pct）
 * 在线战斗、Boss 战斗、离线挂机共用，避免重复实现。
 */
export function applyBattleBonuses(player: any): any {
  const p = { ...player };
  const phyDefPct = p.phy_def_pct || 0;
  const magDefPct = p.mag_def_pct || 0;
  const maxHpPct = p.max_hp_pct || 0;
  if (phyDefPct) p.phy_def = Math.floor((p.phy_def || 0) * (1 + phyDefPct / 100));
  if (magDefPct) p.mag_def = Math.floor((p.mag_def || 0) * (1 + magDefPct / 100));
  if (maxHpPct) {
    const bonus = Math.floor((p.max_hp || p.hp) * maxHpPct / 100);
    p.hp += bonus;
    p.max_hp = (p.max_hp || p.hp) + bonus;
  }
  return p;
}

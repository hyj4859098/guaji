/**
 * 战斗核心：纯函数，负责命中判定、暴击判定和伤害计算
 * 在线战斗、离线战斗共用，后续加新属性/buff 只需改此处
 */

const CRIT_DAMAGE_MULTIPLIER = 1.5;

export function calculateHit(attacker: any, defender: any): boolean {
  const hitValue = attacker.hit_rate || 80;
  const dodgeValue = defender.dodge_rate || 0;
  const finalHitRate = hitValue / (hitValue + dodgeValue) * 100;
  return Math.random() * 100 < finalHitRate;
}

export function calculateCrit(attacker: any): boolean {
  const critRate = attacker.crit_rate || 0;
  if (critRate <= 0) return false;
  return Math.random() * 100 < critRate;
}

export function calcPhysicalDamage(attacker: any, defender: any): { damage: number; isCrit: boolean } {
  const base = Math.max(1, (attacker.phy_atk || 0) - (defender.phy_def || 0));
  const isCrit = calculateCrit(attacker);
  const critDamage = Math.max(base + 1, Math.floor(base * CRIT_DAMAGE_MULTIPLIER));
  return { damage: isCrit ? critDamage : base, isCrit };
}

export function calcMagicDamage(attacker: any, defender: any): { damage: number; isCrit: boolean } {
  const base = Math.max(1, (attacker.mag_atk || 0) - (defender.mag_def || 0));
  const isCrit = calculateCrit(attacker);
  const critDamage = Math.max(base + 1, Math.floor(base * CRIT_DAMAGE_MULTIPLIER));
  return { damage: isCrit ? critDamage : base, isCrit };
}

/**
 * 五行克制伤害加成：金克木、木克土、土克水、水克火、火克金
 * 返回百分比加成值（如 20 表示 +20%）
 */
const ELEMENT_CYCLE: [string, string][] = [
  ['elem_metal', 'elem_wood'],
  ['elem_wood', 'elem_earth'],
  ['elem_earth', 'elem_water'],
  ['elem_water', 'elem_fire'],
  ['elem_fire', 'elem_metal'],
];

export function calcElementBonus(attacker: any, defender: any): number {
  let bonus = 0;
  for (const [atkElem, defElem] of ELEMENT_CYCLE) {
    const atkVal = attacker[atkElem] || 0;
    const defVal = defender[defElem] || 0;
    if (atkVal > defVal) {
      bonus += atkVal - defVal;
    }
  }
  return bonus;
}

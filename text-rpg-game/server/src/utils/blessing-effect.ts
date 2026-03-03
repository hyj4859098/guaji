/**
 * 祝福效果计算
 * 根据装备部位(pos)、祝福等级(K)、装备等级(equipLevel) 计算祝福加成
 *
 * 所有效果通过 buildEquipAttrs → equip-effect 写入 player，战斗直接读 player 字段
 */

export interface BlessingEffect {
  label: string;
  value: number;
  /** 影响的 player 属性键 */
  target: string;
  /** 'attr' 写入 player 属性, 'display' 仅悬浮窗展示 */
  mode: 'attr' | 'display';
  /** 值的显示后缀：'%' 表示百分比, '' 表示扁平值 */
  suffix: string;
}

export function calcBlessingEffects(pos: number, K: number, equipLevel: number): BlessingEffect[] {
  if (K <= 0) return [];
  const lv = equipLevel || 1;

  switch (pos) {
    case 1: // 武器
      return [
        { label: '物理技能释放机率', value: K, target: 'phy_skill_prob', mode: 'attr', suffix: '%' },
        { label: '魔法技能释放机率', value: K, target: 'mag_skill_prob', mode: 'attr', suffix: '%' },
        { label: '命中', value: Math.floor((lv / 200) * K), target: 'hit_rate', mode: 'attr', suffix: '' },
        { label: '全技能伤害', value: round2((lv / 100) * K), target: 'skill_dmg_pct', mode: 'attr', suffix: '%' },
      ];
    case 2: // 衣服
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '物理防御', value: round2((lv / 300) * K), target: 'phy_def_pct', mode: 'attr', suffix: '%' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '生命上限', value: round2((lv / 200) * K), target: 'max_hp_pct', mode: 'attr', suffix: '%' },
      ];
    case 3: // 腰带
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '物理防御', value: round2((lv / 300) * K), target: 'phy_def_pct', mode: 'attr', suffix: '%' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '火属性', value: round2((lv / 200) * K), target: 'elem_fire', mode: 'attr', suffix: '' },
      ];
    case 4: // 裤子
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '水属性', value: round2((lv / 400) * K), target: 'elem_water', mode: 'attr', suffix: '' },
      ];
    case 5: // 鞋子
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '物理防御', value: round2((lv / 300) * K), target: 'phy_def_pct', mode: 'attr', suffix: '%' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '土属性', value: round2((lv / 200) * K), target: 'elem_earth', mode: 'attr', suffix: '' },
      ];
    case 6: // 戒指
      return [
        { label: '命中', value: Math.floor((lv / 200) * K), target: 'hit_rate', mode: 'attr', suffix: '' },
        { label: '物理防御', value: round2((lv / 300) * K), target: 'phy_def_pct', mode: 'attr', suffix: '%' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '木属性', value: round2((lv / 400) * K), target: 'elem_wood', mode: 'attr', suffix: '' },
      ];
    case 7: // 项链
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '物理防御', value: round2((lv / 300) * K), target: 'phy_def_pct', mode: 'attr', suffix: '%' },
        { label: '魔法防御', value: round2((lv / 300) * K), target: 'mag_def_pct', mode: 'attr', suffix: '%' },
        { label: '生命上限', value: round2((lv / 200) * K), target: 'max_hp_pct', mode: 'attr', suffix: '%' },
      ];
    case 8: // 坐骑
      return [
        { label: '闪避', value: Math.floor((lv / 200) * K), target: 'dodge_rate', mode: 'attr', suffix: '' },
        { label: '生命上限', value: round2((lv / 200) * K), target: 'max_hp_pct', mode: 'attr', suffix: '%' },
        { label: '金属性', value: round2((lv / 400) * K), target: 'elem_metal', mode: 'attr', suffix: '' },
      ];
    default:
      return [];
  }
}

/** 从祝福效果中提取要写入 player 的属性（排除 display 类型） */
export function extractBlessingAttrs(effects: BlessingEffect[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of effects) {
    if (e.mode === 'attr' && e.target && e.value > 0) {
      result[e.target] = (result[e.target] || 0) + e.value;
    }
  }
  return result;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

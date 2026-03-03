/**
 * 装备工具：主属性映射、掉落浮动
 * 主属性按部位：坐骑hp、武器phy_atk+mag_atk、衣服/裤子phy_def、腰带mag_def、鞋子dodge_rate、戒指hit_rate、项链phy_atk
 */
export function calculateRandomAttr(baseValue: number): number {
  const min = Math.floor(baseValue * 0.8);
  const max = Math.ceil(baseValue * 1.2);
  return Math.max(0, Math.floor(Math.random() * (max - min + 1)) + min);
}

/** 部位 -> 主属性（单主属性部位） */
export const MAIN_ATTR_MAP: Record<number, string> = {
  1: 'phy_atk',   // 武器主属性1
  2: 'phy_def',   // 衣服
  3: 'mag_def',   // 腰带
  4: 'phy_def',   // 裤子
  5: 'dodge_rate',// 鞋子
  6: 'hit_rate',  // 戒指
  7: 'phy_atk',   // 项链
  8: 'hp',        // 坐骑
};

/** 武器(pos=1)有双主属性：phy_atk + mag_atk */
export const WEAPON_POS = 1;

export function getEquipMainAttr(pos: number): string {
  return MAIN_ATTR_MAP[pos] || 'phy_atk';
}

export function getEquipTypeName(pos: number): string {
  const nameMap: Record<number, string> = {
    1: '武器',
    2: '衣服',
    3: '腰带',
    4: '裤子',
    5: '鞋子',
    6: '戒指',
    7: '项链',
    8: '坐骑',
  };
  return nameMap[pos] || '装备';
}

/** 从 equip_base 获取主属性基础值 */
export function getBaseMainValue(equipBase: any, pos: number): { main: number; main2?: number } {
  const attr = getEquipMainAttr(pos);
  let main = (equipBase as any)[`base_${attr}`] ?? (equipBase as any)[attr] ?? 0;
  let main2: number | undefined;
  if (pos === WEAPON_POS) {
    main2 = (equipBase as any).base_mag_atk ?? equipBase.base_mag_atk ?? 0;
  }
  return { main, main2 };
}

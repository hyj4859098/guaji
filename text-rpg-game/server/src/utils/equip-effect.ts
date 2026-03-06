import { Uid } from '../types';
import { logger } from './logger';

export interface AttrMap {
  [key: string]: number;
}

/**
 * 构建装备属性映射（纯函数，无外部依赖）
 * 支持 equip_attributes（背包/装备实例）或直接属性（旧 equip 表）
 */
export function buildEquipAttrMap(equip: any): AttrMap {
  const attrs = equip.equip_attributes || equip;
  return {
    hp: attrs.hp || 0,
    phy_atk: attrs.phy_atk || 0,
    phy_def: attrs.phy_def || 0,
    mp: attrs.mp || 0,
    mag_def: attrs.mag_def || 0,
    mag_atk: attrs.mag_atk || 0,
    hit_rate: attrs.hit_rate || 0,
    dodge_rate: attrs.dodge_rate || 0,
    crit_rate: attrs.crit_rate || 0,
    phy_skill_prob: attrs.phy_skill_prob || 0,
    mag_skill_prob: attrs.mag_skill_prob || 0,
    skill_dmg_pct: attrs.skill_dmg_pct || 0,
    phy_def_pct: attrs.phy_def_pct || 0,
    mag_def_pct: attrs.mag_def_pct || 0,
    max_hp_pct: attrs.max_hp_pct || 0,
    elem_metal: attrs.elem_metal || 0,
    elem_wood: attrs.elem_wood || 0,
    elem_water: attrs.elem_water || 0,
    elem_fire: attrs.elem_fire || 0,
    elem_earth: attrs.elem_earth || 0,
  };
}

export class EquipEffectUtil {
  /**
   * 应用装备效果到玩家属性
   */
  static async applyEquipEffect(uid: Uid, equip: any): Promise<void> {
    const attrMap = buildEquipAttrMap(equip);

    logger.info('开始应用装备效果', { uid, equipId: equip.id, itemId: equip.item_id, attributes: attrMap });

    const { services } = await import('../service/registry');
    const playerService = services.player;
    const players = await playerService.list(uid);
    if (players.length === 0) {
      logger.warn('玩家不存在', { uid });
      return;
    }
    let player = players[0];

    const updateData: any = {};
    for (const [attr, value] of Object.entries(attrMap)) {
      if (value && value > 0) {
        if (attr === 'hp') {
          updateData.max_hp = (player.max_hp || 0) + value;
          updateData.hp = (player.hp || 0) + value;
        } else if (attr === 'mp') {
          updateData.max_mp = (player.max_mp || 0) + value;
          updateData.mp = (player.mp || 0) + value;
        } else {
          updateData[attr] = ((player as any)[attr] || 0) + value;
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await playerService.update(player.id, updateData);
    }
  }

  static async removeEquipEffect(uid: Uid, equip: any): Promise<void> {
    const attrMap = buildEquipAttrMap(equip);

    const { services } = await import('../service/registry');
    const playerService = services.player;
    const players = await playerService.list(uid);
    if (players.length === 0) {
      logger.warn('玩家不存在', { uid });
      return;
    }
    const player = players[0];

    const updateData: any = {};
    for (const [attr, value] of Object.entries(attrMap)) {
      if (value && value > 0) {
        if (attr === 'hp') {
          const newMaxHp = Math.max(0, (player.max_hp || 0) - value);
          updateData.max_hp = newMaxHp;
          if ((player.hp || 0) > newMaxHp) updateData.hp = newMaxHp;
        } else if (attr === 'mp') {
          const newMaxMp = Math.max(0, (player.max_mp || 0) - value);
          updateData.max_mp = newMaxMp;
          if ((player.mp || 0) > newMaxMp) updateData.mp = newMaxMp;
        } else {
          updateData[attr] = Math.max(0, ((player as any)[attr] || 0) - value);
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await playerService.update(player.id, updateData);
    }
  }
}
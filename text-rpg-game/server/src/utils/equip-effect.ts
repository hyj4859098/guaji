import { Uid } from '../types';
import { logger } from './logger';
import { TransactionContext } from './transaction';

interface AttrMap {
  [key: string]: number;
}

export class EquipEffectUtil {
  /**
   * 应用装备效果到玩家属性
   */
  static async applyEquipEffect(uid: Uid, equip: any, ctx?: TransactionContext): Promise<void> {
    const attrMap = this.buildAttrMap(equip);

    logger.info('开始应用装备效果', { uid, equipId: equip.id, itemId: equip.item_id, attributes: attrMap });

    // 从数据库获取玩家信息
    const PlayerService = require('../service/player.service').PlayerService;
    const playerService = new PlayerService();
    const players = await playerService.list(uid, ctx);
    if (players.length === 0) {
      logger.warn('玩家不存在', { uid });
      return;
    }
    let player = players[0];
    logger.info('从数据库获取玩家信息', { uid, player });

    // 记录应用前的属性
    const _beforeAttrs = { ...player };

    // 准备更新的属性
    const updateData: any = {};
    for (const [attr, value] of Object.entries(attrMap)) {
      if (value && value > 0) {
        if (attr === 'hp') {
          // 对于hp属性，同时增加max_hp和hp
          const oldMaxHp = player.max_hp || 0;
          const newMaxHp = oldMaxHp + value;
          updateData.max_hp = newMaxHp;
          
          const oldHp = player.hp || 0;
          const newHp = oldHp + value;
          updateData.hp = newHp;
          
          logger.info('应用装备效果', { attr: 'max_hp', oldValue: oldMaxHp, newValue: newMaxHp, value, uid, itemId: equip.item_id });
          logger.info('应用装备效果', { attr: 'hp', oldValue: oldHp, newValue: newHp, value, uid, itemId: equip.item_id });
        } else if (attr === 'mp') {
          // 对于mp属性，同时增加max_mp和mp
          const oldMaxMp = player.max_mp || 0;
          const newMaxMp = oldMaxMp + value;
          updateData.max_mp = newMaxMp;
          
          const oldMp = player.mp || 0;
          const newMp = oldMp + value;
          updateData.mp = newMp;
          
          logger.info('应用装备效果', { attr: 'max_mp', oldValue: oldMaxMp, newValue: newMaxMp, value, uid, itemId: equip.item_id });
          logger.info('应用装备效果', { attr: 'mp', oldValue: oldMp, newValue: newMp, value, uid, itemId: equip.item_id });
        } else {
          const oldValue = player[attr] || 0;
          const newValue = oldValue + value;
          updateData[attr] = newValue;
          logger.info('应用装备效果', { attr, oldValue, newValue, value, uid, itemId: equip.item_id });
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await playerService.update(player.id, updateData, ctx);
      logger.info('更新数据库成功', { uid, playerId: player.id, updateData });
    }
  }

  /**
   * 移除装备效果从玩家属性
   */
  static async removeEquipEffect(uid: Uid, equip: any, ctx?: TransactionContext): Promise<void> {
    const attrMap = this.buildAttrMap(equip);

    logger.info('开始移除装备效果', { uid, equipId: equip.id, itemId: equip.item_id, attributes: attrMap });

    // 从数据库获取玩家信息
    const PlayerService = require('../service/player.service').PlayerService;
    const playerService = new PlayerService();
    const players = await playerService.list(uid, ctx);
    if (players.length === 0) {
      logger.warn('玩家不存在', { uid });
      return;
    }
    let player = players[0];
    logger.info('从数据库获取玩家信息', { uid, player });

    // 记录移除前的属性
    const _beforeAttrs = { ...player };

    // 准备更新的属性
    const updateData: any = {};
    for (const [attr, value] of Object.entries(attrMap)) {
      if (value && value > 0) {
        if (attr === 'hp') {
          // 对于hp属性，只减少max_hp，不直接减少hp
          const oldMaxHp = player.max_hp || 0;
          const newMaxHp = Math.max(0, oldMaxHp - value);
          updateData.max_hp = newMaxHp;
          
          // 确保当前hp不超过新的max_hp
          const oldHp = player.hp || 0;
          if (oldHp > newMaxHp) {
            updateData.hp = newMaxHp;
            logger.info('调整当前hp以适应新的max_hp', { oldHp, newHp: newMaxHp, newMaxHp, uid, itemId: equip.item_id });
          }
          
          logger.info('移除装备效果', { attr: 'max_hp', oldValue: oldMaxHp, newValue: newMaxHp, value, uid, itemId: equip.item_id });
        } else if (attr === 'mp') {
          // 对于mp属性，只减少max_mp，不直接减少mp
          const oldMaxMp = player.max_mp || 0;
          const newMaxMp = Math.max(0, oldMaxMp - value);
          updateData.max_mp = newMaxMp;
          
          // 确保当前mp不超过新的max_mp
          const oldMp = player.mp || 0;
          if (oldMp > newMaxMp) {
            updateData.mp = newMaxMp;
            logger.info('调整当前mp以适应新的max_mp', { oldMp, newMp: newMaxMp, newMaxMp, uid, itemId: equip.item_id });
          }
          
          logger.info('移除装备效果', { attr: 'max_mp', oldValue: oldMaxMp, newValue: newMaxMp, value, uid, itemId: equip.item_id });
        } else {
          const oldValue = player[attr] || 0;
          const newValue = Math.max(0, oldValue - value);
          updateData[attr] = newValue;
          logger.info('移除装备效果', { attr, oldValue, newValue, value, uid, itemId: equip.item_id });
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await playerService.update(player.id, updateData, ctx);
      logger.info('更新数据库成功', { uid, playerId: player.id, updateData });
    }
  }



  /**
   * 构建装备属性映射
   * 支持 equip_attributes（背包/装备实例）或直接属性（旧 equip 表）
   */
  private static buildAttrMap(equip: any): AttrMap {
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
}
/**
 * 道具效果执行服务 - 从 item_effect 表读取配置并执行
 */
import { Uid } from '../types';
import { getHpRestore, getMpRestore } from '../utils/item-type';
import { dataStorageService } from './data-storage.service';
import { createError, ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';
import { wsManager } from '../event/ws-manager';

const DEFAULT_EQUIPMENT_CAPACITY = 100;

export class ItemEffectService {
  /** 执行结果：consumedByEffect 为 true 表示效果内部已处理背包扣减（如技能书） */
  static async execute(
    uid: Uid,
    itemId: number,
    actualCount: number,
    itemInfo?: any,
    options?: { bagService?: { list: (u: Uid) => Promise<any[]>; delete: (id: number, opts?: any) => Promise<boolean> } }
  ): Promise<{ ok: boolean; consumedByEffect?: boolean }> {
    const effect = await dataStorageService.getByCondition('item_effect', { item_id: itemId });
    if (!effect) return { ok: false };

    const { services } = await import('./registry');
    const playerService = services.player;
    const players = await playerService.list(uid);
    if (!players.length) throw createError(ErrorCode.SYSTEM_ERROR, '道具使用失败');

    const player = players[0];

    if (effect.effect_type === 'restore') {
      const addHp = getHpRestore(itemInfo);
      const addMp = getMpRestore(itemInfo);
      if (addHp <= 0 && addMp <= 0) throw createError(ErrorCode.INVALID_PARAMS, '该物品无法使用');
      if (addHp > 0) await playerService.addHp(uid, addHp * actualCount);
      if (addMp > 0) await playerService.addMp(uid, addMp * actualCount);
      const updated = await playerService.list(uid);
      if (updated.length) wsManager.sendToUser(uid, { type: 'player', data: updated[0] });
      logger.info('恢复药水使用成功', { uid, itemId, addHp: addHp * actualCount, addMp: addMp * actualCount });
      return { ok: true };
    }

    if (effect.effect_type === 'vip') {
      const vipDays = Number(itemInfo?.vip_days) || 30;
      const totalDays = vipDays * actualCount;
      const now = Math.floor(Date.now() / 1000);
      const currentExpire =
        player.vip_expire_time && player.vip_expire_time > now ? player.vip_expire_time : now;
      const newExpire = currentExpire + totalDays * 86400;
      await playerService.update(player.id, { vip_level: 1, vip_expire_time: newExpire } as any);
      cacheService.player.invalidateByUid(uid);
      const updated = await playerService.list(uid);
      if (updated.length) wsManager.sendToUser(uid, { type: 'player', data: updated[0] });
      logger.info('VIP卡使用成功', { uid, totalDays, usedCount: actualCount, newExpire });
      return { ok: true };
    }

    if (effect.effect_type === 'boost') {
      const { BoostService } = await import('./boost.service');
      const boostService = new BoostService();
      const ok = await boostService.useBoostCard(uid, itemId, actualCount);
      if (!ok) throw createError(ErrorCode.SYSTEM_ERROR, '多倍卡使用失败');
      logger.info('多倍卡使用成功', { uid, itemId, usedCount: actualCount });
      return { ok: true };
    }

    if (effect.effect_type === 'learn_skill') {
      const { SkillService } = await import('./skill.service');
      const skillService = new SkillService();
      const learned = await skillService.learnSkill(uid, itemId, options?.bagService);
      logger.info('技能书使用成功', { itemId, uid, learned });
      return { ok: learned, consumedByEffect: true };
    }

    if (effect.effect_type === 'expand_bag') {
      const value = Number(effect.value) || 50;
      const max = Number(effect.max) || 500;
      const currentCap = player.equipment_capacity ?? DEFAULT_EQUIPMENT_CAPACITY;
      const roomToMax = max - currentCap;
      const maxUsable = Math.floor(roomToMax / value);
      if (maxUsable <= 0) {
        throw createError(ErrorCode.INVALID_PARAMS, '背包装备容量已达上限');
      }
      if (actualCount > maxUsable) {
        throw createError(
          ErrorCode.INVALID_PARAMS,
          `最多只能使用 ${maxUsable} 个，当前容量距上限仅可增加 ${roomToMax} 点`
        );
      }
      const newCap = currentCap + actualCount * value;
      await playerService.update(player.id, { equipment_capacity: newCap } as any);
      cacheService.player.invalidateByUid(uid);
      const updated = await playerService.list(uid);
      if (updated.length) wsManager.sendToUser(uid, { type: 'player', data: updated[0] });
      logger.info('扩容袋使用成功', { uid, newCap, usedCount: actualCount });
      return { ok: true };
    }

    if (effect.effect_type === 'add_stat') {
      const attr = effect.attr || 'max_hp';
      const value = Number(effect.value) || 0;
      const alsoAddCurrent = !!effect.also_add_current;
      const updateData: any = {};
      const addVal = value * actualCount;
      const current = (player as any)[attr] ?? 0;

      if (alsoAddCurrent && (attr === 'max_hp' || attr === 'max_mp')) {
        const currentAttr = attr === 'max_hp' ? 'hp' : 'mp';
        updateData[attr] = current + addVal;
        updateData[currentAttr] = Math.min(
          ((player as any)[currentAttr] ?? 0) + addVal,
          current + addVal
        );
      } else {
        updateData[attr] = current + addVal;
      }

      await playerService.update(player.id, updateData);
      cacheService.player.invalidateByUid(uid);
      const updated = await playerService.list(uid);
      if (updated.length) wsManager.sendToUser(uid, { type: 'player', data: updated[0] });
      logger.info('永久属性果实使用成功', { uid, itemId, attr, addVal });
      return { ok: true };
    }

    return { ok: false };
  }

  /** 是否有配置（可使用的道具） */
  static async hasConfig(itemId: number): Promise<boolean> {
    const effect = await dataStorageService.getByCondition('item_effect', { item_id: itemId });
    return !!effect;
  }
}

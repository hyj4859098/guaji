/**
 * 装备祝福服务
 * 材料 ID 从 config.enhance_materials 读取
 * 金币 1,000,000，成功率 50%，成功 blessing_level +1
 */
import { EquipInstanceService } from './equip_instance.service';
import { EquipInstanceModel } from '../model/equip_instance.model';
import { dataStorageService } from './data-storage.service';
import { getEnhanceMaterialIds } from './enhance-config.service';
import { Uid } from '../types';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { getMaterialCount as getMaterialCountUtil, consumeMaterial as consumeMaterialUtil } from '../utils/material';
import { withUserLock } from '../utils/per-user-lock';
import { pushPlayerFullUpdate } from '../utils/push-update';
const BLESSING_GOLD_COST = 1000000;
const BLESSING_SUCCESS_RATE = 50;
const MAX_BLESSING_LEVEL = 30;

export interface BlessResult {
  success: boolean;
  blessing_level: number;
  message: string;
}

const _blessLocks = new Map<string, Promise<unknown>>();

export class EquipBlessingService {
  private equipInstanceService = new EquipInstanceService();
  private equipInstanceModel = new EquipInstanceModel();

  async getMaterialCount(uid: Uid, itemId: number): Promise<number> {
    return getMaterialCountUtil(uid, itemId);
  }

  async consumeMaterial(uid: Uid, itemId: number, count: number): Promise<boolean> {
    return consumeMaterialUtil(uid, itemId, count);
  }

  async bless(uid: Uid, instanceId: number): Promise<BlessResult> {
    return withUserLock(_blessLocks, uid, () => this._doBless(uid, instanceId));
  }

  private async _doBless(uid: Uid, instanceId: number): Promise<BlessResult> {
    const instance = await this.equipInstanceService.get(instanceId);
    if (!instance || String(instance.uid) !== String(uid)) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '装备不存在或不属于你');
    }

    const equipmentUid = String(instanceId);
    const inBag = await dataStorageService.list('bag', { uid, equipment_uid: equipmentUid });
    if (inBag.length === 0) {
      throw createError(ErrorCode.INVALID_PARAMS, '只能祝福背包中的装备，请先卸下');
    }

    const currentBlessingLevel = instance.blessing_level ?? 0;
    if (currentBlessingLevel >= MAX_BLESSING_LEVEL) {
      throw createError(ErrorCode.INVALID_PARAMS, `祝福已达上限 ${MAX_BLESSING_LEVEL}`);
    }

    const matIds = await getEnhanceMaterialIds();
    const oilCount = await this.getMaterialCount(uid, matIds.blessing_oil);
    if (oilCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '祝福油不足');
    }

    const { services } = await import('./registry');
    const playerService = services.player;
    const players = await playerService.list(uid);
    if (!players.length) throw createError(ErrorCode.USER_NOT_FOUND, '角色不存在');
    const player = players[0];
    if ((player.gold || 0) < BLESSING_GOLD_COST) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, `金币不足，需要 ${BLESSING_GOLD_COST}`);
    }

    const goldOk = await playerService.addGold(uid, -BLESSING_GOLD_COST);
    if (!goldOk) throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, `金币扣除失败`);
    await this.consumeMaterial(uid, matIds.blessing_oil, 1);

    const roll = Math.random() * 100;
    const success = roll < BLESSING_SUCCESS_RATE;
    const currentLevel = instance.blessing_level ?? 0;

    if (success) {
      const newLevel = currentLevel + 1;
      await this.equipInstanceModel.update(instanceId, { blessing_level: newLevel });

      // 数据不变式：祝福后验证 blessing_level 已更新且实例仍存在
      const verify = await this.equipInstanceService.get(instanceId);
      if (!verify) {
        logger.error('DATA_INTEGRITY: 祝福成功后装备实例消失', { uid, instanceId, newLevel });
      } else if ((verify.blessing_level ?? 0) !== newLevel) {
        logger.error('DATA_INTEGRITY: 祝福成功后 blessing_level 不匹配', { uid, instanceId, expected: newLevel, actual: verify.blessing_level });
      }

      logger.info('祝福成功', { uid, instanceId, newLevel });
      await this.pushBlessUpdate(uid);
      return { success: true, blessing_level: newLevel, message: `祝福成功！祝福 +${newLevel}` };
    }

    logger.info('祝福失败', { uid, instanceId, currentLevel });
    await this.pushBlessUpdate(uid);
    return { success: false, blessing_level: currentLevel, message: '祝福失败，无变化' };
  }

  private pushBlessUpdate(uid: Uid): Promise<void> {
    return pushPlayerFullUpdate(uid);
  }
}

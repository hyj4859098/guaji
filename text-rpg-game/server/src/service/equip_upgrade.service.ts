/**
 * 装备提升服务：强化（材料消耗、成功率、失败惩罚）
 * 材料 ID 从 config.enhance_materials 读取，避免硬编码
 */
import { EquipInstanceService } from './equip_instance.service';
import { EquipInstanceModel } from '../model/equip_instance.model';
import { dataStorageService } from './data-storage.service';
import { getEnhanceMaterialIds } from './enhance-config.service';
import { Uid } from '../types';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { getMaterialCount, consumeMaterial } from '../utils/material';
import { withUserLock } from '../utils/per-user-lock';
import { pushPlayerFullUpdate } from '../utils/push-update';
const MAX_ENHANCE_LEVEL = 20;
const FAIL_BROKEN_RATE = 30; // 失败时 30% 装备损坏

export interface EnhanceOptions {
  useLuckyCharm: boolean;
  useAntiExplode: boolean;
}

export interface EnhanceResult {
  success: boolean;
  broken: boolean;
  enhance_level?: number;
  message?: string;
}

const _enhanceLocks = new Map<string, Promise<unknown>>();

export class EquipUpgradeService {
  private equipInstanceService = new EquipInstanceService();
  private equipInstanceModel = new EquipInstanceModel();

  /** 强化石消耗：目标等级² × 100 */
  getStoneCost(targetLevel: number): number {
    return targetLevel * targetLevel * 100;
  }

  /** 基础成功率：100% - (目标等级-1)×10%，最低 20% */
  getBaseSuccessRate(targetLevel: number): number {
    return Math.max(20, 100 - (targetLevel - 1) * 10);
  }

  /** 获取材料数量（委托公共模块） */
  async getMaterialCount(uid: Uid, itemId: number): Promise<number> {
    return getMaterialCount(uid, itemId);
  }

  /** 消耗材料（委托公共模块） */
  async consumeMaterial(uid: Uid, itemId: number, count: number): Promise<boolean> {
    return consumeMaterial(uid, itemId, count);
  }

  /**
   * 强化装备（per-uid 串行，防止并发材料超扣）
   */
  async enhance(
    uid: Uid,
    instanceId: number,
    options: EnhanceOptions
  ): Promise<EnhanceResult> {
    return withUserLock(_enhanceLocks, uid, () => this._doEnhance(uid, instanceId, options));
  }

  private async _doEnhance(
    uid: Uid,
    instanceId: number,
    options: EnhanceOptions
  ): Promise<EnhanceResult> {
    const instance = await this.equipInstanceService.get(instanceId);
    if (!instance || String(instance.uid) !== String(uid)) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '装备不存在或不属于你');
    }

    const equipmentUid = String(instanceId);
    const inBag = await dataStorageService.list('bag', { uid, equipment_uid: equipmentUid });
    if (inBag.length === 0) {
      throw createError(ErrorCode.INVALID_PARAMS, '只能强化背包中的装备，请先卸下');
    }

    const currentLevel = instance.enhance_level ?? 0;
    if (currentLevel >= MAX_ENHANCE_LEVEL) {
      throw createError(ErrorCode.INVALID_PARAMS, '装备已达最大强化等级');
    }

    const targetLevel = currentLevel + 1;
    const stoneCost = this.getStoneCost(targetLevel);
    const matIds = await getEnhanceMaterialIds();

    const [stoneCount, antiCount, luckyCount] = await Promise.all([
      this.getMaterialCount(uid, matIds.stone),
      this.getMaterialCount(uid, matIds.anti_explode),
      this.getMaterialCount(uid, matIds.lucky),
    ]);

    if (stoneCount < stoneCost) {
      throw createError(
        ErrorCode.ITEM_COUNT_NOT_ENOUGH,
        `强化石不足，需要 ${stoneCost}，当前 ${stoneCount}`
      );
    }
    if (options.useLuckyCharm && luckyCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '幸运符不足');
    }
    if (options.useAntiExplode && antiCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '防爆符不足');
    }

    const stoneOk = await this.consumeMaterial(uid, matIds.stone, stoneCost);
    if (!stoneOk) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '强化石扣除失败');
    }
    if (options.useLuckyCharm) {
      await this.consumeMaterial(uid, matIds.lucky, 1);
    }
    if (options.useAntiExplode) {
      await this.consumeMaterial(uid, matIds.anti_explode, 1);
    }

    let successRate = this.getBaseSuccessRate(targetLevel);
    if (options.useLuckyCharm) successRate = Math.min(100, successRate + 20);

    const roll = Math.random() * 100;
    const success = roll < successRate;

    if (success) {
      await this.equipInstanceModel.update(instanceId, {
        enhance_level: targetLevel,
      });

      // 数据不变式：强化后验证 enhance_level 已更新且实例仍存在
      const verify = await this.equipInstanceService.get(instanceId);
      if (!verify) {
        logger.error('DATA_INTEGRITY: 强化成功后装备实例消失', { uid, instanceId, targetLevel });
      } else if ((verify.enhance_level ?? 0) !== targetLevel) {
        logger.error('DATA_INTEGRITY: 强化成功后 enhance_level 不匹配', { uid, instanceId, expected: targetLevel, actual: verify.enhance_level });
      }

      logger.info('强化成功', { uid, instanceId, targetLevel });
      await this.pushEnhanceUpdate(uid);
      return {
        success: true,
        broken: false,
        enhance_level: targetLevel,
        message: `强化成功！+${targetLevel}`,
      };
    }

    const broken =
      !options.useAntiExplode && Math.random() * 100 < FAIL_BROKEN_RATE;

    if (broken) {
      await this.equipInstanceService.destroyOnEnhanceFail(instanceId, uid);
      logger.info('强化失败，装备已破碎', { uid, instanceId });
    } else {
      logger.info('强化失败，装备未损坏', { uid, instanceId });
    }

    await this.pushEnhanceUpdate(uid);
    return {
      success: false,
      broken,
      message: broken ? '强化失败，装备已破碎' : '强化失败',
    };
  }

  private pushEnhanceUpdate(uid: Uid): Promise<void> {
    return pushPlayerFullUpdate(uid);
  }
}

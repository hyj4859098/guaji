/**
 * 装备提升服务：强化（材料消耗、成功率、失败惩罚）
 * 材料：强化石(6)、装备防爆符(7)、装备幸运符(8)
 */
import { EquipInstanceService } from './equip_instance.service';
import { EquipInstanceModel } from '../model/equip_instance.model';
import { dataStorageService } from './data-storage.service';
import { Uid } from '../types';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';

const ITEM_STONE = 6;
const ITEM_ANTI_EXPLODE = 7;
const ITEM_LUCKY_CHARM = 8;
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

const _enhanceLocks = new Map<string, Promise<any>>();

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

  /** 获取材料数量 */
  async getMaterialCount(uid: Uid, itemId: number): Promise<number> {
    const rows = await dataStorageService.list('bag', {
      uid,
      item_id: itemId,
      equipment_uid: null,
    });
    return rows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
  }

  /** 消耗材料 */
  async consumeMaterial(uid: Uid, itemId: number, count: number): Promise<boolean> {
    const total = await this.getMaterialCount(uid, itemId);
    if (total < count) return false;
    const rows = await dataStorageService.list('bag', {
      uid,
      item_id: itemId,
      equipment_uid: null,
    });
    let remain = count;
    for (const row of rows) {
      if (remain <= 0) break;
      const c = Math.min(remain, row.count || 0);
      if (c <= 0) continue;
      if (row.count === c) {
        await dataStorageService.delete('bag', row.id);
      } else {
        await dataStorageService.update('bag', row.id, { count: row.count - c });
      }
      remain -= c;
    }
    return remain <= 0;
  }

  /**
   * 强化装备（per-uid 串行，防止并发材料超扣）
   */
  async enhance(
    uid: Uid,
    instanceId: number,
    options: EnhanceOptions
  ): Promise<EnhanceResult> {
    const key = String(uid);
    const prev = _enhanceLocks.get(key) ?? Promise.resolve();
    let resolve!: () => void;
    const gate = new Promise<void>(r => { resolve = r; });
    _enhanceLocks.set(key, gate);

    try {
      await prev;
      return await this._doEnhance(uid, instanceId, options);
    } finally {
      resolve();
      if (_enhanceLocks.get(key) === gate) _enhanceLocks.delete(key);
    }
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

    const [stoneCount, antiCount, luckyCount] = await Promise.all([
      this.getMaterialCount(uid, ITEM_STONE),
      this.getMaterialCount(uid, ITEM_ANTI_EXPLODE),
      this.getMaterialCount(uid, ITEM_LUCKY_CHARM),
    ]);

    if (stoneCount < stoneCost) {
      throw createError(
        ErrorCode.ITEM_COUNT_NOT_ENOUGH,
        `强化石不足，需要 ${stoneCost}，当前 ${stoneCount}`
      );
    }
    if (options.useLuckyCharm && luckyCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '装备幸运符不足');
    }
    if (options.useAntiExplode && antiCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '装备防爆符不足');
    }

    const stoneOk = await this.consumeMaterial(uid, ITEM_STONE, stoneCost);
    if (!stoneOk) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '强化石扣除失败');
    }
    if (options.useLuckyCharm) {
      await this.consumeMaterial(uid, ITEM_LUCKY_CHARM, 1);
    }
    if (options.useAntiExplode) {
      await this.consumeMaterial(uid, ITEM_ANTI_EXPLODE, 1);
    }

    let successRate = this.getBaseSuccessRate(targetLevel);
    if (options.useLuckyCharm) successRate = Math.min(100, successRate + 20);

    const roll = Math.random() * 100;
    const success = roll < successRate;

    if (success) {
      await this.equipInstanceModel.update(instanceId, {
        enhance_level: targetLevel,
      });
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

  private async pushEnhanceUpdate(uid: Uid): Promise<void> {
    try {
      const BagService = (await import('./bag.service')).BagService;
      const PlayerService = (await import('./player.service')).PlayerService;
      const EquipService = (await import('./equip.service')).EquipService;
      const bagService = new BagService();
      const playerService = new PlayerService();
      const equipService = new EquipService();
      const [bags, players, equips] = await Promise.all([
        bagService.list(uid),
        playerService.list(uid),
        equipService.list(uid),
      ]);
      wsManager.sendToUser(uid, { type: 'bag', data: bags });
      if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      wsManager.sendToUser(uid, { type: 'equip', data: equips });
    } catch (e) {
      logger.error('强化推送失败', { uid, error: e });
    }
  }
}

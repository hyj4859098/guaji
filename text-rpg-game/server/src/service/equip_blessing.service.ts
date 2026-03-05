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
import { wsManager } from '../event/ws-manager';
const BLESSING_GOLD_COST = 1000000;
const BLESSING_SUCCESS_RATE = 50;
const MAX_BLESSING_LEVEL = 30;

export interface BlessResult {
  success: boolean;
  blessing_level: number;
  message: string;
}

const _blessLocks = new Map<string, Promise<any>>();

export class EquipBlessingService {
  private equipInstanceService = new EquipInstanceService();
  private equipInstanceModel = new EquipInstanceModel();

  async getMaterialCount(uid: Uid, itemId: number): Promise<number> {
    const rows = await dataStorageService.list('bag', { uid, item_id: itemId, equipment_uid: null });
    return rows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
  }

  async consumeMaterial(uid: Uid, itemId: number, count: number): Promise<boolean> {
    const total = await this.getMaterialCount(uid, itemId);
    if (total < count) return false;
    const rows = await dataStorageService.list('bag', { uid, item_id: itemId, equipment_uid: null });
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

  async bless(uid: Uid, instanceId: number): Promise<BlessResult> {
    const key = String(uid);
    const prev = _blessLocks.get(key) ?? Promise.resolve();
    let resolve!: () => void;
    const gate = new Promise<void>(r => { resolve = r; });
    _blessLocks.set(key, gate);
    try {
      await prev;
      return await this._doBless(uid, instanceId);
    } finally {
      resolve();
      if (_blessLocks.get(key) === gate) _blessLocks.delete(key);
    }
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

    const PlayerService = (await import('./player.service')).PlayerService;
    const playerService = new PlayerService();
    const players = await playerService.list(uid);
    if (!players.length) throw createError(ErrorCode.USER_NOT_FOUND, '角色不存在');
    const player = players[0];
    if ((player.gold || 0) < BLESSING_GOLD_COST) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, `金币不足，需要 ${BLESSING_GOLD_COST}`);
    }

    await this.consumeMaterial(uid, matIds.blessing_oil, 1);
    await playerService.addGold(uid, -BLESSING_GOLD_COST);

    const roll = Math.random() * 100;
    const success = roll < BLESSING_SUCCESS_RATE;
    const currentLevel = instance.blessing_level ?? 0;

    if (success) {
      const newLevel = currentLevel + 1;
      await this.equipInstanceModel.update(instanceId, { blessing_level: newLevel });
      logger.info('祝福成功', { uid, instanceId, newLevel });
      await this.pushBlessUpdate(uid);
      return { success: true, blessing_level: newLevel, message: `祝福成功！祝福 +${newLevel}` };
    }

    logger.info('祝福失败', { uid, instanceId, currentLevel });
    await this.pushBlessUpdate(uid);
    return { success: false, blessing_level: currentLevel, message: '祝福失败，无变化' };
  }

  private async pushBlessUpdate(uid: Uid): Promise<void> {
    try {
      const BagService = (await import('./bag.service')).BagService;
      const PlayerService = (await import('./player.service')).PlayerService;
      const EquipService = (await import('./equip.service')).EquipService;
      const bagService = new BagService();
      const playerService = new PlayerService();
      const equipService = new EquipService();
      const [bagPayload, players, equips] = await Promise.all([
        bagService.getListPayload(uid),
        playerService.list(uid),
        equipService.list(uid),
      ]);
      wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
      if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      wsManager.sendToUser(uid, { type: 'equip', data: equips });
    } catch (e) {
      logger.error('祝福推送失败', { uid, error: e });
    }
  }
}

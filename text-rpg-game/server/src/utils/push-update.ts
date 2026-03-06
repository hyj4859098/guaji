import { Uid } from '../types';
import { wsManager } from '../event/ws-manager';
import { logger } from './logger';
import { services } from '../service/registry';

/**
 * 向用户推送 player + bag + equip 全量更新。
 * 集中复用，避免 equip / upgrade / blessing 各自重复实现。
 */
export async function pushPlayerFullUpdate(uid: Uid): Promise<void> {
  try {
    const [bagPayload, players, equips] = await Promise.all([
      services.bag.getListPayload(uid),
      services.player.list(uid),
      services.equip.list(uid),
    ]);
    wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
    if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
    wsManager.sendToUser(uid, { type: 'equip', data: equips });
  } catch (e) {
    logger.error('推送全量更新失败', { uid, error: e instanceof Error ? e.message : String(e) });
  }
}

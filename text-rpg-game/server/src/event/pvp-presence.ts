/**
 * PVP 状态：战斗中标记、地图禁入
 */
import { Uid } from '../types/index';
import { toUidKey } from '../utils/uid-key';

// uid -> { opponent_uid, map_id }
const pvpBattleState = new Map<string, { opponent_uid: string; map_id: number }>();

export function setInBattle(uid: Uid, opponentUid: Uid, mapId: number): void {
  const k = toUidKey(uid);
  const ok = toUidKey(opponentUid);
  pvpBattleState.set(k, { opponent_uid: ok, map_id: mapId });
  pvpBattleState.set(ok, { opponent_uid: k, map_id: mapId });
}

export function clearInBattle(uid: Uid): void {
  const k = toUidKey(uid);
  const info = pvpBattleState.get(k);
  if (info) {
    pvpBattleState.delete(k);
    pvpBattleState.delete(info.opponent_uid);
  }
}

export function isInBattle(uid: Uid): boolean {
  return pvpBattleState.has(toUidKey(uid));
}

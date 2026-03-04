/**
 * PVP 状态：战斗中标记、地图禁入
 */
import { Uid } from '../types/index';

function toKey(uid: Uid): string {
  return String(uid);
}

// uid -> { opponent_uid, map_id }
const pvpBattleState = new Map<string, { opponent_uid: string; map_id: number }>();

// `${uid}_${mapId}` -> banUntilTimestamp (秒)
const mapBanUntil = new Map<string, number>();

export function setInBattle(uid: Uid, opponentUid: Uid, mapId: number): void {
  const k = toKey(uid);
  const ok = toKey(opponentUid);
  pvpBattleState.set(k, { opponent_uid: ok, map_id: mapId });
  pvpBattleState.set(ok, { opponent_uid: k, map_id: mapId });
}

export function clearInBattle(uid: Uid): void {
  const k = toKey(uid);
  const info = pvpBattleState.get(k);
  if (info) {
    pvpBattleState.delete(k);
    pvpBattleState.delete(info.opponent_uid);
  }
}

export function isInBattle(uid: Uid): boolean {
  return pvpBattleState.has(toKey(uid));
}

export function getMapBan(uid: Uid, mapId: number): number {
  const key = `${toKey(uid)}_${mapId}`;
  return mapBanUntil.get(key) ?? 0;
}

export function setMapBan(uid: Uid, mapId: number, seconds: number): void {
  const key = `${toKey(uid)}_${mapId}`;
  const until = Math.floor(Date.now() / 1000) + seconds;
  mapBanUntil.set(key, until);
}

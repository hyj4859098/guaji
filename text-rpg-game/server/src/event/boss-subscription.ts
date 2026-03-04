/**
 * Boss 列表订阅：玩家进入 Boss 列表页时订阅，离开时取消
 * Boss 复活时只推送给已订阅的玩家
 */
import { Uid } from '../types/index';
import { wsManager } from './ws-manager';

function toKey(uid: Uid): string {
  return String(uid);
}

// map_id -> Set<uid>
const mapSubscribers = new Map<number, Set<string>>();

export function subscribeBoss(uid: Uid, mapId: number): void {
  const key = toKey(uid);
  let set = mapSubscribers.get(mapId);
  if (!set) {
    set = new Set();
    mapSubscribers.set(mapId, set);
  }
  set.add(key);
}

export function unsubscribeBoss(uid: Uid): void {
  const key = toKey(uid);
  mapSubscribers.forEach((set) => set.delete(key));
}

export function sendBossRespawnToSubscribers(mapId: number, bossId: number, bossName: string): void {
  const set = mapSubscribers.get(mapId);
  if (!set || set.size === 0) return;
  const message = {
    type: 'boss_respawn',
    data: { boss_id: bossId, map_id: mapId, boss_name: bossName },
  };
  set.forEach((uidStr) => {
    const uid = Number(uidStr) || uidStr;
    wsManager.sendToUser(uid, message);
  });
}

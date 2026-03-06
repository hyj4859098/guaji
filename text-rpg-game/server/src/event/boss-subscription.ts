/**
 * Boss 列表订阅：玩家进入 Boss 列表页时订阅，离开时取消
 * Boss 复活时只推送给已订阅的玩家
 */
import { Uid } from '../types/index';
import { toUidKey } from '../utils/uid-key';

// map_id -> Set<uid>
const mapSubscribers = new Map<number, Set<string>>();

type MapIdCallback = (mapId: number) => void;
let onMapSubscribeChange: MapIdCallback | null = null;
/** 设置订阅变化回调（用于 PVP 玩家列表广播） */
export function setOnMapSubscribeChange(cb: MapIdCallback | null): void {
  onMapSubscribeChange = cb;
}

type SendToUserFn = (uid: Uid, message: any) => void;
let sendToUserFn: SendToUserFn | null = null;
/** 注入发送消息函数（由 app 启动时设置，避免与 ws-manager 循环依赖） */
export function setSendToUser(fn: SendToUserFn): void {
  sendToUserFn = fn;
}

export function subscribeBoss(uid: Uid, mapId: number): void {
  const key = toUidKey(uid);
  let set = mapSubscribers.get(mapId);
  if (!set) {
    set = new Set();
    mapSubscribers.set(mapId, set);
  }
  set.add(key);
  if (onMapSubscribeChange) onMapSubscribeChange(mapId);
}

export function unsubscribeBoss(uid: Uid): void {
  const key = toUidKey(uid);
  const affectedMaps: number[] = [];
  mapSubscribers.forEach((set, mapId) => {
    if (set.has(key)) affectedMaps.push(mapId);
    set.delete(key);
  });
  affectedMaps.forEach((mapId) => onMapSubscribeChange?.(mapId));
}

/** 获取某地图的订阅者 uid 列表（用于 PVP 玩家列表） */
export function getMapSubscriberUids(mapId: number): string[] {
  const set = mapSubscribers.get(mapId);
  return set ? Array.from(set) : [];
}

export function sendBossRespawnToSubscribers(mapId: number, bossId: number, bossName: string): void {
  const set = mapSubscribers.get(mapId);
  if (!set || set.size === 0 || !sendToUserFn) return;
  const message = {
    type: 'boss_respawn',
    data: { boss_id: bossId, map_id: mapId, boss_name: bossName },
  };
  set.forEach((uidStr) => {
    const uid = Number(uidStr) || uidStr;
    sendToUserFn!(uid, message);
  });
}

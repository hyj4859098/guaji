import { Uid } from '../types';

/** 统一将 uid 转为字符串 key，避免 number/string 导致 Map 查找失败 */
export function toUidKey(uid: Uid): string {
  return String(uid);
}

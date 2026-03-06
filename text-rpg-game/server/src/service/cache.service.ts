/**
 * 缓存服务：统一管理 Map 内存缓存，减轻数据库读写
 * 更新时需主动调用 invalidate 保证数据一致性
 */
import { MemCache } from '../utils/mem-cache';
import { Uid } from '../types/index';

// 玩家缓存 TTL 30 秒（战斗内频繁读，战斗结束需看到最新）
const PLAYER_TTL = 30_000;
// 已装备技能 TTL 60 秒（装备变更较少）
const SKILL_TTL = 60_000;
// 怪物配置 TTL 5 分钟（配置类，变更少）
const MONSTER_TTL = 300_000;

export const playerCache = new MemCache<string, any[]>(PLAYER_TTL);
export const equippedSkillsCache = new MemCache<string, any>(SKILL_TTL);
export const monsterCache = new MemCache<string, any>(MONSTER_TTL);

// playerId -> uid 反向映射，用于 update(id) 时按 uid 失效
const playerIdToUid = new Map<string, Uid>();

export const cacheService = {
  player: {
    get(uid: Uid): any[] | null {
      return playerCache.get(String(uid));
    },
    set(uid: Uid, data: any[]): void {
      playerCache.set(String(uid), data);
      data.forEach((p: any) => {
        if (p?.id != null) playerIdToUid.set(String(p.id), uid);
      });
    },
    invalidateByUid(uid: Uid): void {
      playerCache.delete(String(uid));
      // 同步清理反向映射，避免内存泄漏
      for (const [pid, mappedUid] of playerIdToUid) {
        if (mappedUid === uid || String(mappedUid) === String(uid)) {
          playerIdToUid.delete(pid);
        }
      }
    },
    invalidateByPlayerId(playerId: string | number): void {
      const uid = playerIdToUid.get(String(playerId));
      if (uid != null) {
        playerCache.delete(String(uid));
        playerIdToUid.delete(String(playerId));
      }
    }
  },
  equippedSkills: {
    get(uid: Uid): any | null {
      return equippedSkillsCache.get(String(uid));
    },
    set(uid: Uid, data: any): void {
      equippedSkillsCache.set(String(uid), data);
    },
    invalidate(uid: Uid): void {
      equippedSkillsCache.delete(String(uid));
    }
  },
  monster: {
    get(id: string | number): any | null {
      return monsterCache.get(String(id));
    },
    set(id: string | number, data: any): void {
      monsterCache.set(String(id), data);
    },
    invalidate(id: string | number): void {
      monsterCache.delete(String(id));
    }
  }
};

/**
 * 等级榜称号服务
 * 第1名：天人合一 战斗获得经验 +10%
 * 第2名：无人之境 战斗获得经验 +8%
 * 第3名：势如破竹 战斗获得经验 +5%
 * 每天 0 点（中国时区）根据等级榜更新称号
 */
import { dataStorageService } from './data-storage.service';
import { Uid } from '../types/index';

const TITLE_BONUS: Record<number, number> = {
  1: 1.10, // 天人合一 +10%
  2: 1.08, // 无人之境 +8%
  3: 1.05, // 势如破竹 +5%
};

const TITLE_NAMES: Record<number, string> = {
  1: '天人合一',
  2: '无人之境',
  3: '势如破竹',
};

/** 获取今日日期字符串（中国时区 UTC+8） */
function getTodayStr(): string {
  const d = new Date();
  const chinaOffset = 8 * 60;
  const chinaTime = new Date(d.getTime() + (chinaOffset - d.getTimezoneOffset()) * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

export class LevelTitleService {
  private cache: { date: string; uids: (string | number)[] } | null = null;

  /** 获取等级榜前三 UID，每日 0 点自动更新 */
  async getTop3Uids(): Promise<(string | number)[]> {
    const today = getTodayStr();
    if (this.cache && this.cache.date === today) {
      return this.cache.uids;
    }

    const all = await dataStorageService.list('player', {});
    const sorted = [...all].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const top3 = sorted.slice(0, 3).map((r) => r.uid);

    this.cache = { date: today, uids: top3 };
    return top3;
  }

  /** 获取某 UID 的经验加成倍率（1.0 或 1.05/1.08/1.10） */
  async getExpBonus(uid: Uid): Promise<number> {
    const top3 = await this.getTop3Uids();
    const uidStr = String(uid);
    for (let i = 0; i < top3.length; i++) {
      if (String(top3[i]) === uidStr) {
        return TITLE_BONUS[i + 1] ?? 1;
      }
    }
    return 1;
  }

  /** 获取某 UID 的称号名，无则返回空 */
  async getTitleName(uid: Uid): Promise<string> {
    const top3 = await this.getTop3Uids();
    const uidStr = String(uid);
    for (let i = 0; i < top3.length; i++) {
      if (String(top3[i]) === uidStr) {
        return TITLE_NAMES[i + 1] ?? '';
      }
    }
    return '';
  }

  /** 获取某 UID 的所有等级榜称号（用于多榜合并） */
  async getAllTitles(uid: Uid): Promise<string[]> {
    const title = await this.getTitleName(uid);
    return title ? [title] : [];
  }

  /** 获取等级榜前三的称号映射 { uid: title } */
  async getTop3Titles(): Promise<Record<string, string>> {
    const top3 = await this.getTop3Uids();
    const map: Record<string, string> = {};
    top3.forEach((uid, i) => {
      map[String(uid)] = TITLE_NAMES[i + 1] ?? '';
    });
    return map;
  }

  clearCache(): void {
    this.cache = null;
  }
}

export const levelTitleService = new LevelTitleService();

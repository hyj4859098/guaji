/**
 * 财力榜称号服务
 * 第1名：资本 +10%金钱（独立加成）
 * 第2名：财阀 +8%金钱
 * 第3名：地主 +5%金钱
 * 每天 0 点（服务器时间）根据财力榜更新称号
 */
import { dataStorageService } from './data-storage.service';
import { Uid } from '../types/index';

const TITLE_BONUS: Record<number, number> = {
  1: 1.10, // 资本 +10%
  2: 1.08, // 财阀 +8%
  3: 1.05, // 地主 +5%
};

const TITLE_NAMES: Record<number, string> = {
  1: '资本',
  2: '财阀',
  3: '地主',
};

/** 获取今日日期字符串（中国时区 UTC+8，用于每日 0 点切换） */
function getTodayStr(): string {
  const d = new Date();
  const chinaOffset = 8 * 60; // minutes
  const chinaTime = new Date(d.getTime() + (chinaOffset - d.getTimezoneOffset()) * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

export class WealthTitleService {
  private cache: { date: string; uids: (string | number)[] } | null = null;

  /** 获取财力榜前三 UID，每日 0 点自动更新 */
  async getTop3Uids(): Promise<(string | number)[]> {
    const today = getTodayStr();
    if (this.cache && this.cache.date === today) {
      return this.cache.uids;
    }

    const all = await dataStorageService.list('player', {});
    const sorted = [...all].sort((a, b) => (b.gold ?? 0) - (a.gold ?? 0));
    const top3 = sorted.slice(0, 3).map((r) => r.uid);

    this.cache = { date: today, uids: top3 };
    return top3;
  }

  /** 获取某 UID 的金钱加成倍率（1.0 或 1.05/1.08/1.10） */
  async getGoldBonus(uid: Uid): Promise<number> {
    const top3 = await this.getTop3Uids();
    const uidStr = String(uid);
    for (let i = 0; i < top3.length; i++) {
      if (String(top3[i]) === uidStr) {
        return TITLE_BONUS[i + 1] ?? 1;
      }
    }
    return 1;
  }

  /** 获取某 UID 的称号名（用于展示），无则返回空 */
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

  /** 获取某 UID 的所有称号（支持多榜，目前仅财力榜） */
  async getAllTitles(uid: Uid): Promise<string[]> {
    const title = await this.getTitleName(uid);
    return title ? [title] : [];
  }

  /** 获取财力榜前三的称号映射 { uid: title } */
  async getTop3Titles(): Promise<Record<string, string>> {
    const top3 = await this.getTop3Uids();
    const map: Record<string, string> = {};
    top3.forEach((uid, i) => {
      map[String(uid)] = TITLE_NAMES[i + 1] ?? '';
    });
    return map;
  }

  /** 清除缓存（用于测试或手动刷新） */
  clearCache(): void {
    this.cache = null;
  }
}

export const wealthTitleService = new WealthTitleService();

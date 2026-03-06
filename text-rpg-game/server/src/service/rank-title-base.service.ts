/**
 * 排行榜称号基类 — 共享 getTop3、getBonus、getTitleName 逻辑
 * 子类只需提供排序字段、奖励配置、称号名
 */
import { dataStorageService } from './data-storage.service';
import { Uid } from '../types/index';

/** 获取今日日期字符串（中国时区 UTC+8） */
function getTodayStr(): string {
  const now = Date.now();
  const chinaTime = new Date(now + 8 * 60 * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

export abstract class RankTitleBaseService {
  protected abstract readonly sortField: string;
  protected abstract readonly titleBonus: Record<number, number>;
  protected abstract readonly titleNames: Record<number, string>;

  private cache: { date: string; uids: (string | number)[] } | null = null;

  async getTop3Uids(): Promise<(string | number)[]> {
    const today = getTodayStr();
    if (this.cache && this.cache.date === today) {
      return this.cache.uids;
    }

    const top3 = await dataStorageService.listSorted(
      'player', {}, { [this.sortField]: -1 } as Record<string, 1 | -1>, 3
    );
    const uids = top3.map((r: any) => r.uid);
    this.cache = { date: today, uids };
    return uids;
  }

  async getBonus(uid: Uid): Promise<number> {
    const top3 = await this.getTop3Uids();
    const uidStr = String(uid);
    for (let i = 0; i < top3.length; i++) {
      if (String(top3[i]) === uidStr) {
        return this.titleBonus[i + 1] ?? 1;
      }
    }
    return 1;
  }

  async getTitleName(uid: Uid): Promise<string> {
    const top3 = await this.getTop3Uids();
    const uidStr = String(uid);
    for (let i = 0; i < top3.length; i++) {
      if (String(top3[i]) === uidStr) {
        return this.titleNames[i + 1] ?? '';
      }
    }
    return '';
  }

  async getAllTitles(uid: Uid): Promise<string[]> {
    const title = await this.getTitleName(uid);
    return title ? [title] : [];
  }

  async getTop3Titles(): Promise<Record<string, string>> {
    const top3 = await this.getTop3Uids();
    const map: Record<string, string> = {};
    top3.forEach((uid, i) => {
      map[String(uid)] = this.titleNames[i + 1] ?? '';
    });
    return map;
  }

  clearCache(): void {
    this.cache = null;
  }
}

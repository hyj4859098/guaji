/**
 * 排行榜服务
 * 财力榜（金币）、等级榜
 */
import { dataStorageService } from './data-storage.service';
import { wealthTitleService } from './wealth-title.service';
import { levelTitleService } from './level-title.service';

const RANK_TOP = 100;

export type RankType = 'gold' | 'level';

export interface RankItem {
  rank: number;
  uid: string | number;
  name: string;
  level: number;
  gold?: number;
  /** 财力榜/等级榜前三称号 */
  title?: string;
}

export interface RankResult {
  items: RankItem[];
  total: number;
}

export class RankService {
  async getRanking(type: RankType, page: number, pageSize: number): Promise<RankResult> {
    const p = Math.max(1, page);
    const ps = Math.max(1, Math.min(20, pageSize));

    const all = await dataStorageService.list('player', {});
    let sorted: any[];

    if (type === 'gold') {
      sorted = [...all].sort((a, b) => (b.gold ?? 0) - (a.gold ?? 0));
    } else {
      sorted = [...all].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    }

    const top100 = sorted.slice(0, RANK_TOP);
    const total = top100.length;
    const start = (p - 1) * ps;
    const pageItems = top100.slice(start, start + ps);

    const [wealthTitles, levelTitles] = await Promise.all([
      type === 'gold' ? wealthTitleService.getTop3Titles() : Promise.resolve({} as Record<string, string>),
      type === 'level' ? levelTitleService.getTop3Titles() : Promise.resolve({} as Record<string, string>),
    ]);
    const top3Titles: Record<string, string> = type === 'gold' ? wealthTitles : type === 'level' ? levelTitles : {};

    const items: RankItem[] = pageItems.map((row, i) => {
      const rank = start + i + 1;
      const title = (type === 'gold' || type === 'level') ? (top3Titles[String(row.uid)] ?? '') : undefined;
      return {
        rank,
        uid: row.uid,
        name: row.name || '未知',
        level: row.level ?? 1,
        ...(type === 'gold' ? { gold: row.gold ?? 0, title } : type === 'level' ? { title } : {}),
      };
    });

    return { items, total };
  }
}

export const rankService = new RankService();

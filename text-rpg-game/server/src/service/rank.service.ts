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
    const start = (p - 1) * ps;

    const sortField = type === 'gold' ? 'gold' : 'level';
    const sort: Record<string, 1 | -1> = { [sortField]: -1 };

    // 使用 DB 排序+分页，避免全量加载
    const { items: pageItems, total: rawTotal } = await dataStorageService.listSortedWithCount(
      'player', {}, sort, ps, start
    );
    const total = Math.min(rawTotal, RANK_TOP);

    const [wealthTitles, levelTitles] = await Promise.all([
      type === 'gold' ? wealthTitleService.getTop3Titles() : Promise.resolve({} as Record<string, string>),
      type === 'level' ? levelTitleService.getTop3Titles() : Promise.resolve({} as Record<string, string>),
    ]);
    const top3Titles: Record<string, string> = type === 'gold' ? wealthTitles : type === 'level' ? levelTitles : {};

    const items: RankItem[] = pageItems.map((row: any, i: number) => {
      const rank = start + i + 1;
      if (rank > RANK_TOP) return null;
      const title = (type === 'gold' || type === 'level') ? (top3Titles[String(row.uid)] ?? '') : undefined;
      return {
        rank,
        uid: row.uid,
        name: row.name || '未知',
        level: row.level ?? 1,
        ...(type === 'gold' ? { gold: row.gold ?? 0, title } : type === 'level' ? { title } : {}),
      };
    }).filter(Boolean) as RankItem[];

    return { items, total };
  }
}

export const rankService = new RankService();

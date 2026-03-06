/**
 * 财力榜称号服务
 * 第1名：资本 +10%金钱（独立加成）
 * 第2名：财阀 +8%金钱
 * 第3名：地主 +5%金钱
 * 每天 0 点（中国时区）根据财力榜更新称号
 */
import { RankTitleBaseService } from './rank-title-base.service';
import { Uid } from '../types/index';

export class WealthTitleService extends RankTitleBaseService {
  protected readonly sortField = 'gold';
  protected readonly titleBonus: Record<number, number> = {
    1: 1.10,
    2: 1.08,
    3: 1.05,
  };
  protected readonly titleNames: Record<number, string> = {
    1: '资本',
    2: '财阀',
    3: '地主',
  };

  async getGoldBonus(uid: Uid): Promise<number> {
    return this.getBonus(uid);
  }
}

export const wealthTitleService = new WealthTitleService();

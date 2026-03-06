/**
 * 等级榜称号服务
 * 第1名：天人合一 战斗获得经验 +10%
 * 第2名：无人之境 战斗获得经验 +8%
 * 第3名：势如破竹 战斗获得经验 +5%
 * 每天 0 点（中国时区）根据等级榜更新称号
 */
import { RankTitleBaseService } from './rank-title-base.service';
import { Uid } from '../types/index';

export class LevelTitleService extends RankTitleBaseService {
  protected readonly sortField = 'level';
  protected readonly titleBonus: Record<number, number> = {
    1: 1.10,
    2: 1.08,
    3: 1.05,
  };
  protected readonly titleNames: Record<number, string> = {
    1: '天人合一',
    2: '无人之境',
    3: '势如破竹',
  };

  async getExpBonus(uid: Uid): Promise<number> {
    return this.getBonus(uid);
  }
}

export const levelTitleService = new LevelTitleService();

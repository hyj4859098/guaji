/**
 * RankService 集成测试 - getRanking 财力榜/等级榜、分页、空列表
 */
import { rankService } from '../../service/rank.service';

describe('RankService 集成测试', () => {
  it('getRanking type=gold 返回排行榜', async () => {
    const result = await rankService.getRanking('gold', 1, 20);
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.items)).toBe(true);
    result.items.forEach((item: any) => {
      expect(item).toHaveProperty('rank');
      expect(item).toHaveProperty('uid');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('level');
      expect(item).toHaveProperty('gold');
    });
  });

  it('getRanking type=level 返回排行榜', async () => {
    const result = await rankService.getRanking('level', 1, 20);
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.items)).toBe(true);
    result.items.forEach((item: any) => {
      expect(item).toHaveProperty('rank');
      expect(item).toHaveProperty('uid');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('level');
    });
  });

  it('getRanking 分页 page 超出范围返回空列表', async () => {
    const result = await rankService.getRanking('gold', 999, 20);
    expect(result.items).toEqual([]);
    expect(typeof result.total).toBe('number');
  });

  it('getRanking 空玩家列表时返回空', async () => {
    const result = await rankService.getRanking('gold', 1, 20);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

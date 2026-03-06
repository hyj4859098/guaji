import { StatusEnum, AuctionStatusEnum, BattleResultEnum } from './enum';

describe('enum', () => {
  describe('StatusEnum', () => {
    it('应有正确的状态值', () => {
      expect(StatusEnum.NORMAL).toBe(0);
      expect(StatusEnum.DELETED).toBe(1);
      expect(StatusEnum.DISABLE).toBe(2);
    });
  });

  describe('AuctionStatusEnum', () => {
    it('应有正确的拍卖状态', () => {
      expect(AuctionStatusEnum.ON).toBe(0);
      expect(AuctionStatusEnum.SUCCESS).toBe(1);
    });
  });

  describe('BattleResultEnum', () => {
    it('应有正确的战斗结果', () => {
      expect(BattleResultEnum.WIN).toBe(0);
      expect(BattleResultEnum.LOSE).toBe(1);
    });
  });
});

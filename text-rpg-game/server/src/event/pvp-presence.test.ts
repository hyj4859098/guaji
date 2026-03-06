import {
  setInBattle,
  clearInBattle,
  isInBattle,
} from './pvp-presence';

describe('pvp-presence', () => {
  beforeEach(() => {
    clearInBattle(1);
    clearInBattle(2);
  });

  describe('setInBattle / isInBattle / clearInBattle', () => {
    it('setInBattle 后双方都在战斗中', () => {
      setInBattle(1, 2, 10);
      expect(isInBattle(1)).toBe(true);
      expect(isInBattle(2)).toBe(true);
    });

    it('clearInBattle 清除后不再在战斗中', () => {
      setInBattle(1, 2, 10);
      clearInBattle(1);
      expect(isInBattle(1)).toBe(false);
      expect(isInBattle(2)).toBe(false);
    });

    it('未设置时 isInBattle 返回 false', () => {
      expect(isInBattle(99)).toBe(false);
    });
  });
});

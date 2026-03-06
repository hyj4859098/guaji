import {
  getDefaultBoostConfig,
  isVipActive,
  BOOST_MULTIPLIER_VALUES,
  EMPTY_BOOST_SLOT,
  EMPTY_BOOST_CATEGORY,
} from './player';
import type { Player } from './player';

describe('player', () => {
  describe('getDefaultBoostConfig', () => {
    it('返回四类别的默认配置', () => {
      const cfg = getDefaultBoostConfig();
      expect(cfg.exp).toBeDefined();
      expect(cfg.gold).toBeDefined();
      expect(cfg.drop).toBeDefined();
      expect(cfg.reputation).toBeDefined();
    });

    it('每类都有 x2/x4/x8 且 charges=0, enabled=false', () => {
      const cfg = getDefaultBoostConfig();
      for (const cat of Object.values(cfg)) {
        expect(cat.x2).toEqual({ charges: 0, enabled: false });
        expect(cat.x4).toEqual({ charges: 0, enabled: false });
        expect(cat.x8).toEqual({ charges: 0, enabled: false });
      }
    });
  });

  describe('isVipActive', () => {
    it('无 vip_expire_time 返回 false', () => {
      expect(isVipActive({} as Player)).toBe(false);
      expect(isVipActive({ vip_expire_time: undefined } as Player)).toBe(false);
    });

    it('vip_expire_time 为 0 返回 false', () => {
      expect(isVipActive({ vip_expire_time: 0 } as Player)).toBe(false);
    });

    it('vip_expire_time 在未来返回 true', () => {
      const future = Math.floor(Date.now() / 1000) + 86400;
      expect(isVipActive({ vip_expire_time: future } as Player)).toBe(true);
    });

    it('vip_expire_time 在过去返回 false', () => {
      const past = Math.floor(Date.now() / 1000) - 86400;
      expect(isVipActive({ vip_expire_time: past } as Player)).toBe(false);
    });
  });

  describe('BOOST_MULTIPLIER_VALUES', () => {
    it('x2=2, x4=4, x8=8', () => {
      expect(BOOST_MULTIPLIER_VALUES.x2).toBe(2);
      expect(BOOST_MULTIPLIER_VALUES.x4).toBe(4);
      expect(BOOST_MULTIPLIER_VALUES.x8).toBe(8);
    });
  });

  describe('EMPTY_BOOST_SLOT', () => {
    it('charges=0, enabled=false', () => {
      expect(EMPTY_BOOST_SLOT).toEqual({ charges: 0, enabled: false });
    });
  });

  describe('EMPTY_BOOST_CATEGORY', () => {
    it('包含 x2/x4/x8 空槽', () => {
      expect(EMPTY_BOOST_CATEGORY.x2).toEqual({ charges: 0, enabled: false });
      expect(EMPTY_BOOST_CATEGORY.x4).toEqual({ charges: 0, enabled: false });
      expect(EMPTY_BOOST_CATEGORY.x8).toEqual({ charges: 0, enabled: false });
    });
  });
});

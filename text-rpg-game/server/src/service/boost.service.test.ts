/**
 * BoostService 单元测试 - calcMultipliers、consumeChargesInMemory
 */
import { BoostService } from './boost.service';
import { getDefaultBoostConfig, BoostConfig } from '../types/player';

describe('BoostService', () => {
  describe('calcMultipliers', () => {
    it('null/undefined 返回全 1', () => {
      expect(BoostService.calcMultipliers(null)).toEqual({ exp: 1, gold: 1, drop: 1, reputation: 1 });
      expect(BoostService.calcMultipliers(undefined)).toEqual({ exp: 1, gold: 1, drop: 1, reputation: 1 });
    });

    it('空配置返回全 1', () => {
      const cfg = getDefaultBoostConfig();
      expect(BoostService.calcMultipliers(cfg)).toEqual({ exp: 1, gold: 1, drop: 1, reputation: 1 });
    });

    it('enabled 且有 charges 时累乘', () => {
      const cfg = getDefaultBoostConfig();
      cfg.exp.x2.charges = 10;
      cfg.exp.x2.enabled = true;
      expect(BoostService.calcMultipliers(cfg).exp).toBe(2);

      cfg.exp.x4.charges = 5;
      cfg.exp.x4.enabled = true;
      expect(BoostService.calcMultipliers(cfg).exp).toBe(8);

      cfg.gold.x2.charges = 1;
      cfg.gold.x2.enabled = true;
      expect(BoostService.calcMultipliers(cfg).gold).toBe(2);
    });

    it('charges 为 0 不参与计算', () => {
      const cfg = getDefaultBoostConfig();
      cfg.exp.x2.charges = 0;
      cfg.exp.x2.enabled = true;
      expect(BoostService.calcMultipliers(cfg).exp).toBe(1);
    });
  });

  describe('calcMultipliersFromMemory', () => {
    it('与 calcMultipliers 结果一致', () => {
      const cfg = getDefaultBoostConfig();
      cfg.drop.x2.charges = 3;
      cfg.drop.x2.enabled = true;
      expect(BoostService.calcMultipliersFromMemory(cfg)).toEqual(BoostService.calcMultipliers(cfg));
    });
  });

  describe('consumeChargesInMemory', () => {
    it('消耗 enabled 且有 charges 的 slot', () => {
      const cfg: BoostConfig = JSON.parse(JSON.stringify(getDefaultBoostConfig()));
      cfg.exp.x2.charges = 2;
      cfg.exp.x2.enabled = true;
      BoostService.consumeChargesInMemory(cfg);
      expect(cfg.exp.x2.charges).toBe(1);
      expect(cfg.exp.x2.enabled).toBe(true);
    });

    it('charges 减到 0 时 disabled', () => {
      const cfg: BoostConfig = JSON.parse(JSON.stringify(getDefaultBoostConfig()));
      cfg.gold.x2.charges = 1;
      cfg.gold.x2.enabled = true;
      BoostService.consumeChargesInMemory(cfg);
      expect(cfg.gold.x2.charges).toBe(0);
      expect(cfg.gold.x2.enabled).toBe(false);
    });
  });
});

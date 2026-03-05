import { getCurrentTime, generateToken, randomInt, clamp } from './helper';

describe('helper', () => {
  describe('getCurrentTime', () => {
    it('返回秒级时间戳', () => {
      const t = getCurrentTime();
      expect(typeof t).toBe('number');
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
    });
  });

  describe('generateToken', () => {
    it('生成有效 JWT', () => {
      const token = generateToken(123, 'secret');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('randomInt', () => {
    it('在 [min, max] 范围内', () => {
      for (let i = 0; i < 50; i++) {
        const n = randomInt(1, 10);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(10);
      }
    });

    it('min === max 时返回该值', () => {
      expect(randomInt(5, 5)).toBe(5);
    });
  });

  describe('clamp', () => {
    it('限制在 [min, max] 内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('边界值', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });
});

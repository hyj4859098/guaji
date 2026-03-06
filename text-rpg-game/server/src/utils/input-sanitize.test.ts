import { sanitizeUsername, sanitizePassword, sanitizeName } from './input-sanitize';

describe('input-sanitize', () => {
  describe('sanitizeUsername', () => {
    it('有效用户名返回原值', () => {
      expect(sanitizeUsername('abc')).toBe('abc');
      expect(sanitizeUsername('user123')).toBe('user123');
      expect(sanitizeUsername('中文名')).toBe('中文名');
    });
    it('过短返回 null', () => {
      expect(sanitizeUsername('a')).toBeNull();
    });
    it('过长返回 null', () => {
      expect(sanitizeUsername('a'.repeat(33))).toBeNull();
    });
    it('非法字符返回 null', () => {
      expect(sanitizeUsername('user@name')).toBeNull();
      expect(sanitizeUsername('user name')).toBeNull();
    });
    it('非字符串返回 null', () => {
      expect(sanitizeUsername(null)).toBeNull();
      expect(sanitizeUsername(123)).toBeNull();
    });
  });

  describe('sanitizePassword', () => {
    it('有效密码返回原值', () => {
      expect(sanitizePassword('123456')).toBe('123456');
    });
    it('边界长度 128 返回原值', () => {
      expect(sanitizePassword('a'.repeat(128))).toBe('a'.repeat(128));
    });
    it('过短返回 null', () => {
      expect(sanitizePassword('12345')).toBeNull();
    });
    it('过长返回 null', () => {
      expect(sanitizePassword('a'.repeat(129))).toBeNull();
    });
    it('非字符串返回 null', () => {
      expect(sanitizePassword(null)).toBeNull();
    });
  });

  describe('sanitizeName', () => {
    it('有效角色名返回原值', () => {
      expect(sanitizeName('角色')).toBe('角色');
      expect(sanitizeName('Player 1')).toBe('Player 1');
    });
    it('空或过长返回 null', () => {
      expect(sanitizeName('')).toBeNull();
      expect(sanitizeName('a'.repeat(33))).toBeNull();
    });
    it('NoSQL 注入字符返回 null', () => {
      expect(sanitizeName('{ "$gt": "" }')).toBeNull();
      expect(sanitizeName('test$inject')).toBeNull();
      expect(sanitizeName('test.inject')).toBeNull();
      expect(sanitizeName('test{inject')).toBeNull();
      expect(sanitizeName('test}inject')).toBeNull();
    });
    it('非字符串返回 null', () => {
      expect(sanitizeName(null)).toBeNull();
    });
  });
});

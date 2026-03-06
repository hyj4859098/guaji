import { hashPassword, verifyPassword, migratePasswordIfNeeded } from './password';

describe('password', () => {
  describe('hashPassword', () => {
    it('返回 bcrypt 哈希', async () => {
      const hashed = await hashPassword('test123');
      expect(hashed).toMatch(/^\$2[aby]\$/);
      expect(hashed).not.toBe('test123');
    });
  });

  describe('verifyPassword', () => {
    it('bcrypt 哈希正确密码返回 true', async () => {
      const hashed = await hashPassword('secret');
      expect(await verifyPassword('secret', hashed)).toBe(true);
    });
    it('bcrypt 哈希错误密码返回 false', async () => {
      const hashed = await hashPassword('secret');
      expect(await verifyPassword('wrong', hashed)).toBe(false);
    });
    it('明文存储时正确密码返回 true', async () => {
      expect(await verifyPassword('plain', 'plain')).toBe(true);
    });
    it('空密码或空存储返回 false', async () => {
      expect(await verifyPassword('', 'x')).toBe(false);
      expect(await verifyPassword('x', '')).toBe(false);
    });
  });

  describe('migratePasswordIfNeeded', () => {
    it('已是 bcrypt 返回 null', async () => {
      const hashed = await hashPassword('x');
      expect(await migratePasswordIfNeeded('x', hashed)).toBeNull();
    });
    it('明文且匹配时返回新哈希', async () => {
      const migrated = await migratePasswordIfNeeded('oldplain', 'oldplain');
      expect(migrated).toMatch(/^\$2[aby]\$/);
      expect(migrated).not.toBe('oldplain');
    });
    it('明文但不匹配返回 null', async () => {
      expect(await migratePasswordIfNeeded('a', 'b')).toBeNull();
    });
    it('空存储返回 null', async () => {
      expect(await migratePasswordIfNeeded('x', '')).toBeNull();
    });
  });
});

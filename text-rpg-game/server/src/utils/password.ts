/**
 * 密码安全：bcrypt 哈希
 * 兼容旧数据：若明文匹配则自动迁移为哈希
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !plain) return false;
  if (stored.startsWith('$2')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

export async function migratePasswordIfNeeded(plain: string, stored: string): Promise<string | null> {
  if (!stored || stored.startsWith('$2')) return null;
  if (plain !== stored) return null;
  return hashPassword(plain);
}

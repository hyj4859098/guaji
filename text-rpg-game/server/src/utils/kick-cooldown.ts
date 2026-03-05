/**
 * 被踢下线后的登录冷却，防止恶意刷登录
 */
const KICK_COOLDOWN_MS = 30 * 1000; // 30 秒
const kickedUntil = new Map<string, number>();

export function recordKicked(uid: number | string): void {
  const key = String(uid);
  kickedUntil.set(key, Date.now() + KICK_COOLDOWN_MS);
}

export function isInCooldown(uid: number | string): { ok: boolean; remainSeconds?: number } {
  const key = String(uid);
  const until = kickedUntil.get(key);
  if (!until) return { ok: true };
  const now = Date.now();
  if (now >= until) {
    kickedUntil.delete(key);
    return { ok: true };
  }
  const remainSeconds = Math.ceil((until - now) / 1000);
  return { ok: false, remainSeconds };
}

import { Uid } from '../types';

const DEFAULT_LOCK_TIMEOUT_MS = 30_000;

/**
 * 通用每用户串行锁：同一 key 的操作排队执行，避免并发竞态。
 * 可在多个 Service 中共享或各自持有独立的 locks Map。
 *
 * timeoutMs — 单次操作最长等待+执行时间，超时后 reject 并释放锁，
 * 防止 fn() 永不 resolve 导致该 key 下所有后续操作永久阻塞。
 */
export function withUserLock<T>(
  locks: Map<string, Promise<unknown>>,
  key: Uid | string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS
): Promise<T> {
  const k = String(key);
  const prev = locks.get(k) ?? Promise.resolve();
  let resolve!: () => void;
  const gate = new Promise<void>(r => { resolve = r; });
  locks.set(k, gate);

  return (async () => {
    try {
      await prev;
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new Error(`Lock timeout after ${timeoutMs}ms for key "${k}"`)), timeoutMs);
          (t as NodeJS.Timeout).unref();
        }),
      ]);
      return result;
    } finally {
      resolve();
      if (locks.get(k) === gate) locks.delete(k);
    }
  })();
}

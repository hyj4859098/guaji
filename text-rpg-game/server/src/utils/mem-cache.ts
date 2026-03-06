/**
 * 内存缓存（Map + TTL）
 * 用于减轻数据库读写压力，保证数据一致性需在更新时主动失效
 */
interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

export class MemCache<K = string, V = any> {
  private map = new Map<K, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = 60_000, maxSize: number = 10_000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    // 定期清理过期条目（每 5 分钟）
    this.cleanupTimer = setInterval(() => this.evictExpired(), 5 * 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry || Date.now() > entry.expireAt) {
      if (entry) this.map.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      this.evictExpired();
      if (this.map.size >= this.maxSize) {
        const firstKey = this.map.keys().next().value;
        if (firstKey !== undefined) this.map.delete(firstKey);
      }
    }
    const ms = ttlMs ?? this.ttlMs;
    this.map.set(key, {
      data: value,
      expireAt: Date.now() + ms
    });
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    return !!entry && Date.now() <= entry.expireAt;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  /** 清除所有过期条目 */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now > entry.expireAt) this.map.delete(key);
    }
  }

  /** 停止定期清理（用于测试 teardown） */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.map.clear();
  }
}

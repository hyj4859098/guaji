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

  constructor(ttlMs: number = 60_000) {
    this.ttlMs = ttlMs;
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
}

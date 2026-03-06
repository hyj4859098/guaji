import { MemCache } from './mem-cache';

describe('MemCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('set/get 正常存取', () => {
    const cache = new MemCache<string, number>(5000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('过期后 get 返回 null', () => {
    const cache = new MemCache<string, number>(1000);
    cache.set('a', 1);
    jest.advanceTimersByTime(1500);
    expect(cache.get('a')).toBeNull();
  });

  it('delete 后 get 返回 null', () => {
    const cache = new MemCache<string, number>();
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeNull();
  });

  it('has 未设置返回 false', () => {
    const cache = new MemCache<string, number>();
    expect(cache.has('x')).toBe(false);
  });

  it('has 设置后返回 true', () => {
    const cache = new MemCache<string, number>(5000);
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
  });

  it('has 过期后返回 false', () => {
    const cache = new MemCache<string, number>(1000);
    cache.set('a', 1);
    jest.advanceTimersByTime(1500);
    expect(cache.has('a')).toBe(false);
  });

  it('clear 清空后 get 返回 null', () => {
    const cache = new MemCache<string, number>();
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('size 返回条目数', () => {
    const cache = new MemCache<string, number>();
    expect(cache.size()).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);
    cache.delete('a');
    expect(cache.size()).toBe(1);
  });

  it('set 支持自定义 ttlMs', () => {
    const cache = new MemCache<string, number>(10000);
    cache.set('short', 1, 500);
    jest.advanceTimersByTime(600);
    expect(cache.get('short')).toBeNull();
  });
});

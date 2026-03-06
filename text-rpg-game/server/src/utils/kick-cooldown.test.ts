import { recordKicked, isInCooldown } from './kick-cooldown';

describe('kick-cooldown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('未 recordKicked 时 isInCooldown 返回 ok:true', () => {
    expect(isInCooldown(99999)).toEqual({ ok: true });
  });

  it('recordKicked 后 isInCooldown 返回 ok:false 和 remainSeconds', () => {
    recordKicked(1);
    const r = isInCooldown(1);
    expect(r.ok).toBe(false);
    expect(r.remainSeconds).toBeGreaterThan(0);
  });

  it('冷却结束后 isInCooldown 返回 ok:true', () => {
    recordKicked(2);
    jest.advanceTimersByTime(31 * 1000);
    expect(isInCooldown(2)).toEqual({ ok: true });
  });

  it('uid 支持数字和字符串', () => {
    recordKicked(123);
    expect(isInCooldown('123').ok).toBe(false);
  });
});

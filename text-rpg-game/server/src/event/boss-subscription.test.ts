import {
  subscribeBoss,
  unsubscribeBoss,
  getMapSubscriberUids,
  setSendToUser,
  setOnMapSubscribeChange,
  sendBossRespawnToSubscribers,
} from './boss-subscription';

describe('boss-subscription', () => {
  beforeEach(() => {
    unsubscribeBoss('u1');
    unsubscribeBoss('u2');
    setSendToUser(() => {});
    setOnMapSubscribeChange(null);
  });

  it('subscribeBoss 后 getMapSubscriberUids 返回该 uid', () => {
    subscribeBoss('u1', 1);
    expect(getMapSubscriberUids(1)).toContain('u1');
  });

  it('unsubscribeBoss 后不再在列表中', () => {
    subscribeBoss('u1', 1);
    unsubscribeBoss('u1');
    expect(getMapSubscriberUids(1)).toEqual([]);
  });

  it('多地图订阅独立', () => {
    subscribeBoss('u1', 1);
    subscribeBoss('u1', 2);
    expect(getMapSubscriberUids(1)).toContain('u1');
    expect(getMapSubscriberUids(2)).toContain('u1');
  });

  it('setOnMapSubscribeChange 在订阅时被调用', () => {
    const cb = jest.fn();
    setOnMapSubscribeChange(cb);
    subscribeBoss('u1', 1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('setOnMapSubscribeChange 在取消订阅时被调用', () => {
    const cb = jest.fn();
    setOnMapSubscribeChange(cb);
    subscribeBoss('u1', 1);
    cb.mockClear();
    unsubscribeBoss('u1');
    expect(cb).toHaveBeenCalled();
  });

  it('sendBossRespawnToSubscribers 无订阅者时不发送', () => {
    const sendFn = jest.fn();
    setSendToUser(sendFn);
    sendBossRespawnToSubscribers(1, 1, '测试Boss');
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('sendBossRespawnToSubscribers 有订阅者时发送', () => {
    const sendFn = jest.fn();
    setSendToUser(sendFn);
    subscribeBoss('u1', 1);
    sendBossRespawnToSubscribers(1, 1, '测试Boss');
    expect(sendFn).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'boss_respawn', data: expect.any(Object) }));
  });

  it('getMapSubscriberUids 无订阅返回空数组', () => {
    expect(getMapSubscriberUids(999)).toEqual([]);
  });
});

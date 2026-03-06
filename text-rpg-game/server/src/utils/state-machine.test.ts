import { BattleStateMachine } from './state-machine';
import { BattleState, BattleEvent } from '../types/state-machine';

describe('BattleStateMachine', () => {
  let fsm: BattleStateMachine;

  beforeEach(() => {
    fsm = new BattleStateMachine();
  });

  it('初始状态为 IDLE', () => {
    expect(fsm.getState()).toBe(BattleState.IDLE);
  });

  it('canStartBattle 在 IDLE 时为 true', () => {
    expect(fsm.canStartBattle()).toBe(true);
  });

  it('transition START_BATTLE 进入 BATTLE', async () => {
    const ok = await fsm.transition(BattleEvent.START_BATTLE);
    expect(ok).toBe(true);
    expect(fsm.getState()).toBe(BattleState.BATTLE);
  });

  it('transition 无效事件返回 false', async () => {
    const ok = await fsm.transition(BattleEvent.STOP_BATTLE);
    expect(ok).toBe(false);
    expect(fsm.getState()).toBe(BattleState.IDLE);
  });

  it('reset 回到 IDLE', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    fsm.reset();
    expect(fsm.getState()).toBe(BattleState.IDLE);
  });

  it('isFighting 在 BATTLE 时为 true', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    expect(fsm.isFighting()).toBe(true);
  });

  it('isFighting 在 SETTLEMENT 时为 true', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    await fsm.transition(BattleEvent.BATTLE_COMPLETE);
    expect(fsm.isFighting()).toBe(true);
  });

  it('isFighting 在 IDLE 时为 false', () => {
    expect(fsm.isFighting()).toBe(false);
  });

  it('canStopBattle 在 BATTLE 时为 true', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    expect(fsm.canStopBattle()).toBe(true);
  });

  it('canStopBattle 在 SETTLEMENT 时为 true', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    await fsm.transition(BattleEvent.BATTLE_COMPLETE);
    expect(fsm.canStopBattle()).toBe(true);
  });

  it('canStopBattle 在 IDLE 时为 false', () => {
    expect(fsm.canStopBattle()).toBe(false);
  });

  it('isFighting 在 AUTO_BATTLE 时为 true', async () => {
    await fsm.transition(BattleEvent.CONTINUE_AUTO_BATTLE);
    expect(fsm.isFighting()).toBe(true);
  });

  it('canStopBattle 在 AUTO_BATTLE 时为 true', async () => {
    await fsm.transition(BattleEvent.CONTINUE_AUTO_BATTLE);
    expect(fsm.canStopBattle()).toBe(true);
  });

  it('setStateData / getStateData', () => {
    fsm.setStateData({ uid: 1, enemyId: 2 } as any);
    expect(fsm.getStateData()).toMatchObject({ uid: 1, enemyId: 2 });
  });

  it('transition 带 data 参数更新 stateData', async () => {
    await fsm.transition(BattleEvent.START_BATTLE, { uid: 1, enemyId: 2 } as any);
    expect(fsm.getStateData()).toMatchObject({ uid: 1, enemyId: 2 });
  });

  it('transition BATTLE_COMPLETE 进入 SETTLEMENT', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    const ok = await fsm.transition(BattleEvent.BATTLE_COMPLETE);
    expect(ok).toBe(true);
    expect(fsm.getState()).toBe(BattleState.SETTLEMENT);
  });

  it('transition SETTLEMENT_COMPLETE 从 SETTLEMENT 回 BATTLE', async () => {
    await fsm.transition(BattleEvent.START_BATTLE);
    await fsm.transition(BattleEvent.BATTLE_COMPLETE);
    const ok = await fsm.transition(BattleEvent.SETTLEMENT_COMPLETE);
    expect(ok).toBe(true);
    expect(fsm.getState()).toBe(BattleState.BATTLE);
  });

  it('on 注册 handler 后 transition 会调用', async () => {
    const fn = jest.fn();
    fsm.on(BattleState.IDLE, BattleEvent.START_BATTLE, fn);
    await fsm.transition(BattleEvent.START_BATTLE);
    expect(fn).toHaveBeenCalled();
  });

  it('stateHandlers 不存在时 on 不报错', () => {
    const fsm2 = new BattleStateMachine();
    (fsm2 as any).handlers.clear();
    expect(() => fsm2.on(BattleState.IDLE, BattleEvent.START_BATTLE, async () => {})).not.toThrow();
  });
});

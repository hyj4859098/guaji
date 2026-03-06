import { BattleState, BattleEvent } from './state-machine';

describe('state-machine', () => {
  describe('BattleState', () => {
    it('应有正确状态值', () => {
      expect(BattleState.IDLE).toBe('idle');
      expect(BattleState.BATTLE).toBe('battle');
      expect(BattleState.AUTO_BATTLE).toBe('auto_battle');
      expect(BattleState.SETTLEMENT).toBe('settlement');
      expect(BattleState.END).toBe('end');
    });
  });

  describe('BattleEvent', () => {
    it('应有正确事件值', () => {
      expect(BattleEvent.START_BATTLE).toBe('start_battle');
      expect(BattleEvent.STOP_BATTLE).toBe('stop_battle');
      expect(BattleEvent.BATTLE_COMPLETE).toBe('battle_complete');
      expect(BattleEvent.SETTLEMENT_COMPLETE).toBe('settlement_complete');
      expect(BattleEvent.RESET).toBe('reset');
      expect(BattleEvent.CONTINUE_AUTO_BATTLE).toBe('continue_auto_battle');
    });
  });
});

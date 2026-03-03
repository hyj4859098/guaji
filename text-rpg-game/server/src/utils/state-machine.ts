import { BattleState, BattleEvent, BattleStateData, StateHandler } from '../types/state-machine';

export class BattleStateMachine {
  private currentState: BattleState = BattleState.IDLE;
  private stateData: BattleStateData | null = null;
  private handlers: Map<BattleState, Map<BattleEvent, StateHandler[]>> = new Map();

  constructor() {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    const states = [BattleState.IDLE, BattleState.BATTLE, BattleState.AUTO_BATTLE, BattleState.SETTLEMENT, BattleState.END];
    states.forEach(state => {
      this.handlers.set(state, new Map());
    });
  }

  getState(): BattleState {
    return this.currentState;
  }

  getStateData(): BattleStateData | null {
    return this.stateData;
  }

  setStateData(data: BattleStateData): void {
    this.stateData = data;
  }

  on(state: BattleState, event: BattleEvent, handler: StateHandler): void {
    const stateHandlers = this.handlers.get(state);
    if (stateHandlers) {
      if (!stateHandlers.has(event)) {
        stateHandlers.set(event, []);
      }
      stateHandlers.get(event)!.push(handler);
    }
  }

  async transition(event: BattleEvent, data?: Partial<BattleStateData>): Promise<boolean> {
    const validTransitions: Record<BattleState, Record<BattleEvent, BattleState | null>> = {
      [BattleState.IDLE]: {
        [BattleEvent.START_BATTLE]: BattleState.BATTLE,
        [BattleEvent.STOP_BATTLE]: null,
        [BattleEvent.BATTLE_COMPLETE]: null,
        [BattleEvent.SETTLEMENT_COMPLETE]: null,
        [BattleEvent.CONTINUE_AUTO_BATTLE]: BattleState.AUTO_BATTLE,
        [BattleEvent.RESET]: BattleState.IDLE
      },
      [BattleState.BATTLE]: {
        [BattleEvent.START_BATTLE]: null,
        [BattleEvent.STOP_BATTLE]: BattleState.END,
        [BattleEvent.BATTLE_COMPLETE]: BattleState.SETTLEMENT,
        [BattleEvent.SETTLEMENT_COMPLETE]: null,
        [BattleEvent.CONTINUE_AUTO_BATTLE]: null,
        [BattleEvent.RESET]: BattleState.END
      },
      [BattleState.AUTO_BATTLE]: {
        [BattleEvent.START_BATTLE]: BattleState.BATTLE,
        [BattleEvent.STOP_BATTLE]: BattleState.END,
        [BattleEvent.BATTLE_COMPLETE]: BattleState.SETTLEMENT,
        [BattleEvent.SETTLEMENT_COMPLETE]: BattleState.BATTLE,
        [BattleEvent.CONTINUE_AUTO_BATTLE]: null,
        [BattleEvent.RESET]: BattleState.END
      },
      [BattleState.SETTLEMENT]: {
        [BattleEvent.START_BATTLE]: null,
        [BattleEvent.STOP_BATTLE]: BattleState.END,
        [BattleEvent.BATTLE_COMPLETE]: null,
        [BattleEvent.SETTLEMENT_COMPLETE]: BattleState.BATTLE,
        [BattleEvent.CONTINUE_AUTO_BATTLE]: BattleState.BATTLE,
        [BattleEvent.RESET]: BattleState.END
      },
      [BattleState.END]: {
        [BattleEvent.START_BATTLE]: null,
        [BattleEvent.STOP_BATTLE]: null,
        [BattleEvent.BATTLE_COMPLETE]: null,
        [BattleEvent.SETTLEMENT_COMPLETE]: null,
        [BattleEvent.CONTINUE_AUTO_BATTLE]: null,
        [BattleEvent.RESET]: BattleState.IDLE
      }
    };

    const nextState = validTransitions[this.currentState][event];
    
    if (nextState === null) {
      console.log(`Invalid transition: ${this.currentState} -> ${event}`);
      return false;
    }

    // 先更新状态，然后再调用事件处理器
    const previousState = this.currentState;
    this.currentState = nextState;
    console.log(`State transition: ${event} -> ${nextState}`);

    // 如果传递了 data 参数，更新 stateData
    if (data) {
      this.stateData = { ...this.stateData, ...data } as BattleStateData;
    }

    const stateHandlers = this.handlers.get(previousState);
    if (stateHandlers) {
      const handlers = stateHandlers.get(event);
      if (handlers) {
        for (const handler of handlers) {
          await handler(this.stateData || {} as BattleStateData);
        }
      }
    }

    return true;
  }

  reset(): void {
    this.currentState = BattleState.IDLE;
    this.stateData = null;
  }

  isFighting(): boolean {
    return this.currentState === BattleState.BATTLE || this.currentState === BattleState.SETTLEMENT || this.currentState === BattleState.AUTO_BATTLE;
  }

  canStartBattle(): boolean {
    return this.currentState === BattleState.IDLE;
  }

  canStopBattle(): boolean {
    return this.currentState === BattleState.BATTLE || this.currentState === BattleState.SETTLEMENT || this.currentState === BattleState.AUTO_BATTLE;
  }
}

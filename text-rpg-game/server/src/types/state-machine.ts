import { Player } from './player';
import { Monster } from './monster';

export enum BattleState {
  IDLE = 'idle',
  BATTLE = 'battle',
  AUTO_BATTLE = 'auto_battle',
  SETTLEMENT = 'settlement',
  END = 'end'
}

export enum BattleEvent {
  START_BATTLE = 'start_battle',
  STOP_BATTLE = 'stop_battle',
  BATTLE_COMPLETE = 'battle_complete',
  SETTLEMENT_COMPLETE = 'settlement_complete',
  RESET = 'reset',
  CONTINUE_AUTO_BATTLE = 'continue_auto_battle'
}

export interface BattleLog {
  type: string;
  message: string;
  timestamp?: number;
}

export interface BattleResult {
  result: number;
  rounds: number;
  exp: number;
  gold: number;
  reputation: number;
  logs: BattleLog[];
  items?: any[];
}

export interface AutoHealConfig {
  hp_enabled: boolean;
  hp_threshold: number;  // 90-10，表示低于该百分比时补血
  hp_potion_bag_id?: number;
  mp_enabled: boolean;
  mp_threshold: number;
  mp_potion_bag_id?: number;
}

export interface BattleStateData {
  uid: number | string;
  enemyId: number;
  isAuto: boolean;
  maxRounds: number;
  currentRound: number;
  player: Player | null;
  monster: Monster | null;
  playerHP: number;
  monsterHP: number;
  logs: BattleLog[];
  result: BattleResult | null;
  auto_heal?: AutoHealConfig;
}

export interface StateTransition {
  from: BattleState;
  event: BattleEvent;
  to: BattleState;
}

export interface StateHandler {
  (data: BattleStateData): Promise<void>;
}

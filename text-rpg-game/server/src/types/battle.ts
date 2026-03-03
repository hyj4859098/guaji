import { IUserBase } from './index';
import { BattleResultEnum } from './enum';

export interface Battle extends IUserBase {
  enemy_id: number;
  result: BattleResultEnum;
  reward: string;
}

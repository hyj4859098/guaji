import { IUserBase } from './index';

export interface Bag extends IUserBase {
  item_id: number;
  count: number;
  equipment_uid?: string;
}

import { IUserBase } from './index';
import { AuctionStatusEnum } from './enum';

export interface Auction extends IUserBase {
  item_id: number;
  price: number;
  status: AuctionStatusEnum;
}

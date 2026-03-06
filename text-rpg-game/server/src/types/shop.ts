import { IBase } from './index';

export interface Shop extends IBase {
  shop_type: string;
  item_id: number;
  price: number;
  category: string;
  sort_order: number;
  enabled: boolean;
}

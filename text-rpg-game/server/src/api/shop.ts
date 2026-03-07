import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ShopService } from '../service/shop.service';
import { success } from '../utils/response';
import { shopListQuery, shopBuyBody } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const shopService = new ShopService();

router.get('/list', auth, validate(shopListQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const shopType = req.query.type as string;
  const items = await shopService.listByType(shopType);
  success(res, items);
}));

router.post('/buy', auth, validate(shopBuyBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { shop_item_id, count } = req.body;
  await shopService.buy(req.uid!, shop_item_id, count);
  success(res, { message: '购买成功' });
}));

router.get('/currencies', auth, async (_req: AuthRequest, res: Response) => {
  success(res, ShopService.getCurrencyMap());
});

export default router;

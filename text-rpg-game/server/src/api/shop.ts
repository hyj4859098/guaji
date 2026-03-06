import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ShopService } from '../service/shop.service';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { shopListQuery, shopBuyBody } from './schemas';

const router = Router();
const shopService = new ShopService();

router.get('/list', auth, validate(shopListQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopType = req.query.type as string;
    const items = await shopService.listByType(shopType);
    success(res, items);
  } catch (error) {
    logger.error('获取商店列表失败:', error);
    next(error);
  }
});

router.post('/buy', auth, validate(shopBuyBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shop_item_id, count } = req.body;
    await shopService.buy(req.uid!, shop_item_id, count);
    success(res, { message: '购买成功' });
  } catch (error) {
    next(error);
  }
});

router.get('/currencies', auth, async (_req: AuthRequest, res: Response) => {
  success(res, ShopService.getCurrencyMap());
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { ShopService } from '../service/shop.service';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

const router = Router();
const shopService = new ShopService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopType = (req.query.type as string) || 'gold';
    const items = await shopService.listByType(shopType);
    success(res, items);
  } catch (error) {
    logger.error('获取商店列表失败:', error);
    next(error);
  }
});

router.post('/buy', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shop_item_id, count } = req.body;
    if (!shop_item_id || !count) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少商品ID或数量');
    }
    await shopService.buy(req.uid!, Number(shop_item_id), Number(count));
    success(res, { message: '购买成功' });
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('商店购买失败:', error);
    next(error);
  }
});

router.get('/currencies', auth, async (_req: AuthRequest, res: Response) => {
  success(res, ShopService.getCurrencyMap());
});

export default router;

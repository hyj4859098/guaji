import { Router, Response, NextFunction } from 'express';
import { ShopService } from '../../service/shop.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const shopService = new ShopService();

router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const shopType = req.query.type as string | undefined;
    const items = await shopService.listAll(shopType);
    success(res, items);
  } catch (error) {
    logger.error('获取商店商品列表失败:', error);
    next(error);
  }
});

router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const item = await shopService.get(id);
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '商品不存在');
    success(res, item);
  } catch (error) {
    logger.error('获取商店商品失败:', error);
    next(error);
  }
});

router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { shop_type, item_id, price, category, sort_order, enabled } = req.body;
    if (!shop_type || !item_id || price == null) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少商店类型、物品ID或价格');
    }
    const id = await shopService.add({
      shop_type,
      item_id: Number(item_id),
      price: Number(price),
      category: category || 'consumable',
      sort_order: sort_order != null ? Number(sort_order) : 0,
      enabled: enabled !== false,
    });
    success(res, { id });
  } catch (error: any) {
    if (error.code) return fail(res, error.code, error.message);
    logger.error('新增商店商品失败:', error);
    next(error);
  }
});

router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const { shop_type, item_id, price, category, sort_order, enabled } = req.body;
    const updateData: any = {};
    if (shop_type != null) updateData.shop_type = shop_type;
    if (item_id != null) updateData.item_id = Number(item_id);
    if (price != null) updateData.price = Number(price);
    if (category != null) updateData.category = category;
    if (sort_order != null) updateData.sort_order = Number(sort_order);
    if (enabled != null) updateData.enabled = enabled;
    const ok = await shopService.update(id, updateData);
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '商品不存在');
  } catch (error: any) {
    if (error.code) return fail(res, error.code, error.message);
    logger.error('更新商店商品失败:', error);
    next(error);
  }
});

router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const ok = await shopService.delete(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '商品不存在');
  } catch (error) {
    logger.error('删除商店商品失败:', error);
    next(error);
  }
});

export default router;

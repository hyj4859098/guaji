import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { itemGetQuery, itemUseBody, itemUsageQuery } from './schemas';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { itemService } from '../service/item.service';

const router = Router();

router.get('/get', auth, validate(itemGetQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    logger.info(`获取物品 - uid: ${req.uid}, 物品ID: ${id}`);
    const item = await itemService.getItemById(Number(id));

    if (!item) {
      logger.warn(`物品不存在 - uid: ${req.uid}, 物品ID: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    }

    // 计算物品属性
    const attributes = await itemService.calculateItemAttributes(item);
    const itemWithAttributes = {
      ...item,
      attributes
    };

    logger.info(`物品获取成功 - uid: ${req.uid}, 物品ID: ${id}`);
    success(res, itemWithAttributes);
  } catch (error) {
    logger.error(`物品获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;
    logger.info(`获取物品列表 - uid: ${req.uid}, 类型: ${type || '全部'}`);
    
    let items;
    if (type) {
      items = await itemService.getItemsByType(Number(type));
    } else {
      items = await itemService.getAllItems();
    }

    // 为每个物品计算属性
    const itemsWithAttributes = await Promise.all(items.map(async (item: any) => ({
      ...item,
      attributes: await itemService.calculateItemAttributes(item)
    })));

    logger.info(`物品列表获取成功 - uid: ${req.uid}, 物品数量: ${items.length}`);
    success(res, itemsWithAttributes);
  } catch (error) {
    logger.error(`物品列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/use', auth, validate(itemUseBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bagItemId } = req.body;
    logger.info(`使用物品 - uid: ${req.uid}, 背包物品ID: ${bagItemId}`);
    const result = await itemService.useItem(req.uid!, bagItemId);

    if (!result.success) {
      logger.warn(`使用物品失败 - uid: ${req.uid}, 背包物品ID: ${bagItemId}, 原因: ${result.message}`);
      return fail(res, ErrorCode.INVALID_PARAMS, result.message);
    }

    logger.info(`物品使用成功 - uid: ${req.uid}, 背包物品ID: ${bagItemId}`);
    success(res, result.data, result.message);
  } catch (error) {
    logger.error(`使用物品失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.get('/usage', auth, validate(itemUsageQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.query;
    logger.info(`获取物品使用说明 - uid: ${req.uid}, 物品ID: ${itemId}`);
    const usage = await itemService.getItemUsage(Number(itemId));

    logger.info(`物品使用说明获取成功 - uid: ${req.uid}, 物品ID: ${itemId}`);
    success(res, { itemId: Number(itemId), usage });
  } catch (error) {
    logger.error(`获取物品使用说明失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

export default router;

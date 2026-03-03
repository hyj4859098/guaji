import { Router, Response, NextFunction } from 'express';
import { BagService } from '../service/bag.service';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';

const router = Router();
const bagService = new BagService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取背包列表 - uid: ${req.uid}`);
    const bags = await bagService.list(req.uid!);
    
    logger.info(`背包列表获取成功 - uid: ${req.uid}, 物品数量: ${bags.length}`);
    success(res, bags);
  } catch (error) {
    logger.error(`背包列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/add', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { item_id, count } = req.body;
    if (!item_id || !count) {
      logger.warn(`添加物品到背包失败 - uid: ${req.uid}, 缺少参数`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少参数');
    }
    
    logger.info(`添加物品到背包 - uid: ${req.uid}, 物品: ${JSON.stringify(req.body)}`);
    await bagService.addItem(req.uid!, item_id, count);

    logger.info(`物品添加成功 - uid: ${req.uid}, 物品ID: ${item_id}, 数量: ${count}`);
    success(res, null);
  } catch (error) {
    logger.error(`物品添加失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/use', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, count } = req.body;
    if (!id) {
      logger.warn(`使用物品失败 - uid: ${req.uid}, 缺少物品ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少物品ID');
    }
    const useCount = Math.max(1, Number(count) || 1);
    logger.info(`使用物品 - uid: ${req.uid}, 物品ID: ${id}, 数量: ${useCount}`);
    await bagService.useItem(req.uid!, id, useCount);

    logger.info(`物品使用成功 - uid: ${req.uid}, 物品ID: ${id}, 数量: ${useCount}`);
    success(res, null, `使用成功 ×${useCount}`);
  } catch (error) {
    const { id } = req.body;
    logger.error(`物品使用失败 - uid: ${req.uid}, 物品ID: ${id || '未知'}, 错误: ${error}`);
    next(error);
  }
});

router.post('/update', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, ...data } = req.body;
    logger.info(`更新背包物品 - uid: ${req.uid}, 物品ID: ${id}, 数据: ${JSON.stringify(data)}`);
    const successResult = await bagService.update(id, data);

    logger.info(`背包物品更新${successResult ? '成功' : '失败'} - uid: ${req.uid}, 物品ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`背包物品更新失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/delete', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    logger.info(`删除背包物品 - uid: ${req.uid}, 物品ID: ${id}`);
    const successResult = await bagService.delete(id);

    logger.info(`背包物品删除${successResult ? '成功' : '失败'} - uid: ${req.uid}, 物品ID: ${id}`);
    if (successResult) {
      success(res, null);
      const bags = await bagService.list(req.uid!);
      wsManager.sendToUser(req.uid!, { type: 'bag', data: bags });
    } else {
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`背包物品删除失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/wear', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    if (!id) {
      logger.warn(`穿戴装备失败 - uid: ${req.uid}, 缺少物品ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少物品ID');
    }
    logger.info(`穿戴装备 - uid: ${req.uid}, 物品ID: ${id}`);
    await bagService.wearItem(req.uid!, id);

    logger.info(`装备穿戴成功 - uid: ${req.uid}, 物品ID: ${id}`);
    success(res, null, '穿戴成功');
    const { EquipService } = require('../service/equip.service');
    const es = new EquipService();
    es.pushFullUpdate(req.uid!).catch(() => {});
  } catch (error) {
    const { id } = req.body;
    logger.error(`装备穿戴失败 - uid: ${req.uid}, 物品ID: ${id || '未知'}, 错误: ${error}`);
    next(error);
  }
});

export default router;

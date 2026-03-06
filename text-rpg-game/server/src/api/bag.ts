import { Router, Response, NextFunction } from 'express';
import { BagService } from '../service/bag.service';
import { EquipService } from '../service/equip.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { bagUseBody, bagDeleteBody, bagWearBody } from './schemas';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';

const router = Router();
const bagService = new BagService();
const equipService = new EquipService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取背包列表 - uid: ${req.uid}`);
    const payload = await bagService.getListPayload(req.uid!);
    
    logger.info(`背包列表获取成功 - uid: ${req.uid}, 物品数量: ${payload.items.length}`);
    success(res, payload);
  } catch (error) {
    logger.error(`背包列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

// 注意：玩家不可直接添加物品，防刷道具。物品来源：商店购买、战斗掉落、拍卖、GM 发放
router.post('/use', auth, validate(bagUseBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, count } = req.body;
    const useCount = count;
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

const BAG_UPDATE_WHITELIST = ['count'] as const;

router.post('/update', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, ...raw } = req.body;
    if (!id) return fail(res, ErrorCode.INVALID_PARAMS, '缺少物品ID');
    const data: Record<string, unknown> = {};
    for (const k of BAG_UPDATE_WHITELIST) {
      if (raw[k] !== undefined) data[k] = raw[k];
    }
    if (data.count !== undefined) {
      const c = Number(data.count);
      if (!Number.isInteger(c) || c < 1 || c > 9999) return fail(res, ErrorCode.INVALID_PARAMS, '数量无效');
      data.count = c;
    }
    if (Object.keys(data).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无有效更新字段');
    logger.info(`更新背包物品 - uid: ${req.uid}, 物品ID: ${id}, 数据: ${JSON.stringify(data)}`);
    const successResult = await bagService.update(id, data as any, req.uid);

    logger.info(`背包物品更新${successResult ? '成功' : '失败'} - uid: ${req.uid}, 物品ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '更新失败');
    }
  } catch (error) {
    next(error);
  }
});

router.post('/clear-equipment', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`一键清包 - uid: ${req.uid}`);
    const deleted = await bagService.clearAllEquipment(req.uid!);
    const payload = await bagService.getListPayload(req.uid!);
    wsManager.sendToUser(req.uid!, { type: 'bag', data: payload });
    logger.info(`一键清包完成 - uid: ${req.uid}, 删除装备数: ${deleted}`);
    success(res, { deleted }, `已清除 ${deleted} 件装备`);
  } catch (error) {
    logger.error(`一键清包失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/delete', auth, validate(bagDeleteBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    logger.info(`删除背包物品 - uid: ${req.uid}, 物品ID: ${id}`);
    const successResult = await bagService.delete(id, { uid: req.uid });

    logger.info(`背包物品删除${successResult ? '成功' : '失败'} - uid: ${req.uid}, 物品ID: ${id}`);
    if (successResult) {
      success(res, null);
      const payload = await bagService.getListPayload(req.uid!);
      wsManager.sendToUser(req.uid!, { type: 'bag', data: payload });
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '删除失败');
    }
  } catch (error) {
    next(error);
  }
});

router.post('/wear', auth, validate(bagWearBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    logger.info(`穿戴装备 - uid: ${req.uid}, 物品ID: ${id}`);
    await bagService.wearItem(req.uid!, id, equipService);

    logger.info(`装备穿戴成功 - uid: ${req.uid}, 物品ID: ${id}`);
    success(res, null, '穿戴成功');
    equipService.pushFullUpdate(req.uid!).catch(e => logger.warn('穿戴后推送更新失败', { uid: req.uid, error: e instanceof Error ? e.message : String(e) }));
  } catch (error) {
    const { id } = req.body;
    logger.error(`装备穿戴失败 - uid: ${req.uid}, 物品ID: ${id || '未知'}, 错误: ${error}`);
    next(error);
  }
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { PlayerService } from '../../service/player.service';
import { BagService } from '../../service/bag.service';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const playerService = new PlayerService();
const bagService = new BagService();

router.get('/items', async (req: any, res: Response, next: NextFunction) => {
  try {
    const items = await dataStorageService.list('item', undefined);
    success(res, items);
  } catch (error) {
    next(error);
  }
});

router.get('/:uid', async (req: any, res: Response, next: NextFunction) => {
  try {
    const uid = parseInt(req.params.uid);
    if (isNaN(uid)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的玩家UID');
    }
    
    const players = await playerService.list(uid);
    if (players.length === 0) {
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }
    
    success(res, players[0]);
  } catch (error) {
    logger.error('获取玩家信息失败:', error);
    next(error);
  }
});

router.post('/vip', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { uid, vip_level, duration_hours } = req.body;
    if (!uid || vip_level == null) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少 uid 或 vip_level');
    }

    const players = await playerService.list(uid);
    if (players.length === 0) {
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }

    const now = Math.floor(Date.now() / 1000);
    const expireTime = vip_level > 0 && duration_hours
      ? now + duration_hours * 3600
      : 0;

    await playerService.update(players[0].id, {
      vip_level: Number(vip_level),
      vip_expire_time: expireTime,
    } as any);

    logger.info('设置VIP成功', { uid, vip_level, expireTime });
    success(res, { uid, vip_level, vip_expire_time: expireTime });
  } catch (error) {
    logger.error('设置VIP失败:', error);
    next(error);
  }
});

router.post('/give-gold', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少 uid 或 amount');
    }
    const players = await playerService.list(uid);
    if (players.length === 0) {
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }
    await playerService.addGold(uid, Number(amount));
    const updated = await playerService.list(uid);
    logger.info('GM发放金币成功', { uid, amount, newGold: updated[0]?.gold });
    success(res, { uid, amount: Number(amount), gold: updated[0]?.gold });
  } catch (error) {
    logger.error('GM发放金币失败:', error);
    next(error);
  }
});

router.post('/give-item', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { uid, item_id, count } = req.body;
    if (!uid || !item_id || !count || count < 1) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少 uid、item_id 或 count');
    }

    const players = await playerService.list(uid);
    if (players.length === 0) {
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }

    const itemInfo = await dataStorageService.getByCondition('item', { id: Number(item_id) });
    if (!itemInfo) {
      return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    }

    await bagService.addItem(uid, Number(item_id), Number(count));
    logger.info('GM发放物品成功', { uid, item_id, count, item_name: itemInfo.name });
    success(res, { uid, item_id, item_name: itemInfo.name, count });
  } catch (error) {
    logger.error('GM发放物品失败:', error);
    next(error);
  }
});

export default router;
import { Router, Response, NextFunction } from 'express';
import { PlayerService } from '../service/player.service';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

const router = Router();
const playerService = new PlayerService();

router.get('/get', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    if (!id) {
      logger.warn(`获取玩家失败 - uid: ${req.uid}, 缺少玩家ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少玩家ID');
    }

    logger.info(`获取玩家 - uid: ${req.uid}, 玩家ID: ${id}`);
    const player = await playerService.get(Number(id));

    if (!player) {
      logger.warn(`玩家不存在 - uid: ${req.uid}, 玩家ID: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }

    logger.info(`玩家获取成功 - uid: ${req.uid}, 玩家ID: ${id}`);
    success(res, player);
  } catch (error) {
    logger.error(`玩家获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取玩家列表 - uid: ${req.uid}`);
    const players = await playerService.list(req.uid!);
    
    logger.info(`玩家列表获取成功 - uid: ${req.uid}, 玩家数量: ${players.length}`);
    success(res, players);
  } catch (error) {
    logger.error(`玩家列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/add', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) {
      logger.warn(`创建玩家失败 - uid: ${req.uid}, 缺少玩家名称`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少玩家名称');
    }

    logger.info(`创建玩家 - uid: ${req.uid}, 玩家名称: ${name}`);
    const id = await playerService.add({
      uid: req.uid!,
      ...req.body
    });

    logger.info(`玩家创建成功 - uid: ${req.uid}, 玩家ID: ${id}, 名称: ${name}`);
    success(res, { id });
  } catch (error) {
    logger.error(`玩家创建失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/update', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, ...data } = req.body;
    if (!id) {
      logger.warn(`更新玩家失败 - uid: ${req.uid}, 缺少玩家ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少玩家ID');
    }

    logger.info(`更新玩家 - uid: ${req.uid}, 玩家ID: ${id}, 数据: ${JSON.stringify(data)}`);
    const successResult = await playerService.update(id, data);

    logger.info(`玩家更新${successResult ? '成功' : '失败'} - uid: ${req.uid}, 玩家ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`玩家更新失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/delete', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    if (!id) {
      logger.warn(`删除玩家失败 - uid: ${req.uid}, 缺少玩家ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少玩家ID');
    }

    logger.info(`删除玩家 - uid: ${req.uid}, 玩家ID: ${id}`);
    const successResult = await playerService.delete(id);

    logger.info(`玩家删除${successResult ? '成功' : '失败'} - uid: ${req.uid}, 玩家ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`玩家删除失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

export default router;

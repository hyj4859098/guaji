import { Router, Response, NextFunction } from 'express';
import { PlayerService } from '../service/player.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { playerGetQuery, playerAddBody, playerDeleteBody } from './schemas';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { sanitizeName } from '../utils/input-sanitize';

const router = Router();
const playerService = new PlayerService();

router.get('/get', auth, validate(playerGetQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    logger.info(`获取玩家 - uid: ${req.uid}, 玩家ID: ${id}`);
    const player = await playerService.get(Number(id));

    if (!player) {
      logger.warn(`玩家不存在 - uid: ${req.uid}, 玩家ID: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }
    if (String(player.uid) !== String(req.uid)) {
      logger.warn(`获取玩家越权 - uid: ${req.uid}, 玩家归属: ${player.uid}`);
      return fail(res, ErrorCode.FORBIDDEN, '无权查看该角色');
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

router.post('/add', auth, validate(playerAddBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const name = sanitizeName(req.body?.name);
    if (!name) {
      return fail(res, ErrorCode.INVALID_PARAMS, '玩家名称含非法字符');
    }

    logger.info(`创建玩家 - uid: ${req.uid}, 玩家名称: ${name}`);
    const id = await playerService.add({ uid: req.uid!, name } as any);

    logger.info(`玩家创建成功 - uid: ${req.uid}, 玩家ID: ${id}, 名称: ${name}`);
    success(res, { id });
  } catch (error) {
    logger.error(`玩家创建失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

const PLAYER_UPDATE_WHITELIST = ['name', 'auto_battle_config'] as const;

router.post('/update', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, ...raw } = req.body;
    if (!id) {
      logger.warn(`更新玩家失败 - uid: ${req.uid}, 缺少玩家ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少玩家ID');
    }
    const player = await playerService.get(Number(id));
    if (!player) return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    if (String(player.uid) !== String(req.uid)) {
      logger.warn(`更新玩家越权 - uid: ${req.uid}, 玩家归属: ${player.uid}`);
      return fail(res, ErrorCode.FORBIDDEN, '无权操作该角色');
    }
    const data: Record<string, unknown> = {};
    for (const k of PLAYER_UPDATE_WHITELIST) {
      if (raw[k] !== undefined) data[k] = raw[k];
    }
    if (Object.keys(data).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无有效更新字段');
    if (data.name !== undefined) {
      const name = sanitizeName(data.name);
      if (!name) return fail(res, ErrorCode.INVALID_PARAMS, '玩家名称1-32位');
      data.name = name;
    }
    logger.info(`更新玩家 - uid: ${req.uid}, 玩家ID: ${id}, 数据: ${JSON.stringify(data)}`);
    const successResult = await playerService.update(Number(id), data as any);

    logger.info(`玩家更新${successResult ? '成功' : '失败'} - uid: ${req.uid}, 玩家ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '更新失败');
    }
  } catch (error) {
    next(error);
  }
});

router.post('/delete', auth, validate(playerDeleteBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    const player = await playerService.get(Number(id));
    if (!player) return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    if (String(player.uid) !== String(req.uid)) {
      logger.warn(`删除玩家越权 - uid: ${req.uid}, 玩家归属: ${player.uid}`);
      return fail(res, ErrorCode.FORBIDDEN, '无权操作该角色');
    }
    logger.info(`删除玩家 - uid: ${req.uid}, 玩家ID: ${id}`);
    const successResult = await playerService.delete(Number(id));

    logger.info(`玩家删除${successResult ? '成功' : '失败'} - uid: ${req.uid}, 玩家ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '删除失败');
    }
  } catch (error) {
    next(error);
  }
});

export default router;

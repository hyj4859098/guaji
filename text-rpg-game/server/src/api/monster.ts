import { Router, Response, NextFunction } from 'express';
import { MonsterService } from '../service/monster.service';
import { AuthRequest } from '../middleware/auth';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

const router = Router();
const monsterService = new MonsterService();

router.get('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('获取怪物列表');
    const monsters = await monsterService.list();
    logger.info(`怪物列表获取成功 - 怪物数量: ${monsters.length}`);
    success(res, monsters);
  } catch (error) {
    logger.error(`怪物列表获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.get('/get', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    if (!id) {
      logger.warn('获取怪物失败 - 缺少怪物ID');
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少怪物ID');
    }
    
    logger.info(`获取怪物 - 怪物ID: ${id}`);
    const monster = await monsterService.get(Number(id));

    if (!monster) {
      logger.warn(`怪物不存在 - 怪物ID: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }

    logger.info(`怪物获取成功 - 怪物ID: ${id}`);
    success(res, monster);
  } catch (error) {
    logger.error(`怪物获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.get('/level', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { min, max } = req.query;
    if (!min || !max) {
      logger.warn('获取怪物失败 - 缺少等级范围');
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少等级范围');
    }
    
    logger.info(`获取怪物 - 等级范围: ${min}-${max}`);
    const monsters = await monsterService.listByLevel(Number(min), Number(max));

    logger.info(`怪物获取成功 - 怪物数量: ${monsters.length}`);
    success(res, monsters);
  } catch (error) {
    logger.error(`怪物获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.get('/map', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { map_id } = req.query;
    if (!map_id) {
      logger.warn('获取怪物失败 - 缺少地图ID');
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少地图ID');
    }
    
    logger.info(`获取怪物 - 地图ID: ${map_id}`);
    const monsters = await monsterService.listByMapId(Number(map_id));

    logger.info(`怪物获取成功 - 怪物数量: ${monsters.length}`);
    success(res, monsters);
  } catch (error) {
    logger.error(`怪物获取失败 - 错误: ${error}`);
    next(error);
  }
});

export default router;

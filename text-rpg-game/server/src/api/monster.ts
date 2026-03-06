import { Router, Response, NextFunction } from 'express';
import { MonsterService } from '../service/monster.service';
import { AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { monsterGetQuery, monsterLevelQuery, monsterMapQuery } from './schemas';

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

router.get('/get', validate(monsterGetQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.query.id as unknown as number;
    
    logger.info(`获取怪物 - 怪物ID: ${id}`);
    const monster = await monsterService.get(id);

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

router.get('/level', validate(monsterLevelQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const min = req.query.min as unknown as number;
    const max = req.query.max as unknown as number;
    
    logger.info(`获取怪物 - 等级范围: ${min}-${max}`);
    const monsters = await monsterService.listByLevel(min, max);

    logger.info(`怪物获取成功 - 怪物数量: ${monsters.length}`);
    success(res, monsters);
  } catch (error) {
    logger.error(`怪物获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.get('/map', validate(monsterMapQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const map_id = req.query.map_id as unknown as number;
    
    logger.info(`获取怪物 - 地图ID: ${map_id}`);
    const monsters = await monsterService.listByMapId(map_id);

    logger.info(`怪物获取成功 - 怪物数量: ${monsters.length}`);
    success(res, monsters);
  } catch (error) {
    logger.error(`怪物获取失败 - 错误: ${error}`);
    next(error);
  }
});

export default router;

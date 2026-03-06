import { Router, Response, NextFunction } from 'express';
import { MapService } from '../service/map.service';
import { auth, adminAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { mapGetQuery, mapAddBody, mapUpdateBody, mapDeleteBody } from './schemas';

const router = Router();
const mapService = new MapService();

router.get('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('获取地图列表');
    const maps = await mapService.list();
    logger.info(`地图列表获取成功 - 地图数量: ${maps.length}`);
    success(res, maps);
  } catch (error) {
    logger.error(`地图列表获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.get('/get', validate(mapGetQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.query.id as unknown as number;
    
    logger.info(`获取地图 - 地图ID: ${id}`);
    const map = await mapService.get(id);

    if (!map) {
      logger.warn(`地图不存在 - 地图ID: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
    }

    logger.info(`地图获取成功 - 地图ID: ${id}`);
    success(res, map);
  } catch (error) {
    logger.error(`地图获取失败 - 错误: ${error}`);
    next(error);
  }
});

router.post('/add', adminAuth, validate(mapAddBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;

    logger.info(`添加地图 - 地图名称: ${name}`);
    const id = await mapService.add({ name });

    logger.info(`地图添加成功 - 地图ID: ${id}, 名称: ${name}`);
    success(res, { id });
  } catch (error) {
    logger.error(`地图添加失败 - 错误: ${error}`);
    next(error);
  }
});

router.post('/update', adminAuth, validate(mapUpdateBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, name } = req.body;

    logger.info(`更新地图 - 地图ID: ${id}, 名称: ${name}`);
    const successResult = await mapService.update(id, { name });

    if (!successResult) {
      logger.warn(`更新地图失败 - 地图不存在: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
    }

    logger.info(`地图更新成功 - 地图ID: ${id}, 名称: ${name}`);
    success(res, null);
  } catch (error) {
    logger.error(`地图更新失败 - 错误: ${error}`);
    next(error);
  }
});

router.post('/delete', adminAuth, validate(mapDeleteBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;

    logger.info(`删除地图 - 地图ID: ${id}`);
    const successResult = await mapService.delete(id);

    if (!successResult) {
      logger.warn(`删除地图失败 - 地图不存在: ${id}`);
      return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
    }

    logger.info(`地图删除成功 - 地图ID: ${id}`);
    success(res, null);
  } catch (error) {
    logger.error(`地图删除失败 - 错误: ${error}`);
    next(error);
  }
});

export default router;

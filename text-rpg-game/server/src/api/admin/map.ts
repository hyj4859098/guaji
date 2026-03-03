import { Router, Response, NextFunction } from 'express';
import { MapService } from '../../service/map.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const mapService = new MapService();

/** 获取地图列表 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const maps = await mapService.list();
    success(res, maps);
  } catch (error) {
    logger.error('获取地图列表失败:', error);
    next(error);
  }
});

/** 获取单个地图 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的地图ID');
    const map = await mapService.get(id);
    if (!map) return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
    success(res, map);
  } catch (error) {
    logger.error('获取地图失败:', error);
    next(error);
  }
});

/** 新增地图 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, name, description, level_min, level_max } = req.body;
    if (!name) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称');
    const now = Math.floor(Date.now() / 1000);
    const data: any = {
      name,
      description: description ?? '',
      level_min: level_min != null ? Number(level_min) : undefined,
      level_max: level_max != null ? Number(level_max) : undefined,
      create_time: now,
      update_time: now
    };
    if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) data.id = Number(bodyId);
    const id = await mapService.add(data);
    success(res, { id });
  } catch (error) {
    logger.error('新增地图失败:', error);
    next(error);
  }
});

/** 更新地图 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的地图ID');
    const { name, description, level_min, level_max } = req.body;
    if (!name) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称');
    const ok = await mapService.update(id, {
      name,
      description: description ?? '',
      level_min: level_min != null ? Number(level_min) : undefined,
      level_max: level_max != null ? Number(level_max) : undefined,
      update_time: Math.floor(Date.now() / 1000)
    });
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '地图不存在');
  } catch (error) {
    logger.error('更新地图失败:', error);
    next(error);
  }
});

/** 删除地图 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的地图ID');
    const ok = await mapService.delete(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '地图不存在');
  } catch (error) {
    logger.error('删除地图失败:', error);
    next(error);
  }
});

export default router;
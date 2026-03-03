import { Router, Response, NextFunction } from 'express';
import { LevelExpService } from '../../service/level_exp.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const levelExpService = new LevelExpService();

/** 获取等级经验列表 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const levels = await levelExpService.list();
    success(res, levels);
  } catch (error) {
    logger.error('获取等级经验列表失败:', error);
    next(error);
  }
});

/** 获取单条等级经验 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const level = await levelExpService.get(id);
    if (!level) return fail(res, ErrorCode.NOT_FOUND, '等级不存在');
    success(res, level);
  } catch (error) {
    logger.error('获取等级失败:', error);
    next(error);
  }
});

/** 新增等级经验 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, level, exp } = req.body;
    if (level == null || exp == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少等级或经验值');
    const now = Math.floor(Date.now() / 1000);
    const data: any = {
      level: Number(level),
      exp: Number(exp),
      create_time: now,
      update_time: now
    };
    if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) data.id = Number(bodyId);
    const id = await levelExpService.add(data);
    success(res, { id });
  } catch (error) {
    logger.error('新增等级经验失败:', error);
    next(error);
  }
});

/** 更新等级经验 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const { level, exp } = req.body;
    if (level == null || exp == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少等级或经验值');
    const ok = await levelExpService.update(id, {
      level: Number(level),
      exp: Number(exp),
      update_time: Math.floor(Date.now() / 1000)
    });
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '等级不存在');
  } catch (error) {
    logger.error('更新等级经验失败:', error);
    next(error);
  }
});

/** 删除等级经验 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const ok = await levelExpService.delete(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '等级不存在');
  } catch (error) {
    logger.error('删除等级经验失败:', error);
    next(error);
  }
});

export default router;
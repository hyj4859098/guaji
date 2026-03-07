import { Router, Response } from 'express';
import { LevelExpService } from '../service/level_exp.service';
import { auth, adminAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const levelExpService = new LevelExpService();

router.get('/get', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, level } = req.query;
  
  let levelExp;
  if (level) {
    logger.info(`获取经验配置 - uid: ${req.uid}, 等级: ${level}`);
    levelExp = await levelExpService.getExpByLevel(Number(level));
  } else if (id) {
    logger.info(`获取经验配置 - uid: ${req.uid}, ID: ${id}`);
    levelExp = await levelExpService.get(Number(id));
  } else {
    logger.warn(`获取经验配置失败 - uid: ${req.uid}, 缺少参数`);
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少参数');
  }

  if (!levelExp) {
    return success(res, { level: Number(level || id), exp: 0, is_max_level: true });
  }

  logger.info(`经验配置获取成功 - uid: ${req.uid}`);
  success(res, levelExp);
}));

router.get('/list', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  logger.info(`获取经验配置列表 - uid: ${req.uid}`);
  const levelExps = await levelExpService.list();
  
  logger.info(`经验配置列表获取成功 - uid: ${req.uid}, 数量: ${levelExps.length}`);
  success(res, levelExps);
}));

router.post('/add', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { level, exp } = req.body;
  if (!level || exp === undefined) {
    logger.warn(`添加经验配置失败 - uid: ${req.uid}, 缺少参数`);
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少参数');
  }

  logger.info(`添加经验配置 - uid: ${req.uid}, 等级: ${level}, 经验: ${exp}`);
  const id = await levelExpService.add({
    level,
    exp
  });

  logger.info(`经验配置添加成功 - uid: ${req.uid}, ID: ${id}`);
  success(res, { id });
}));

router.post('/update', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, ...data } = req.body;
  if (!id) {
    logger.warn(`更新经验配置失败 - uid: ${req.uid}, 缺少ID`);
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少ID');
  }

  logger.info(`更新经验配置 - uid: ${req.uid}, ID: ${id}, 数据: ${JSON.stringify(data)}`);
  const successResult = await levelExpService.update(id, data);

  logger.info(`经验配置更新${successResult ? '成功' : '失败'} - uid: ${req.uid}, ID: ${id}`);
  if (successResult) {
    success(res, null);
  } else {
    return fail(res, ErrorCode.SYSTEM_ERROR, '更新失败');
  }
}));

router.post('/delete', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少ID');
  }

  const successResult = await levelExpService.delete(id);
  if (successResult) {
    success(res, null);
  } else {
    return fail(res, ErrorCode.SYSTEM_ERROR, '删除失败');
  }
}));

export default router;
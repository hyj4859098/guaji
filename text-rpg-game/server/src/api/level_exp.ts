import { Router, Response, NextFunction } from 'express';
import { LevelExpService } from '../service/level_exp.service';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

const router = Router();
const levelExpService = new LevelExpService();

router.get('/get', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
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
      logger.warn(`经验配置不存在 - uid: ${req.uid}`);
      return fail(res, ErrorCode.NOT_FOUND, '经验配置不存在');
    }

    logger.info(`经验配置获取成功 - uid: ${req.uid}`);
    success(res, levelExp);
  } catch (error) {
    logger.error(`经验配置获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取经验配置列表 - uid: ${req.uid}`);
    const levelExps = await levelExpService.list();
    
    logger.info(`经验配置列表获取成功 - uid: ${req.uid}, 数量: ${levelExps.length}`);
    success(res, levelExps);
  } catch (error) {
    logger.error(`经验配置列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/add', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    logger.error(`经验配置添加失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/update', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
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
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`经验配置更新失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/delete', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    if (!id) {
      logger.warn(`删除经验配置失败 - uid: ${req.uid}, 缺少ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少ID');
    }

    logger.info(`删除经验配置 - uid: ${req.uid}, ID: ${id}`);
    const successResult = await levelExpService.delete(id);

    logger.info(`经验配置删除${successResult ? '成功' : '失败'} - uid: ${req.uid}, ID: ${id}`);
    if (successResult) {
      success(res, null);
    } else {
      fail(res, 1, 'failed');
    }
  } catch (error) {
    logger.error(`经验配置删除失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

export default router;
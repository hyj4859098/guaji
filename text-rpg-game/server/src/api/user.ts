import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../service/data-storage.service';
import { generateToken } from '../utils/helper';
import { logger } from '../utils/logger';
import { config } from '../config';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

const router = Router();

router.post('/login', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      logger.warn('登录失败 - 缺少用户名或密码');
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名或密码');
    }
    
    logger.info(`用户登录 - 用户名: ${username}`);
    const user = await dataStorageService.getByCondition('user', { username });
    
    if (!user) {
      logger.warn(`登录失败 - 用户不存在: ${username}`);
      return fail(res, ErrorCode.NOT_FOUND, '用户不存在');
    }
    
    if (user.password !== password) {
      logger.warn(`登录失败 - 密码错误: ${username}`);
      return fail(res, ErrorCode.UNAUTHORIZED, '密码错误');
    }

    // 优先用数字 id；只有 _id 的老用户用 _id 字符串，这样和已有角色数据的 uid 一致，能查到角色
    let uid: number | string;
    if (user.id != null && user.id !== '') {
      uid = user.id;
    } else if (user._id) {
      uid = typeof user._id === 'string' ? user._id : String(user._id);
      logger.info(`老用户使用 _id 作为 uid - 用户名: ${username}, uid: ${uid}`);
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '用户数据异常');
    }
    
    const token = generateToken(uid, config.jwt_secret);
    
    logger.info(`登录成功 - 用户ID: ${uid}, 用户名: ${username}`);
    success(res, {
      token,
      uid
    });
  } catch (error) {
    logger.error(`登录失败 - 错误: ${error}`);
    next(error);
  }
});

router.post('/register', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      logger.warn('注册失败 - 缺少用户名或密码');
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名或密码');
    }
    
    logger.info(`用户注册 - 用户名: ${username}`);
    const existing = await dataStorageService.getByCondition('user', { username });
    
    if (existing) {
      logger.warn(`注册失败 - 用户名已存在: ${username}`);
      return fail(res, ErrorCode.INVALID_PARAMS, '用户名已存在');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const userId = await dataStorageService.insert('user', {
      username,
      password,
      create_time: now,
      update_time: now
    });
    
    const token = generateToken(userId, config.jwt_secret);
    
    logger.info(`注册成功 - 用户ID: ${userId}, 用户名: ${username}`);
    success(res, {
      token,
      uid: userId
    });
  } catch (error) {
    logger.error(`注册失败 - 错误: ${error}`);
    next(error);
  }
});

export default router;

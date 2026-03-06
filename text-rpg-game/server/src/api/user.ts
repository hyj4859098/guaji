import { Router, Request, Response, NextFunction } from 'express';
import { authLimiter } from '../middleware/rate-limit';
import { dataStorageService } from '../service/data-storage.service';
import { generateToken } from '../utils/helper';
import { logger } from '../utils/logger';
import { config } from '../config';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { isInCooldown } from '../utils/kick-cooldown';
import { verifyPassword, migratePasswordIfNeeded, hashPassword } from '../utils/password';
import { sanitizeUsername, sanitizePassword } from '../utils/input-sanitize';

const router = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = sanitizePassword(req.body?.password);

    if (!username || !password) {
      logger.warn('登录失败 - 用户名或密码格式无效');
      return fail(res, ErrorCode.INVALID_PARAMS, '用户名2-32位字母数字或中文，密码6-128位');
    }

    const clientIp = getClientIp(req);
    logger.info(`用户登录 - 用户名: ${username}, IP: ${clientIp}`);
    const user = await dataStorageService.getByCondition('user', { username });

    if (!user) {
      logger.warn(`登录失败 - 用户不存在: ${username}`);
      return fail(res, ErrorCode.NOT_FOUND, '用户不存在');
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      logger.warn(`登录失败 - 密码错误: ${username}`);
      return fail(res, ErrorCode.UNAUTHORIZED, '密码错误');
    }

    const hashed = await migratePasswordIfNeeded(password, user.password);
    if (hashed) {
      const updateFilter = user.id != null ? { id: user.id } : { _id: user._id };
      await dataStorageService.updateByFilter('user', updateFilter, { password: hashed });
      logger.info(`密码已迁移为哈希: ${username}`);
    }

    // IP 锁已暂时关闭（测试阶段）。多 IP 踢下线由 WebSocket 重复登录逻辑处理。

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

    // 被踢后 30 秒内禁止再次登录
    const cooldown = isInCooldown(uid);
    if (!cooldown.ok) {
      logger.warn(`登录失败 - 冷却中: ${username}, 剩余 ${cooldown.remainSeconds} 秒`);
      return fail(res, ErrorCode.FORBIDDEN, `账号已被踢出，请 ${cooldown.remainSeconds} 秒后再试`);
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

router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = sanitizePassword(req.body?.password);

    if (!username || !password) {
      logger.warn('注册失败 - 用户名或密码格式无效');
      return fail(res, ErrorCode.INVALID_PARAMS, '用户名2-32位字母数字或中文，密码6-128位');
    }

    const clientIp = getClientIp(req);
    logger.info(`用户注册 - 用户名: ${username}, IP: ${clientIp}`);
    const existing = await dataStorageService.getByCondition('user', { username });

    if (existing) {
      logger.warn(`注册失败 - 用户名已存在: ${username}`);
      return fail(res, ErrorCode.INVALID_PARAMS, '用户名已存在');
    }

    const hashed = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    const userId = await dataStorageService.insert('user', {
      username,
      password: hashed,
      last_login_ip: clientIp,
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

import { Router, Response } from 'express';
import { authLimiter } from '../../middleware/rate-limit';
import { adminAuth } from '../../middleware/auth';
import { dataStorageService } from '../../service/data-storage.service';
import { generateToken } from '../../utils/helper';
import { config } from '../../config';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { verifyPassword } from '../../utils/password';
import { sanitizeUsername, sanitizePassword } from '../../utils/input-sanitize';
import { asyncHandler } from '../../middleware/async-handler';
import { logger } from '../../utils/logger';
import { Collections } from '../../config/collections';
import { playerCache, equippedSkillsCache, monsterCache } from '../../service/cache.service';

const router = Router();

/**
 * 管理员登录
 */
router.post('/login', authLimiter, asyncHandler(async (req: any, res: Response) => {
  const username = sanitizeUsername(req.body?.username);
  const password = sanitizePassword(req.body?.password);

  if (!username || !password) {
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名或密码');
  }

  const user = await dataStorageService.getByCondition(Collections.USER, { username });

  if (!user) {
    return fail(res, ErrorCode.UNAUTHORIZED, '用户名或密码错误');
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return fail(res, ErrorCode.UNAUTHORIZED, '用户名或密码错误');
  }
  
  // 检查是否是管理员
  if (!user.is_admin) {
    return fail(res, ErrorCode.UNAUTHORIZED, '权限不足');
  }

  // uid 与玩家端一致：有数字 id 用数字，否则用 _id 字符串，方便 adminAuth 按 _id 或 id 查
  const uid = user.id != null && user.id !== '' ? user.id : (typeof user._id === 'string' ? user._id : String(user._id));
  const token = generateToken(uid, config.jwt_secret);

  success(res, {
    token,
    uid,
    username: user.username
  });
}));

/**
 * 清除缓存
 */
router.post('/clear-cache', adminAuth, asyncHandler(async (req: any, res: Response) => {
  const { type } = req.body;
  
  const validTypes = ['monster', 'skill', 'map', 'item', 'level_exp', 'player', 'all'];
  if (!validTypes.includes(type)) {
    return fail(res, ErrorCode.INVALID_PARAMS, '无效的缓存类型');
  }

  const cleared: string[] = [];
  if (type === 'monster' || type === 'all') {
    monsterCache.clear();
    cleared.push('monster');
  }
  if (type === 'skill' || type === 'all') {
    equippedSkillsCache.clear();
    cleared.push('skill');
  }
  if (type === 'player' || type === 'all') {
    playerCache.clear();
    cleared.push('player');
  }
  if (type === 'all') {
    cleared.push('map', 'item', 'level_exp');
  }

  logger.info('GM清除缓存', { type, cleared });
  success(res, { message: `缓存清除成功: ${cleared.join(', ')}` });
}));

export default router;
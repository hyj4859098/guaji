import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { generateToken } from '../../utils/helper';
import { config } from '../../config';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * 管理员登录
 */
router.post('/login', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名或密码');
    }
    
    // 检查用户是否存在
    const user = await dataStorageService.getByCondition('user', { username, password });
    
    if (!user) {
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
  } catch (error) {
    logger.error('管理员登录失败:', error);
    next(error);
  }
});

/**
 * 清除缓存
 */
router.post('/clear-cache', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;
    
    // 由于已移除Redis，缓存清除功能已简化
    const validTypes = ['monster', 'skill', 'map', 'item', 'level_exp'];
    if (!validTypes.includes(type)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的缓存类型');
    }
    
    success(res, { message: '缓存清除成功' });
  } catch (error) {
    logger.error('清除缓存失败:', error);
    next(error);
  }
});

export default router;
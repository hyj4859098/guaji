import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();

/** 解绑用户 IP，允许该账号在新 IP 登录（管理员操作） */
router.post('/unbind-ip', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username } = req.body;
    if (!username) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名');
    }

    const user = await dataStorageService.getByCondition('user', { username });
    if (!user) {
      return fail(res, ErrorCode.NOT_FOUND, '用户不存在');
    }

    const filter = user.id != null ? { id: user.id } : { _id: user._id };
    await dataStorageService.updateByFilter('user', filter, { last_login_ip: null });
    logger.info(`管理员解绑 IP: ${username}`);
    success(res, { message: '已解绑，该账号下次登录时将绑定新 IP' });
  } catch (error) {
    logger.error('解绑 IP 失败:', error);
    next(error);
  }
});

export default router;

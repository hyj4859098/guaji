import { Router } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';
import { adminHandler } from './admin-utils';
import { validate } from '../../middleware/validate';
import { adminUnbindIpBody } from '../schemas';

const router = Router();

router.post('/unbind-ip', validate(adminUnbindIpBody), adminHandler(async (req, res) => {
    const { username } = req.body;

    const user = await dataStorageService.getByCondition('user', { username });
    if (!user) {
      return fail(res, ErrorCode.NOT_FOUND, '用户不存在');
    }

    const filter = user.id != null ? { id: user.id } : { _id: user._id };
    await dataStorageService.updateByFilter('user', filter, { last_login_ip: null });
    logger.info(`管理员解绑 IP: ${username}`);
    success(res, { message: '已解绑，该账号下次登录时将绑定新 IP' });
}, '解绑 IP 失败'));

export default router;

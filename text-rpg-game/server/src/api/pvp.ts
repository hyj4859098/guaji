import { Router, Response } from 'express';
import { pvpService } from '../service/pvp.service';
import { auth, AuthRequest } from '../middleware/auth';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.get('/opponent', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const raw = req.query.uid;
  const targetUid: number | string | null = raw != null
    ? (typeof raw === 'number' ? raw : typeof raw === 'string' ? (Number(raw) || raw) : null)
    : null;
  if (!targetUid) {
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少 uid');
  }
  const opponent = await pvpService.getOpponentForDisplay(targetUid);
  if (!opponent) {
    return fail(res, ErrorCode.NOT_FOUND, '对手不存在');
  }
  success(res, opponent);
}));

router.post('/challenge', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { target_uid, map_id } = req.body;
  const targetUid = target_uid != null ? (Number(target_uid) || target_uid) : null;
  const mapId = map_id != null ? Number(map_id) : 0;

  if (!targetUid) {
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少 target_uid');
  }
  if (!mapId || mapId <= 0) {
    return fail(res, ErrorCode.INVALID_PARAMS, '缺少或无效的 map_id');
  }

  const result = await pvpService.challenge(req.uid!, targetUid, mapId);
  if (!result.ok) {
    return fail(res, ErrorCode.INVALID_PARAMS, result.error || '挑战失败');
  }
  success(res, { status: 'started' });
}));

export default router;

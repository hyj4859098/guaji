import { Router, Response, NextFunction } from 'express';
import { PvpService } from '../service/pvp.service';
import { auth, AuthRequest } from '../middleware/auth';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

const router = Router();
const pvpService = new PvpService();

router.get('/opponents', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const list = await pvpService.getOpponents(req.uid!);
    success(res, list);
  } catch (error) {
    logger.error('获取对手列表失败', { uid: req.uid, error });
    next(error);
  }
});

router.get('/info', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const info = await pvpService.getMyPvpInfo(req.uid!);
    success(res, info);
  } catch (error) {
    logger.error('获取 PVP 信息失败', { uid: req.uid, error });
    next(error);
  }
});

router.get('/ranking', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const list = await pvpService.getRanking();
    success(res, list);
  } catch (error) {
    logger.error('获取排行榜失败', { uid: req.uid, error });
    next(error);
  }
});

router.get('/records', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const list = await pvpService.getRecords(req.uid!);
    success(res, list);
  } catch (error) {
    logger.error('获取战斗记录失败', { uid: req.uid, error });
    next(error);
  }
});

router.post('/challenge', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { target_uid } = req.body;
    if (!target_uid) return fail(res, ErrorCode.INVALID_PARAMS, '缺少对手 UID');
    const result = await pvpService.challenge(req.uid!, target_uid);
    success(res, result);
  } catch (error: any) {
    logger.error('PVP 挑战失败', { uid: req.uid, error: error?.message });
    fail(res, ErrorCode.INVALID_PARAMS, error?.message || 'PVP 挑战失败');
  }
});

export default router;

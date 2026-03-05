import { Router, Response, NextFunction } from 'express';
import { BossService } from '../service/boss.service';
import { auth, AuthRequest } from '../middleware/auth';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

const router = Router();
const bossService = new BossService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mapId = req.query.map_id != null ? Number(req.query.map_id) : undefined;
    const list = await bossService.getBossList(req.uid!, mapId);
    success(res, list);
  } catch (error) {
    logger.error('获取 Boss 列表失败', { uid: req.uid, error });
    next(error);
  }
});

router.get('/get', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.query.id);
    if (!id) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 Boss ID');
    const boss = await bossService.getBoss(id);
    if (!boss) return fail(res, ErrorCode.INVALID_PARAMS, 'Boss 不存在');
    success(res, boss);
  } catch (error) {
    logger.error('获取 Boss 详情失败', { uid: req.uid, error });
    next(error);
  }
});

router.post('/challenge', auth, async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const { boss_id, auto_heal } = req.body;
    if (!boss_id) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 Boss ID');
    const result = await bossService.challenge(req.uid!, boss_id, auto_heal);
    success(res, result);
  } catch (error: any) {
    logger.error('Boss 挑战失败', { uid: req.uid, error: error?.message });
    fail(res, ErrorCode.INVALID_PARAMS, error?.message || 'Boss 挑战失败');
  }
});

router.post('/stop', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ok = bossService.stopBattle(req.uid!);
    success(res, { success: ok });
  } catch (error: any) {
    logger.error('Boss 停止失败', { uid: req.uid, error: error?.message });
    next(error);
  }
});

export default router;

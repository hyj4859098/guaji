import { Router, Response } from 'express';
import { BossService } from '../service/boss.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { bossChallengeBody } from './schemas';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const bossService = new BossService();

router.get('/list', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const mapId = req.query.map_id != null ? Number(req.query.map_id) : undefined;
  const list = await bossService.getBossList(req.uid!, mapId);
  success(res, list);
}));

router.get('/get', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.query.id);
  if (!id) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 Boss ID');
  const boss = await bossService.getBoss(id);
  if (!boss) return fail(res, ErrorCode.INVALID_PARAMS, 'Boss 不存在');
  success(res, boss);
}));

router.post('/challenge', auth, validate(bossChallengeBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { boss_id, auto_heal } = req.body;
  const result = await bossService.challenge(req.uid!, boss_id, auto_heal);
  success(res, result);
}));

router.post('/stop', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const ok = bossService.stopBattle(req.uid!);
  success(res, { success: ok });
}));

export default router;

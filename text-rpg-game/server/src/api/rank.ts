import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { rankService } from '../service/rank.service';
import { success } from '../utils/response';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.get('/list', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = (req.query.type as string) || 'gold';
  const validTypes = ['gold', 'level'];
  const rankType = validTypes.includes(type) ? (type as 'gold' | 'level') : 'gold';
  const page = req.query.page != null ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : 20;

  const result = await rankService.getRanking(rankType, page, pageSize);
  success(res, result);
}));

export default router;

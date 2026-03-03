import { Router, Response, NextFunction } from 'express';
import { BoostService } from '../service/boost.service';
import { auth, AuthRequest } from '../middleware/auth';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { BoostCategoryKey, BoostMultiplierKey } from '../types/player';

const router = Router();
const boostService = new BoostService();

router.get('/config', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await boostService.getBoostConfig(req.uid!);
    success(res, config);
  } catch (error) {
    next(error);
  }
});

router.post('/toggle', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, multiplier, enabled } = req.body;
    if (!category || !multiplier || enabled === undefined) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少参数');
    }

    const validCats: BoostCategoryKey[] = ['exp', 'gold', 'drop', 'reputation'];
    const validMuls: BoostMultiplierKey[] = ['x2', 'x4', 'x8'];
    if (!validCats.includes(category) || !validMuls.includes(multiplier)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的类别或倍率');
    }

    const ok = await boostService.toggleBoost(req.uid!, category, multiplier, !!enabled);
    if (!ok) return fail(res, ErrorCode.SYSTEM_ERROR, '切换失败');
    const config = await boostService.getBoostConfig(req.uid!);
    success(res, config);
  } catch (error) {
    next(error);
  }
});

export default router;

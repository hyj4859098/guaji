/**
 * 游戏配置 API - 供前端读取（如强化材料 ID 等），避免硬编码
 */
import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { success } from '../utils/response';
import { getEnhanceMaterialIds } from '../service/enhance-config.service';

const router = Router();

/** 获取强化材料配置（stone/lucky/anti_explode/blessing_oil 的 item_id） */
router.get('/enhance_materials', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ids = await getEnhanceMaterialIds();
    success(res, ids);
  } catch (error) {
    next(error);
  }
});

export default router;

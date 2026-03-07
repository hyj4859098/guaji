/**
 * 游戏配置 API - 供前端读取（如强化材料 ID、WS 地址等），避免硬编码
 */
import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { success } from '../utils/response';
import { getEnhanceMaterialIds } from '../service/enhance-config.service';
import { config } from '../config';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

/** 客户端运行时配置（公开，无需登录）- WS 地址等 */
router.get('/client', (req, res: Response) => {
  const host = (req.headers.host || '').split(':')[0] || 'localhost';
  const wsUrl = config.ws_url || `ws://${host}:${config.ws_port}`;
  success(res, { wsPort: config.ws_port, wsUrl });
});

/** 获取强化材料配置（stone/lucky/anti_explode/blessing_oil 的 item_id） */
router.get('/enhance_materials', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = await getEnhanceMaterialIds();
  success(res, ids);
}));

export default router;

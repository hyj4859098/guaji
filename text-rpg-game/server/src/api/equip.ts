import { Router, Response } from 'express';
import { EquipService } from '../service/equip.service';
import { EquipInstanceService } from '../service/equip_instance.service';
import { EquipUpgradeService } from '../service/equip_upgrade.service';
import { EquipBlessingService } from '../service/equip_blessing.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { success, fail } from '../utils/response';
import { ErrorCode, createError } from '../utils/error';
import { equipWearBody, equipRemoveBody, equipEnhanceBody, equipBlessBody, equipTradeBody } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const equipService = new EquipService();
const equipInstanceService = new EquipInstanceService();
const equipUpgradeService = new EquipUpgradeService();
const equipBlessingService = new EquipBlessingService();

router.get('/list', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const equips = await equipService.list(req.uid!);
  success(res, equips);
}));

router.post('/wear', auth, validate(equipWearBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.body;
  await equipService.wearEquip(req.uid!, id);
  success(res, null, '穿戴成功');
  equipService.pushFullUpdate(req.uid!).catch(() => {});
}));

router.post('/remove', auth, validate(equipRemoveBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.body;
  await equipService.removeEquip(req.uid!, id);
  success(res, null, '卸下成功');
  equipService.pushFullUpdate(req.uid!).catch(() => {});
}));

router.post('/enhance', auth, validate(equipEnhanceBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { instance_id, use_lucky_charm, use_anti_explode } = req.body;
  const result = await equipUpgradeService.enhance(req.uid!, Number(instance_id), {
    useLuckyCharm: !!use_lucky_charm,
    useAntiExplode: !!use_anti_explode,
  });
  if (result.broken) {
    success(res, { broken: true }, result.message || '强化失败，装备已破碎');
  } else if (result.success) {
    success(res, { broken: false, enhance_level: result.enhance_level }, result.message || '强化成功');
  } else {
    success(res, { broken: false }, result.message || '强化失败');
  }
}));

router.post('/bless', auth, validate(equipBlessBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { instance_id } = req.body;
  const result = await equipBlessingService.bless(req.uid!, Number(instance_id));
  if (result.success) {
    success(res, { blessing_level: result.blessing_level }, result.message);
  } else {
    success(res, { blessing_level: result.blessing_level }, result.message);
  }
}));

router.post('/trade', auth, validate(equipTradeBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { instance_id, buyer_uid } = req.body;
  if (buyer_uid === req.uid) {
    return fail(res, ErrorCode.INVALID_PARAMS, '不能与自己交易');
  }
  const result = await equipInstanceService.tradeToUser(req.uid!, buyer_uid, instance_id);
  if (result) {
    success(res, null, '交易成功');
  } else {
    throw createError(ErrorCode.SYSTEM_ERROR, '交易失败');
  }
}));

export default router;

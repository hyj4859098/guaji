import { Router, Response, NextFunction } from 'express';
import { EquipService } from '../service/equip.service';
import { EquipInstanceService } from '../service/equip_instance.service';
import { EquipUpgradeService } from '../service/equip_upgrade.service';
import { EquipBlessingService } from '../service/equip_blessing.service';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

const router = Router();
const equipService = new EquipService();
const equipInstanceService = new EquipInstanceService();
const equipUpgradeService = new EquipUpgradeService();
const equipBlessingService = new EquipBlessingService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取装备列表 - uid: ${req.uid}`);
    const equips = await equipService.list(req.uid!);
    
    logger.info(`装备列表获取成功 - uid: ${req.uid}, 装备数量: ${equips.length}`);
    success(res, equips);
  } catch (error) {
    logger.error(`装备列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/wear', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    if (!id) {
      logger.warn(`穿戴装备失败 - uid: ${req.uid}, 缺少装备ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少装备ID');
    }
    logger.info(`穿戴装备 - uid: ${req.uid}, 装备ID: ${id}`);
    const successResult = await equipService.wearEquip(req.uid!, id);

    logger.info(`装备穿戴${successResult ? '成功' : '失败'} - uid: ${req.uid}, 装备ID: ${id}`);
    if (successResult) {
      success(res, null, '穿戴成功');
      equipService.pushFullUpdate(req.uid!).catch(() => {});
    } else {
      fail(res, 1, '穿戴失败');
    }
  } catch (error) {
    const { id } = req.body;
    logger.error(`装备穿戴失败 - uid: ${req.uid}, 装备ID: ${id || '未知'}, 错误: ${error}`);
    next(error);
  }
});

router.post('/remove', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    if (!id) {
      logger.warn(`卸下装备失败 - uid: ${req.uid}, 缺少装备ID`);
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少装备ID');
    }
    logger.info(`卸下装备 - uid: ${req.uid}, 装备ID: ${id}`);
    const successResult = await equipService.removeEquip(req.uid!, id);

    logger.info(`装备卸下${successResult ? '成功' : '失败'} - uid: ${req.uid}, 装备ID: ${id}`);
    if (successResult) {
      success(res, null, '卸下成功');
      equipService.pushFullUpdate(req.uid!).catch(() => {});
    } else {
      fail(res, 1, '卸下失败');
    }
  } catch (error) {
    const { id } = req.body;
    logger.error(`装备卸下失败 - uid: ${req.uid}, 装备ID: ${id || '未知'}, 错误: ${error}`);
    next(error);
  }
});

router.post('/enhance', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { instance_id, use_lucky_charm, use_anti_explode } = req.body;
    if (!instance_id) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少装备实例ID');
    }
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
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message || '强化失败');
    }
    logger.error(`装备强化失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/bless', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { instance_id } = req.body;
    if (!instance_id) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少装备实例ID');
    }
    const result = await equipBlessingService.bless(req.uid!, Number(instance_id));
    if (result.success) {
      success(res, { blessing_level: result.blessing_level }, result.message);
    } else {
      success(res, { blessing_level: result.blessing_level }, result.message);
    }
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message || '祝福失败');
    }
    logger.error(`装备祝福失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/trade', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { instance_id, buyer_uid } = req.body;
    if (!instance_id || !buyer_uid) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少装备实例ID或买家ID');
    }
    const result = await equipInstanceService.tradeToUser(req.uid!, buyer_uid, Number(instance_id));
    if (result) {
      success(res, null, '交易成功');
    } else {
      fail(res, 1, '交易失败');
    }
  } catch (error) {
    logger.error(`装备交易失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

export default router;

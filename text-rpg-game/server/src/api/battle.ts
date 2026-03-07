import { Router, Response } from 'express';
import { BattleService } from '../service/battle.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BattleResultEnum } from '../types/enum';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { battleStartBody, battleAutoBody } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const battleService = new BattleService();

router.post('/start', auth, validate(battleStartBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { enemy_id, auto_heal } = req.body;

  logger.info(`开始战斗 - uid: ${req.uid}, 敌人ID: ${enemy_id}`);
  const battleResult = await battleService.startBattle(req.uid!, enemy_id, auto_heal);
  
  if (battleResult.result === BattleResultEnum.LOSE && battleResult.rounds === 0 && battleResult.exp === 0) {
    logger.warn(`开始战斗失败 - uid: ${req.uid}, 已经在战斗中`);
    return fail(res, ErrorCode.INVALID_PARAMS, '您已经在战斗中');
  }
  
  logger.info(`战斗结束 - uid: ${req.uid}, 结果: ${battleResult.result}`);
  success(res, battleResult);
}));

router.post('/auto', auth, validate(battleAutoBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { enemy_id, auto_heal } = req.body;

  logger.info(`自动战斗 - uid: ${req.uid}, 敌人ID: ${enemy_id}`);
  const started = await battleService.startAutoBattle(req.uid!, enemy_id, auto_heal);

  if (!started) {
    logger.warn(`自动战斗失败 - uid: ${req.uid}, 已经在战斗中`);
    return fail(res, ErrorCode.INVALID_PARAMS, '您已经在战斗中');
  }

  logger.info(`自动战斗已启动 - uid: ${req.uid}`);
  success(res, { status: 'started' });
}));

router.post('/resume', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  logger.info(`恢复自动战斗 - uid: ${req.uid}`);
  const result = await battleService.resumeAutoBattle(req.uid!);

  logger.info(`恢复自动战斗完成 - uid: ${req.uid}, 离线战斗: ${result.offlineBattles}, 死亡: ${result.died}, 已恢复: ${result.resumed}`);
  success(res, result);
}));

router.post('/stop', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  logger.info(`停止战斗 - uid: ${req.uid}`);
  const successResult = await battleService.stopBattle(req.uid!);
  
  logger.info(`停止战斗${successResult ? '成功' : '失败'} - uid: ${req.uid}`);
  success(res, { success: successResult });
}));

router.get('/status', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  logger.info(`获取战斗状态 - uid: ${req.uid}`);
  const status = await battleService.getBattleStatus(req.uid!);
  
  logger.info(`获取战斗状态成功 - uid: ${req.uid}`);
  success(res, status);
}));

export default router;

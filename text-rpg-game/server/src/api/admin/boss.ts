import { Router, Response, NextFunction } from 'express';
import { BossService } from '../../service/boss.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const bossService = new BossService();

router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const list = await bossService.getBossList('');
    success(res, list);
  } catch (error) {
    logger.error('获取 Boss 列表失败:', error);
    next(error);
  }
});

router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的 Boss ID');
    const boss = await bossService.getBoss(id);
    if (!boss) return fail(res, ErrorCode.NOT_FOUND, 'Boss 不存在');
    success(res, boss);
  } catch (error) {
    logger.error('获取 Boss 信息失败:', error);
    next(error);
  }
});

router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, elem_metal, elem_wood, elem_water, elem_fire, elem_earth, description } = req.body;
    if (!name || !level || !hp) return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');

    const now = Math.floor(Date.now() / 1000);
    const bossData: any = {
      name,
      level,
      hp,
      mp: mp || 0,
      phy_atk: phy_atk || 0,
      phy_def: phy_def || 0,
      mag_atk: mag_atk || 0,
      mag_def: mag_def || 0,
      hit_rate: hit_rate || 0,
      dodge_rate: dodge_rate || 0,
      crit_rate: crit_rate || 0,
      exp: exp || 0,
      gold: gold || 0,
      reputation: reputation || 0,
      map_id: map_id || 1,
      elem_metal: elem_metal || 0,
      elem_wood: elem_wood || 0,
      elem_water: elem_water || 0,
      elem_fire: elem_fire || 0,
      elem_earth: elem_earth || 0,
      description: description || '',
      skill1: '',
      skill2: '',
      create_time: now,
      update_time: now,
    };
    if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) {
      bossData.id = Number(bodyId);
    }

    const id = await bossService.add(bossData);
    success(res, { id });
  } catch (error) {
    logger.error('新增 Boss 失败:', error);
    next(error);
  }
});

router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的 Boss ID');

    const { name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, elem_metal, elem_wood, elem_water, elem_fire, elem_earth, description } = req.body;
    if (!name || !level || !hp) return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');

    const bossData = {
      name,
      level,
      hp,
      mp: mp || 0,
      phy_atk: phy_atk || 0,
      phy_def: phy_def || 0,
      mag_atk: mag_atk || 0,
      mag_def: mag_def || 0,
      hit_rate: hit_rate || 0,
      dodge_rate: dodge_rate || 0,
      crit_rate: crit_rate || 0,
      exp: exp || 0,
      gold: gold || 0,
      reputation: reputation || 0,
      map_id: map_id || 1,
      elem_metal: elem_metal || 0,
      elem_wood: elem_wood || 0,
      elem_water: elem_water || 0,
      elem_fire: elem_fire || 0,
      elem_earth: elem_earth || 0,
      description: description || '',
      skill1: '',
      skill2: '',
      update_time: Math.floor(Date.now() / 1000),
    };

    const ok = await bossService.update(id, bossData);
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, 'Boss 不存在');
  } catch (error) {
    logger.error('更新 Boss 失败:', error);
    next(error);
  }
});

router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的 Boss ID');

    const ok = await bossService.delete(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, 'Boss 不存在');
  } catch (error) {
    logger.error('删除 Boss 失败:', error);
    next(error);
  }
});

export default router;

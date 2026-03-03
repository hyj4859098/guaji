import { Router, Response, NextFunction } from 'express';
import { MonsterService } from '../../service/monster.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const monsterService = new MonsterService();

/**
 * 获取怪物列表
 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const monsters = await monsterService.list();
    success(res, monsters);
  } catch (error) {
    logger.error('获取怪物列表失败:', error);
    next(error);
  }
});

/**
 * 获取单个怪物信息
 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的怪物ID');
    }
    
    const monster = await monsterService.get(id);
    if (!monster) {
      return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
    
    success(res, monster);
  } catch (error) {
    logger.error('获取怪物信息失败:', error);
    next(error);
  }
});

/**
 * 新增怪物
 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, elem_metal, elem_wood, elem_water, elem_fire, elem_earth, description } = req.body;
    
    if (!name || !level || !hp) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const monsterData: any = {
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
      update_time: now
    };
    if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) {
      monsterData.id = Number(bodyId);
    }
    
    const id = await monsterService.add(monsterData);
    success(res, { id });
  } catch (error) {
    logger.error('新增怪物失败:', error);
    next(error);
  }
});

/**
 * 更新怪物
 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的怪物ID');
    }
    
    const { name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, elem_metal, elem_wood, elem_water, elem_fire, elem_earth, description } = req.body;
    
    if (!name || !level || !hp) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const monsterData = {
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
      update_time: Math.floor(Date.now() / 1000)
    };
    
    const successFlag = await monsterService.update(id, monsterData);
    if (successFlag) {
      success(res, { message: '更新成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
  } catch (error) {
    logger.error('更新怪物失败:', error);
    next(error);
  }
});

/**
 * 删除怪物
 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的怪物ID');
    }
    
    const successFlag = await monsterService.delete(id);
    if (successFlag) {
      success(res, { message: '删除成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
  } catch (error) {
    logger.error('删除怪物失败:', error);
    next(error);
  }
});

export default router;
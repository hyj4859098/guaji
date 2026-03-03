import { Router, Response, NextFunction } from 'express';
import { SkillService } from '../../service/skill.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const skillService = new SkillService();

/**
 * 获取技能列表
 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const skills = await skillService.list();
    success(res, skills);
  } catch (error) {
    logger.error('获取技能列表失败:', error);
    next(error);
  }
});

/**
 * 获取单个技能信息
 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的技能ID');
    }
    
    const skill = await skillService.get(id);
    if (!skill) {
      return fail(res, ErrorCode.NOT_FOUND, '技能不存在');
    }
    
    success(res, skill);
  } catch (error) {
    logger.error('获取技能信息失败:', error);
    next(error);
  }
});

/**
 * 新增技能
 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, name, type, damage, mp_cost, cooldown, description, cost, probability, book_id, is_equipped } = req.body;
    
    if (!name || type == null) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const skillData: any = {
      uid: 0,
      name,
      type,
      cost: cost ?? mp_cost ?? 0,
      damage: damage || 0,
      probability: probability ?? 100,
      book_id: book_id || 0,
      is_equipped: is_equipped || 0,
      create_time: now,
      update_time: now
    };
    if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) {
      skillData.id = Number(bodyId);
    }
    
    const id = await skillService.add(skillData);
    success(res, { id });
  } catch (error) {
    logger.error('新增技能失败:', error);
    next(error);
  }
});

/**
 * 更新技能
 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的技能ID');
    }
    
    const { name, type, damage, mp_cost, cooldown, description, cost, probability, book_id, is_equipped } = req.body;
    
    if (!name || type == null) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const skillData = {
      name,
      type,
      cost: cost ?? mp_cost ?? 0,
      damage: damage || 0,
      probability: probability ?? 100,
      book_id: book_id || 0,
      is_equipped: is_equipped || 0,
      description: description || '',
      update_time: Math.floor(Date.now() / 1000)
    };
    
    const successFlag = await skillService.update(id, skillData);
    if (successFlag) {
      success(res, { message: '更新成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '技能不存在');
    }
  } catch (error) {
    logger.error('更新技能失败:', error);
    next(error);
  }
});

/**
 * 删除技能
 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的技能ID');
    }
    
    const successFlag = await skillService.delete(id);
    if (successFlag) {
      success(res, { message: '删除成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '技能不存在');
    }
  } catch (error) {
    logger.error('删除技能失败:', error);
    next(error);
  }
});

export default router;
import { Router, Response, NextFunction } from 'express';
import { SkillService } from '../service/skill.service';
import { BagService } from '../service/bag.service';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { skillLearnBody, skillEquipBody, skillUnequipBody } from './schemas';
import { logger } from '../utils/logger';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

const router = Router();
const skillService = new SkillService();
const bagService = new BagService();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取技能列表 - uid: ${req.uid}`);
    const skills = await skillService.list(req.uid!);
    
    logger.info(`技能列表获取成功 - uid: ${req.uid}, 技能数量: ${skills.length}`);
    success(res, skills);
  } catch (error) {
    logger.error(`技能列表获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

router.post('/learn', auth, validate(skillLearnBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { book_id } = req.body;
    
    logger.info(`学习技能 - uid: ${req.uid}, 技能书ID: ${book_id}`);
    const successResult = await skillService.learnSkill(req.uid!, book_id, bagService);

    logger.info(`技能学习${successResult ? '成功' : '失败'} - uid: ${req.uid}, 技能书ID: ${book_id}`);
    if (successResult) {
      success(res, null, '学习成功');
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '学习失败');
    }
  } catch (error) {
    next(error);
  }
});

router.post('/equip', auth, validate(skillEquipBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { skill_id } = req.body;
    
    logger.info(`装备技能 - uid: ${req.uid}, 技能ID: ${skill_id}`);
    const successResult = await skillService.equipSkill(req.uid!, skill_id);

    logger.info(`技能装备${successResult ? '成功' : '失败'} - uid: ${req.uid}, 技能ID: ${skill_id}`);
    if (successResult) {
      success(res, null, '装备成功');
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '装备失败');
    }
  } catch (error) {
    next(error);
  }
});

router.post('/unequip', auth, validate(skillUnequipBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { skill_id } = req.body;
    
    logger.info(`卸下技能 - uid: ${req.uid}, 技能ID: ${skill_id}`);
    const successResult = await skillService.unequipSkill(req.uid!, skill_id);

    logger.info(`技能卸下${successResult ? '成功' : '失败'} - uid: ${req.uid}, 技能ID: ${skill_id}`);
    if (successResult) {
      success(res, null, '卸下成功');
    } else {
      return fail(res, ErrorCode.SYSTEM_ERROR, '卸下失败');
    }
  } catch (error) {
    next(error);
  }
});

router.get('/equipped', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`获取已装备技能 - uid: ${req.uid}`);
    const equippedSkills = await skillService.getEquippedSkills(req.uid!);
    
    logger.info(`已装备技能获取成功 - uid: ${req.uid}`);
    success(res, equippedSkills);
  } catch (error) {
    logger.error(`已装备技能获取失败 - uid: ${req.uid}, 错误: ${error}`);
    next(error);
  }
});

export default router;

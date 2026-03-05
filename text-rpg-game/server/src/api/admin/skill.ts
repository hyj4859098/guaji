import { Router } from 'express';
import { SkillService } from '../../service/skill.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminList, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();
const skillService = new SkillService();

router.get('/', adminList(skillService, '获取技能列表失败'));
router.get('/:id', adminGetById(skillService, '技能', '获取技能信息失败'));

router.post('/', adminHandler(async (req, res) => {
    const { id: bodyId, name, type, damage, mp_cost, cost, probability, book_id, is_equipped } = req.body;
    
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
}, '新增技能失败'));

router.put('/:id', adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, '技能ID');
    if (id == null) return;
    const { name, type, damage, mp_cost, description, cost, probability, book_id, is_equipped } = req.body;
    
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
    if (successFlag) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '技能不存在');
}, '更新技能失败'));

router.delete('/:id', adminDelete(skillService, '技能', '删除技能失败'));

export default router;
import { Router } from 'express';
import { LevelExpService } from '../../service/level_exp.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminList, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();
const levelExpService = new LevelExpService();

router.get('/', adminList(levelExpService, '获取等级经验列表失败'));
router.get('/:id', adminGetById(levelExpService, '等级', '获取等级失败'));

router.post('/', adminHandler(async (req, res) => {
  const { id: bodyId, level, exp } = req.body;
  if (level == null || exp == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少等级或经验值');
  const now = Math.floor(Date.now() / 1000);
  const data: any = { level: Number(level), exp: Number(exp), create_time: now, update_time: now };
  if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) data.id = Number(bodyId);
  const id = await levelExpService.add(data);
  success(res, { id });
}, '新增等级经验失败'));

router.put('/:id', adminHandler(async (req, res) => {
  const id = parseIdParam(req, res, 'ID');
  if (id == null) return;
  const { level, exp } = req.body;
  if (level == null || exp == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少等级或经验值');
  const ok = await levelExpService.update(id, {
    level: Number(level), exp: Number(exp), update_time: Math.floor(Date.now() / 1000)
  });
  if (ok) success(res, { message: '更新成功' });
  else fail(res, ErrorCode.NOT_FOUND, '等级不存在');
}, '更新等级经验失败'));

router.delete('/:id', adminDelete(levelExpService, '等级', '删除等级失败'));

export default router;

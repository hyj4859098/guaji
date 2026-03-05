import { Router } from 'express';
import { MapService } from '../../service/map.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminList, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();
const mapService = new MapService();

router.get('/', adminList(mapService, '获取地图列表失败'));
router.get('/:id', adminGetById(mapService, '地图', '获取地图失败'));

router.post('/', adminHandler(async (req, res) => {
  const { id: bodyId, name, description, level_min, level_max } = req.body;
  if (!name) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称');
  const now = Math.floor(Date.now() / 1000);
  const data: any = {
    name, description: description ?? '',
    level_min: level_min != null ? Number(level_min) : undefined,
    level_max: level_max != null ? Number(level_max) : undefined,
    create_time: now, update_time: now
  };
  if (bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0) data.id = Number(bodyId);
  const id = await mapService.add(data);
  success(res, { id });
}, '新增地图失败'));

router.put('/:id', adminHandler(async (req, res) => {
  const id = parseIdParam(req, res, '地图ID');
  if (id == null) return;
  const { name, description, level_min, level_max } = req.body;
  if (!name) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称');
  const ok = await mapService.update(id, {
    name, description: description ?? '',
    level_min: level_min != null ? Number(level_min) : undefined,
    level_max: level_max != null ? Number(level_max) : undefined,
    update_time: Math.floor(Date.now() / 1000)
  });
  if (ok) success(res, { message: '更新成功' });
  else fail(res, ErrorCode.NOT_FOUND, '地图不存在');
}, '更新地图失败'));

router.delete('/:id', adminDelete(mapService, '地图', '删除地图失败'));

export default router;

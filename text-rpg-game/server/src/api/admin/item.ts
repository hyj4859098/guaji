import { Router, Response, NextFunction } from 'express';
import { ItemService } from '../../service/item.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();
const itemService = new ItemService();

/** 获取物品列表 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const items = await itemService.getAllItems();
    success(res, items);
  } catch (error) {
    logger.error('获取物品列表失败:', error);
    next(error);
  }
});

/** 获取单个物品 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的物品ID');
    const item = await itemService.getItemById(id);
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    success(res, item);
  } catch (error) {
    logger.error('获取物品失败:', error);
    next(error);
  }
});

/** 新增物品 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: bodyId, name, type, pos, hp_restore, mp_restore, description } = req.body;
    if (!name || type == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称或类型');
    const id = await itemService.addItem({
      id: bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0 ? Number(bodyId) : undefined,
      name,
      type: Number(type),
      pos: pos != null ? Number(pos) : 0,
      hp_restore: hp_restore != null ? Number(hp_restore) : 0,
      mp_restore: mp_restore != null ? Number(mp_restore) : 0,
      description: description ?? ''
    });
    success(res, { id });
  } catch (error) {
    logger.error('新增物品失败:', error);
    next(error);
  }
});

/** 更新物品 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的物品ID');
    const { name, type, pos, hp_restore, mp_restore, description } = req.body;
    if (!name || type == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称或类型');
    const ok = await itemService.updateItem(id, {
      name,
      type: Number(type),
      pos: pos != null ? Number(pos) : 0,
      hp_restore: hp_restore != null ? Number(hp_restore) : 0,
      mp_restore: mp_restore != null ? Number(mp_restore) : 0,
      description: description ?? ''
    });
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '物品不存在');
  } catch (error) {
    logger.error('更新物品失败:', error);
    next(error);
  }
});

/** 删除物品 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的物品ID');
    const ok = await itemService.deleteItem(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '物品不存在');
  } catch (error) {
    logger.error('删除物品失败:', error);
    next(error);
  }
});

export default router;
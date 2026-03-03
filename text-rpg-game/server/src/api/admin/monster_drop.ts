/**
 * GM 掉落管理 API
 * monster_drop 表：monster_id, item_id, quantity, probability
 */
import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();

/** 按怪物ID获取掉落列表（含物品名称） */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const monster_id = req.query.monster_id != null ? parseInt(String(req.query.monster_id)) : undefined;
    const filter = monster_id != null && !isNaN(monster_id) ? { monster_id } : undefined;
    const list = await dataStorageService.list('monster_drop', filter);
    const items = await dataStorageService.list('item', undefined);
    const monsters = await dataStorageService.list('monster', undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const monsterMap = new Map(monsters.map((m: any) => [m.id, m]));
    const result = list.map((d: any) => ({
      ...d,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
      monster_name: monsterMap.get(d.monster_id)?.name || `怪物${d.monster_id}`
    }));
    success(res, result);
  } catch (error) {
    logger.error('获取掉落列表失败:', error);
    next(error);
  }
});

/** 获取单个掉落 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const d = await dataStorageService.getByCondition('monster_drop', { id });
    if (!d) return fail(res, ErrorCode.NOT_FOUND, '掉落配置不存在');
    const item = await dataStorageService.getByCondition('item', { id: d.item_id });
    const monster = await dataStorageService.getByCondition('monster', { id: d.monster_id });
    success(res, { ...d, item_name: item?.name, monster_name: monster?.name });
  } catch (error) {
    logger.error('获取掉落失败:', error);
    next(error);
  }
});

/** 新增掉落 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { monster_id, item_id, quantity, probability } = req.body;
    if (monster_id == null || item_id == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 monster_id 或 item_id');
    const monster = await dataStorageService.getByCondition('monster', { id: Number(monster_id) });
    if (!monster) return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    const item = await dataStorageService.getByCondition('item', { id: Number(item_id) });
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    const data = {
      monster_id: Number(monster_id),
      item_id: Number(item_id),
      quantity: quantity != null ? Math.max(1, Number(quantity)) : 1,
      probability: probability != null ? Math.min(100, Math.max(0, Number(probability))) : 0
    };
    const insertId = await dataStorageService.insert('monster_drop', data);
    success(res, { id: insertId });
  } catch (error) {
    logger.error('新增掉落失败:', error);
    next(error);
  }
});

/** 更新掉落 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const d = await dataStorageService.getByCondition('monster_drop', { id });
    if (!d) return fail(res, ErrorCode.NOT_FOUND, '掉落配置不存在');
    const { monster_id, item_id, quantity, probability } = req.body;
    const updateData: any = {};
    if (monster_id != null) {
      const monster = await dataStorageService.getByCondition('monster', { id: Number(monster_id) });
      if (!monster) return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
      updateData.monster_id = Number(monster_id);
    }
    if (item_id != null) {
      const item = await dataStorageService.getByCondition('item', { id: Number(item_id) });
      if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
      updateData.item_id = Number(item_id);
    }
    if (quantity != null) updateData.quantity = Math.max(1, Number(quantity));
    if (probability != null) updateData.probability = Math.min(100, Math.max(0, Number(probability)));
    if (Object.keys(updateData).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无更新字段');
    const ok = await dataStorageService.update('monster_drop', id, updateData);
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '更新失败');
  } catch (error) {
    logger.error('更新掉落失败:', error);
    next(error);
  }
});

/** 删除掉落 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    const ok = await dataStorageService.delete('monster_drop', id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '删除失败');
  } catch (error) {
    logger.error('删除掉落失败:', error);
    next(error);
  }
});

export default router;

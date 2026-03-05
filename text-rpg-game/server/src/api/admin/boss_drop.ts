/**
 * GM Boss 掉落管理 API
 */
import { Router } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();

const bossDropGetter = {
  get: async (id: number) => {
    const d = await dataStorageService.getByCondition('boss_drop', { id });
    if (!d) return null;
    const [item, boss] = await Promise.all([
      dataStorageService.getByCondition('item', { id: d.item_id }),
      dataStorageService.getByCondition('boss', { id: d.boss_id })
    ]);
    return { ...d, item_name: item?.name, boss_name: boss?.name };
  }
};
const bossDropDeleter = { delete: (id: number) => dataStorageService.delete('boss_drop', id) };

router.get('/', adminHandler(async (req, res) => {
  const boss_id = req.query.boss_id != null ? parseInt(String(req.query.boss_id)) : undefined;
  const filter = boss_id != null && !isNaN(boss_id) ? { boss_id } : undefined;
  const list = await dataStorageService.list('boss_drop', filter);
  const [items, bosses] = await Promise.all([
    dataStorageService.list('item', undefined),
    dataStorageService.list('boss', undefined)
  ]);
  const itemMap = new Map(items.map((i: any) => [i.id, i]));
  const bossMap = new Map(bosses.map((b: any) => [b.id, b]));
  const result = list.map((d: any) => ({
    ...d,
    item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
    boss_name: bossMap.get(d.boss_id)?.name || `Boss${d.boss_id}`
  }));
  success(res, result);
}, '获取 Boss 掉落列表失败'));

router.get('/:id', adminGetById(bossDropGetter, 'Boss掉落配置', '获取 Boss 掉落失败'));

router.post('/', adminHandler(async (req, res) => {
  const { boss_id, item_id, quantity, probability } = req.body;
  if (boss_id == null || item_id == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 boss_id 或 item_id');
  const [boss, item] = await Promise.all([
    dataStorageService.getByCondition('boss', { id: Number(boss_id) }),
    dataStorageService.getByCondition('item', { id: Number(item_id) })
  ]);
  if (!boss) return fail(res, ErrorCode.NOT_FOUND, 'Boss 不存在');
  if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
  const data = {
    boss_id: Number(boss_id), item_id: Number(item_id),
    quantity: quantity != null ? Math.max(1, Number(quantity)) : 1,
    probability: probability != null ? Math.min(100, Math.max(0, Number(probability))) : 0
  };
  const insertId = await dataStorageService.insert('boss_drop', data);
  success(res, { id: insertId });
}, '新增 Boss 掉落失败'));

router.put('/:id', adminHandler(async (req, res) => {
  const id = parseIdParam(req, res, 'ID');
  if (id == null) return;
  const d = await dataStorageService.getByCondition('boss_drop', { id });
  if (!d) return fail(res, ErrorCode.NOT_FOUND, '掉落配置不存在');
  const { boss_id, item_id, quantity, probability } = req.body;
  const updateData: any = {};
  if (boss_id != null) {
    const boss = await dataStorageService.getByCondition('boss', { id: Number(boss_id) });
    if (!boss) return fail(res, ErrorCode.NOT_FOUND, 'Boss 不存在');
    updateData.boss_id = Number(boss_id);
  }
  if (item_id != null) {
    const item = await dataStorageService.getByCondition('item', { id: Number(item_id) });
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    updateData.item_id = Number(item_id);
  }
  if (quantity != null) updateData.quantity = Math.max(1, Number(quantity));
  if (probability != null) updateData.probability = Math.min(100, Math.max(0, Number(probability)));
  if (Object.keys(updateData).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无更新字段');
  const ok = await dataStorageService.update('boss_drop', id, updateData);
  if (ok) success(res, { message: '更新成功' });
  else fail(res, ErrorCode.NOT_FOUND, '更新失败');
}, '更新 Boss 掉落失败'));

router.delete('/:id', adminDelete(bossDropDeleter, 'Boss掉落配置', '删除 Boss 掉落失败'));

export default router;

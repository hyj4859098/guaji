/**
 * GM 掉落管理 API
 * monster_drop 表：monster_id, item_id, quantity, probability
 */
import { Router } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminGetById, adminDelete, parseIdParam } from './admin-utils';
import { Collections } from '../../config/collections';

const router = Router();

const monsterDropGetter = {
  get: async (id: number) => {
    const d = await dataStorageService.getByCondition(Collections.MONSTER_DROP, { id });
    if (!d) return null;
    const [item, monster] = await Promise.all([
      dataStorageService.getByCondition(Collections.ITEM, { id: d.item_id }),
      dataStorageService.getByCondition(Collections.MONSTER, { id: d.monster_id })
    ]);
    return { ...d, item_name: item?.name, monster_name: monster?.name };
  }
};
const monsterDropDeleter = { delete: (id: number) => dataStorageService.delete(Collections.MONSTER_DROP, id) };

router.get('/', adminHandler(async (req, res) => {
    const monster_id = req.query.monster_id != null ? parseInt(String(req.query.monster_id)) : undefined;
    const filter = monster_id != null && !isNaN(monster_id) ? { monster_id } : undefined;
    const list = await dataStorageService.list(Collections.MONSTER_DROP, filter);
    const items = await dataStorageService.list(Collections.ITEM, undefined);
    const monsters = await dataStorageService.list(Collections.MONSTER, undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const monsterMap = new Map(monsters.map((m: any) => [m.id, m]));
    const result = list.map((d: any) => ({
      ...d,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
      monster_name: monsterMap.get(d.monster_id)?.name || `怪物${d.monster_id}`
    }));
    success(res, result);
}, '获取掉落列表失败'));

router.get('/:id', adminGetById(monsterDropGetter, '掉落配置', '获取掉落失败'));

router.post('/', adminHandler(async (req, res) => {
    const { monster_id, item_id, quantity, probability } = req.body;
    if (monster_id == null || item_id == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 monster_id 或 item_id');
    const monster = await dataStorageService.getByCondition(Collections.MONSTER, { id: Number(monster_id) });
    if (!monster) return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: Number(item_id) });
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    const data = {
      monster_id: Number(monster_id),
      item_id: Number(item_id),
      quantity: quantity != null ? Math.max(1, Number(quantity)) : 1,
      probability: probability != null ? Math.min(100, Math.max(0, Number(probability))) : 0
    };
    const insertId = await dataStorageService.insert(Collections.MONSTER_DROP, data);
    success(res, { id: insertId });
}, '新增掉落失败'));

router.put('/:id', adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, 'ID');
    if (id == null) return;
    const d = await dataStorageService.getByCondition(Collections.MONSTER_DROP, { id });
    if (!d) return fail(res, ErrorCode.NOT_FOUND, '掉落配置不存在');
    const { monster_id, item_id, quantity, probability } = req.body;
    const updateData: any = {};
    if (monster_id != null) {
      const monster = await dataStorageService.getByCondition(Collections.MONSTER, { id: Number(monster_id) });
      if (!monster) return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
      updateData.monster_id = Number(monster_id);
    }
    if (item_id != null) {
      const item = await dataStorageService.getByCondition(Collections.ITEM, { id: Number(item_id) });
      if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
      updateData.item_id = Number(item_id);
    }
    if (quantity != null) updateData.quantity = Math.max(1, Number(quantity));
    if (probability != null) updateData.probability = Math.min(100, Math.max(0, Number(probability)));
    if (Object.keys(updateData).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无更新字段');
    const ok = await dataStorageService.update(Collections.MONSTER_DROP, id, updateData);
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '更新失败');
}, '更新掉落失败'));

router.delete('/:id', adminDelete(monsterDropDeleter, '掉落配置', '删除掉落失败'));

export default router;

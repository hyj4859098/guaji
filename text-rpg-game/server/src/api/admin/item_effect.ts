/**
 * GM 道具效果管理 API
 * item_effect 表：item_id, effect_type, attr?, value?, max?, also_add_current?
 */
import { Router } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminGetById, adminDelete, parseIdParam } from './admin-utils';
import { Collections } from '../../config/collections';

const EFFECT_TYPES = ['restore', 'vip', 'boost', 'learn_skill', 'expand_bag', 'add_stat'] as const;
const ADD_STAT_ATTRS = ['max_hp', 'max_mp', 'phy_atk', 'mag_atk', 'phy_def', 'mag_def'] as const;

const router = Router();

const itemEffectGetter = {
  get: async (id: number) => {
    const d = await dataStorageService.getByCondition(Collections.ITEM_EFFECT, { id });
    if (!d) return null;
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: d.item_id });
    return { ...d, item_name: item?.name };
  }
};
const itemEffectDeleter = { delete: (id: number) => dataStorageService.delete(Collections.ITEM_EFFECT, id) };

router.get('/', adminHandler(async (req, res) => {
    const item_id = req.query.item_id != null ? parseInt(String(req.query.item_id)) : undefined;
    const filter = item_id != null && !isNaN(item_id) ? { item_id } : undefined;
    const list = await dataStorageService.list(Collections.ITEM_EFFECT, filter);
    const items = await dataStorageService.list(Collections.ITEM, undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const result = list.map((d: any) => ({
      ...d,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
    }));
    success(res, result);
}, '获取道具效果列表失败'));

router.get('/:id', adminGetById(itemEffectGetter, '道具效果', '获取道具效果失败'));

router.get('/by-item/:itemId', adminHandler(async (req, res) => {
    const itemId = parseIdParam(req, res, '物品ID', 'itemId');
    if (itemId == null) return;
    const d = await dataStorageService.getByCondition(Collections.ITEM_EFFECT, { item_id: itemId });
    if (!d) return fail(res, ErrorCode.NOT_FOUND, '该物品无效果配置');
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: itemId });
    success(res, { ...d, item_name: item?.name });
}, '获取道具效果失败'));

router.post('/', adminHandler(async (req, res) => {
    const { item_id, effect_type, attr, value, max, also_add_current } = req.body;
    if (item_id == null || !effect_type) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 item_id 或 effect_type');
    if (!EFFECT_TYPES.includes(effect_type)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的 effect_type');
    const item = await dataStorageService.getByCondition(Collections.ITEM, { id: Number(item_id) });
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    const existing = await dataStorageService.getByCondition(Collections.ITEM_EFFECT, { item_id: Number(item_id) });
    if (existing) return fail(res, ErrorCode.INVALID_PARAMS, '该物品已有效果配置，请编辑或先删除');

    const data: any = { item_id: Number(item_id), effect_type };
    if (effect_type === 'expand_bag') {
      data.value = value != null ? Number(value) : 50;
      data.max = max != null ? Number(max) : 500;
    } else if (effect_type === 'add_stat') {
      data.attr = ADD_STAT_ATTRS.includes(attr) ? attr : 'max_hp';
      data.value = value != null ? Number(value) : 1;
      data.also_add_current = !!also_add_current;
    }
    const insertId = await dataStorageService.insert(Collections.ITEM_EFFECT, data);
    success(res, { id: insertId });
}, '新增道具效果失败'));

router.put('/:id', adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, 'ID');
    if (id == null) return;
    const d = await dataStorageService.getByCondition(Collections.ITEM_EFFECT, { id });
    if (!d) return fail(res, ErrorCode.NOT_FOUND, '道具效果不存在');
    const { item_id, effect_type, attr, value, max, also_add_current } = req.body;

    const updateData: any = {};
    if (item_id != null) {
      const item = await dataStorageService.getByCondition(Collections.ITEM, { id: Number(item_id) });
      if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
      const existing = await dataStorageService.getByCondition(Collections.ITEM_EFFECT, { item_id: Number(item_id) });
      if (existing && existing.id !== id) return fail(res, ErrorCode.INVALID_PARAMS, '该物品已被其他效果配置占用');
      updateData.item_id = Number(item_id);
    }
    if (effect_type != null) {
      if (!EFFECT_TYPES.includes(effect_type)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的 effect_type');
      updateData.effect_type = effect_type;
    }
    const effType = effect_type ?? d.effect_type;
    if (effType === 'expand_bag') {
      if (value != null) updateData.value = Number(value);
      if (max != null) updateData.max = Number(max);
    } else if (effType === 'add_stat') {
      if (attr != null) updateData.attr = ADD_STAT_ATTRS.includes(attr) ? attr : d.attr;
      if (value != null) updateData.value = Number(value);
      if (also_add_current != null) updateData.also_add_current = !!also_add_current;
    }
    if (Object.keys(updateData).length === 0) return fail(res, ErrorCode.INVALID_PARAMS, '无更新字段');
    const ok = await dataStorageService.update(Collections.ITEM_EFFECT, id, updateData);
    if (ok) success(res, { message: '更新成功' });
    else fail(res, ErrorCode.NOT_FOUND, '更新失败');
}, '更新道具效果失败'));

router.delete('/:id', adminDelete(itemEffectDeleter, '道具效果', '删除道具效果失败'));

export default router;

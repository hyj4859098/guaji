import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../../service/data-storage.service';
import { getCollection } from '../../config/db';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { logger } from '../../utils/logger';

const router = Router();

function getEquipBaseFilter(eb: any, id: number) {
  if (eb.id != null) return { id: eb.id };
  return { item_id: id };
}

/** 获取装备基础列表（含物品名称） */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const list = await dataStorageService.list('equip_base', undefined);
    const items = await dataStorageService.list('item', undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    const result = list.map((eb: any) => ({
      ...eb,
      item_name: itemMap.get(eb.item_id)?.name || `物品${eb.item_id}`
    }));
    success(res, result);
  } catch (error) {
    logger.error('获取装备基础列表失败:', error);
    next(error);
  }
});

/** 获取单个装备基础（优先按 item_id 查） */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    let eb = await dataStorageService.getByCondition('equip_base', { item_id: id });
    if (!eb) eb = await dataStorageService.getByCondition('equip_base', { id });
    if (!eb) return fail(res, ErrorCode.NOT_FOUND, '装备基础不存在');
    const item = await dataStorageService.getByCondition('item', { id: eb.item_id });
    success(res, { ...eb, item_name: item?.name });
  } catch (error) {
    logger.error('获取装备基础失败:', error);
    next(error);
  }
});

/** 新增装备基础 */
router.post('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const {
      item_id, pos, base_level,
      base_hp, base_phy_atk, base_phy_def, base_mp, base_mag_def, base_mag_atk,
      base_hit_rate, base_dodge_rate, base_crit_rate
    } = req.body;
    if (item_id == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少 item_id');
    const existing = await dataStorageService.getByCondition('equip_base', { item_id: Number(item_id) });
    if (existing) return fail(res, ErrorCode.INVALID_PARAMS, '该物品已有装备基础配置');
    const item = await dataStorageService.getByCondition('item', { id: Number(item_id) });
    if (!item) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    const data = {
      item_id: Number(item_id),
      pos: pos != null ? Number(pos) : 1,
      base_level: base_level != null ? Number(base_level) : 1,
      base_hp: base_hp != null ? Number(base_hp) : 0,
      base_phy_atk: base_phy_atk != null ? Number(base_phy_atk) : 0,
      base_phy_def: base_phy_def != null ? Number(base_phy_def) : 0,
      base_mp: base_mp != null ? Number(base_mp) : 0,
      base_mag_def: base_mag_def != null ? Number(base_mag_def) : 0,
      base_mag_atk: base_mag_atk != null ? Number(base_mag_atk) : 0,
      base_hit_rate: base_hit_rate != null ? Number(base_hit_rate) : 0,
      base_dodge_rate: base_dodge_rate != null ? Number(base_dodge_rate) : 0,
      base_crit_rate: base_crit_rate != null ? Number(base_crit_rate) : 0
    };
    const insertId = await dataStorageService.insert('equip_base', data);
    success(res, { id: insertId });
  } catch (error) {
    logger.error('新增装备基础失败:', error);
    next(error);
  }
});

/** 更新装备基础 */
router.put('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    let eb = await dataStorageService.getByCondition('equip_base', { item_id: id });
    if (!eb) eb = await dataStorageService.getByCondition('equip_base', { id });
    if (!eb) return fail(res, ErrorCode.NOT_FOUND, '装备基础不存在');
    const filter = getEquipBaseFilter(eb, id);
    const {
      pos, base_level,
      base_hp, base_phy_atk, base_phy_def, base_mp, base_mag_def, base_mag_atk,
      base_hit_rate, base_dodge_rate, base_crit_rate
    } = req.body;
    const updateData: any = { update_time: Math.floor(Date.now() / 1000) };
    if (pos != null) updateData.pos = Number(pos);
    if (base_level != null) updateData.base_level = Number(base_level);
    if (base_hp != null) updateData.base_hp = Number(base_hp);
    if (base_phy_atk != null) updateData.base_phy_atk = Number(base_phy_atk);
    if (base_phy_def != null) updateData.base_phy_def = Number(base_phy_def);
    if (base_mp != null) updateData.base_mp = Number(base_mp);
    if (base_mag_def != null) updateData.base_mag_def = Number(base_mag_def);
    if (base_mag_atk != null) updateData.base_mag_atk = Number(base_mag_atk);
    if (base_hit_rate != null) updateData.base_hit_rate = Number(base_hit_rate);
    if (base_dodge_rate != null) updateData.base_dodge_rate = Number(base_dodge_rate);
    if (base_crit_rate != null) updateData.base_crit_rate = Number(base_crit_rate);
    if (Object.keys(updateData).length === 1) return fail(res, ErrorCode.INVALID_PARAMS, '无更新字段');
    const coll = getCollection('equip_base');
    await coll.updateOne(filter, { $set: updateData });
    success(res, { message: '更新成功' });
  } catch (error) {
    logger.error('更新装备基础失败:', error);
    next(error);
  }
});

/** 删除装备基础 */
router.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, ErrorCode.INVALID_PARAMS, '无效的ID');
    let eb = await dataStorageService.getByCondition('equip_base', { item_id: id });
    if (!eb) eb = await dataStorageService.getByCondition('equip_base', { id });
    if (!eb) return fail(res, ErrorCode.NOT_FOUND, '装备基础不存在');
    const filter = getEquipBaseFilter(eb, id);
    const coll = getCollection('equip_base');
    const result = await coll.deleteOne(filter);
    if (result.deletedCount > 0) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, '删除失败');
  } catch (error) {
    logger.error('删除装备基础失败:', error);
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { ItemService } from '../../service/item.service';
import { SkillService } from '../../service/skill.service';
import { dataStorageService } from '../../service/data-storage.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { isEquipment, getItemType } from '../../utils/item-type';
import { adminHandler, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();
const itemService = new ItemService();
const skillService = new SkillService();

const itemGetter = { get: (id: number) => itemService.getItemWithEffect(id) };

router.get('/', adminHandler(async (req, res) => {
    const type = req.query.type != null ? parseInt(String(req.query.type), 10) : undefined;
    const hasPage = req.query.page != null;
    if (!hasPage) {
      const items = type != null && !isNaN(type) && type > 0
        ? await itemService.getItemsByType(type)
        : await itemService.getAllItems();
      return success(res, items);
    }
    const page = Math.max(1, parseInt(String(req.query.page), 10));
    const pageSize = req.query.pageSize != null ? Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10))) : 20;
    const result = await itemService.listWithPagination(
      type != null && !isNaN(type) && type > 0 ? { type } : undefined,
      page,
      pageSize
    );
    success(res, result);
}, '获取物品列表失败'));

router.get('/:id', adminGetById(itemGetter, '物品', '获取物品失败'));

router.post('/', adminHandler(async (req, res) => {
    const { id: bodyId, name, type, pos, hp_restore, mp_restore, vip_days, description, effect_type, effect_attr, effect_value, effect_max, effect_also_add_current, skill_name, skill_type, skill_damage, skill_cost, skill_probability, base_level, base_hp, base_mp, base_phy_atk, base_phy_def, base_mag_atk, base_mag_def, base_hit_rate, base_dodge_rate, base_crit_rate } = req.body;
    if (!name || type == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称或类型');
    const itemType = Number(type);
    if (itemType < 1 || itemType > 6) return fail(res, ErrorCode.INVALID_PARAMS, 'type 必须在 1-6 之间');
    const id = await itemService.addItem({
      id: bodyId != null && Number.isInteger(Number(bodyId)) && Number(bodyId) > 0 ? Number(bodyId) : undefined,
      name,
      type: itemType,
      pos: pos != null ? Number(pos) : 0,
      hp_restore: hp_restore != null ? Number(hp_restore) : 0,
      mp_restore: mp_restore != null ? Number(mp_restore) : 0,
      vip_days: vip_days != null ? Number(vip_days) : undefined,
      description: description ?? ''
    });
    const itemTypeObj = { type: itemType };
    await itemService.syncItemEffect(id, itemType, getItemType(itemTypeObj) === 'tool' && itemType === 4 ? { effect_type: effect_type || undefined, attr: effect_attr, value: effect_value, max: effect_max, also_add_current: !!effect_also_add_current } : undefined);
    if (isEquipment(itemTypeObj)) {
      await itemService.syncEquipBase(id, {
        pos: pos != null ? Number(pos) : 1,
        base_level: base_level != null ? Number(base_level) : 1,
        base_hp: base_hp != null ? Number(base_hp) : 0,
        base_mp: base_mp != null ? Number(base_mp) : 0,
        base_phy_atk: base_phy_atk != null ? Number(base_phy_atk) : 0,
        base_phy_def: base_phy_def != null ? Number(base_phy_def) : 0,
        base_mag_atk: base_mag_atk != null ? Number(base_mag_atk) : 0,
        base_mag_def: base_mag_def != null ? Number(base_mag_def) : 0,
        base_hit_rate: base_hit_rate != null ? Number(base_hit_rate) : 0,
        base_dodge_rate: base_dodge_rate != null ? Number(base_dodge_rate) : 0,
        base_crit_rate: base_crit_rate != null ? Number(base_crit_rate) : 0
      });
    }
    if (getItemType(itemTypeObj) === 'tool' && itemType === 4 && effect_type === 'learn_skill' && skill_name) {
      await skillService.add({
        uid: 0,
        name: String(skill_name),
        type: skill_type != null ? Number(skill_type) : 1,
        damage: skill_damage != null ? Number(skill_damage) : 20,
        cost: skill_cost != null ? Number(skill_cost) : 10,
        probability: skill_probability != null ? Number(skill_probability) : 90,
        book_id: id,
        is_equipped: 0,
      } as any);
    }
    success(res, { id });
}, '新增物品失败'));

router.put('/:id', adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, '物品ID');
    if (id == null) return;
    const { name, type, pos, hp_restore, mp_restore, vip_days, description, effect_type, effect_attr, effect_value, effect_max, effect_also_add_current, skill_name, skill_type, skill_damage, skill_cost, skill_probability, base_level, base_hp, base_mp, base_phy_atk, base_phy_def, base_mag_atk, base_mag_def, base_hit_rate, base_dodge_rate, base_crit_rate } = req.body;
    if (!name || type == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少名称或类型');
    const itemType = Number(type);
    if (itemType < 1 || itemType > 6) return fail(res, ErrorCode.INVALID_PARAMS, 'type 必须在 1-6 之间');
    const existingItem = await dataStorageService.getByCondition('item', { id });
    if (existingItem && isEquipment(existingItem) && !isEquipment({ type: itemType })) {
      await itemService.deleteEquipBaseByItemId(id);
    }
    const ok = await itemService.updateItem(id, {
      name,
      type: itemType,
      pos: pos != null ? Number(pos) : 0,
      hp_restore: hp_restore != null ? Number(hp_restore) : 0,
      mp_restore: mp_restore != null ? Number(mp_restore) : 0,
      vip_days: vip_days != null ? Number(vip_days) : undefined,
      description: description ?? ''
    });
    if (!ok) return fail(res, ErrorCode.NOT_FOUND, '物品不存在');
    const updatedTypeObj = { type: itemType };
    await itemService.syncItemEffect(id, itemType, getItemType(updatedTypeObj) === 'tool' && itemType === 4 ? { effect_type: effect_type || undefined, attr: effect_attr, value: effect_value, max: effect_max, also_add_current: !!effect_also_add_current } : undefined);
    if (isEquipment(updatedTypeObj)) {
      await itemService.syncEquipBase(id, {
        pos: pos != null ? Number(pos) : 1,
        base_level: base_level != null ? Number(base_level) : 1,
        base_hp: base_hp != null ? Number(base_hp) : 0,
        base_mp: base_mp != null ? Number(base_mp) : 0,
        base_phy_atk: base_phy_atk != null ? Number(base_phy_atk) : 0,
        base_phy_def: base_phy_def != null ? Number(base_phy_def) : 0,
        base_mag_atk: base_mag_atk != null ? Number(base_mag_atk) : 0,
        base_mag_def: base_mag_def != null ? Number(base_mag_def) : 0,
        base_hit_rate: base_hit_rate != null ? Number(base_hit_rate) : 0,
        base_dodge_rate: base_dodge_rate != null ? Number(base_dodge_rate) : 0,
        base_crit_rate: base_crit_rate != null ? Number(base_crit_rate) : 0
      });
    }
    if (getItemType(updatedTypeObj) === 'tool' && itemType === 4 && effect_type === 'learn_skill' && skill_name) {
      const existingSkill = await dataStorageService.getByCondition('skill', { book_id: id });
      if (!existingSkill) {
        await skillService.add({
          uid: 0,
          name: String(skill_name),
          type: skill_type != null ? Number(skill_type) : 1,
          damage: skill_damage != null ? Number(skill_damage) : 20,
          cost: skill_cost != null ? Number(skill_cost) : 10,
          probability: skill_probability != null ? Number(skill_probability) : 90,
          book_id: id,
          is_equipped: 0,
        } as any);
      }
    }
    success(res, { message: '更新成功' });
}, '更新物品失败'));

router.delete('/:id', adminDelete({ delete: (id: number) => itemService.deleteItem(id) }, '物品', '删除物品失败'));

export default router;
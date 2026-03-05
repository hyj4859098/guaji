import { Router } from 'express';
import { ShopService } from '../../service/shop.service';
import { success, fail } from '../../utils/response';
import { ErrorCode } from '../../utils/error';
import { adminHandler, adminGetById, adminDelete, parseIdParam } from './admin-utils';

const router = Router();
const shopService = new ShopService();

router.get('/', adminHandler(async (req, res) => {
  const shopType = req.query.type as string | undefined;
  const items = await shopService.listAll(shopType);
  success(res, items);
}, '获取商店商品列表失败'));

router.get('/:id', adminGetById(shopService, '商品', '获取商店商品失败'));

router.post('/', adminHandler(async (req, res) => {
  const { shop_type, item_id, price, category, sort_order, enabled } = req.body;
  if (!shop_type || !item_id || price == null) return fail(res, ErrorCode.INVALID_PARAMS, '缺少商店类型、物品ID或价格');
  const id = await shopService.add({
    shop_type, item_id: Number(item_id), price: Number(price),
    category: category || 'consumable', sort_order: sort_order != null ? Number(sort_order) : 0,
    enabled: enabled !== false,
  });
  success(res, { id });
}, '新增商店商品失败'));

router.put('/:id', adminHandler(async (req, res) => {
  const id = parseIdParam(req, res, 'ID');
  if (id == null) return;
  const { shop_type, item_id, price, category, sort_order, enabled } = req.body;
  const updateData: any = {};
  if (shop_type != null) updateData.shop_type = shop_type;
  if (item_id != null) updateData.item_id = Number(item_id);
  if (price != null) updateData.price = Number(price);
  if (category != null) updateData.category = category;
  if (sort_order != null) updateData.sort_order = Number(sort_order);
  if (enabled != null) updateData.enabled = enabled;
  const ok = await shopService.update(id, updateData);
  if (ok) success(res, { message: '更新成功' });
  else fail(res, ErrorCode.NOT_FOUND, '商品不存在');
}, '更新商店商品失败'));

router.delete('/:id', adminDelete(shopService, '商品', '删除商店商品失败'));

export default router;

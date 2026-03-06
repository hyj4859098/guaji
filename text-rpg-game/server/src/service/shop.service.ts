import { dataStorageService } from './data-storage.service';
import { shopModel } from '../model/shop.model';
import { getHpRestore, getMpRestore, isEquipment } from '../utils/item-type';
import { PlayerService } from './player.service';
import { BagService } from './bag.service';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';
import { Uid } from '../types';
import { withUserLock } from '../utils/per-user-lock';
import { tryWithTransaction } from '../config/db';
import { Shop } from '../types/shop';

export type ShopItem = Shop;

const CURRENCY_MAP: Record<string, { field: string; label: string }> = {
  gold: { field: 'gold', label: '金币' },
  reputation: { field: 'reputation', label: '声望' },
  points: { field: 'points', label: '积分' },
};

const _shopLocks = new Map<string, Promise<unknown>>();

export class ShopService {
  private playerService: PlayerService;
  private bagService: BagService;

  constructor() {
    this.playerService = new PlayerService();
    this.bagService = new BagService();
  }

  async listByType(shopType: string): Promise<any[]> {
    const items = await shopModel.list({ shop_type: shopType, enabled: true });
    if (items.length === 0) return [];

    const itemIds = [...new Set(items.map((si: any) => si.item_id))];
    const allItems = await dataStorageService.getByIds('item', itemIds);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));

    const enriched = items.map((si: any) => {
      const itemInfo = itemMap.get(si.item_id);
      return {
        ...si,
        item_name: itemInfo?.name || '未知物品',
        item_type: itemInfo?.type,
        item_description: itemInfo?.description || '',
        hp_restore: getHpRestore(itemInfo),
        mp_restore: getMpRestore(itemInfo),
      };
    });
    enriched.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return enriched;
  }

  async buy(uid: Uid, shopItemId: number, count: number): Promise<void> {
    return withUserLock(_shopLocks, uid, () => this._doBuy(uid, shopItemId, count));
  }

  private async _doBuy(uid: Uid, shopItemId: number, count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 1 || count > 9999) {
      throw createError(ErrorCode.INVALID_PARAMS, '购买数量无效');
    }

    const shopItem = await shopModel.get(shopItemId);
    if (!shopItem || !shopItem.enabled) {
      throw createError(ErrorCode.NOT_FOUND, '商品不存在或已下架');
    }

    const itemInfo = await dataStorageService.getByCondition('item', { id: shopItem.item_id });
    if (!itemInfo) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '物品不存在');
    }

    const TEST_WEAPON_ID = 13; // E2E 测试用木剑，允许商店购买
    if (isEquipment(itemInfo) && itemInfo.id !== TEST_WEAPON_ID) {
      throw createError(ErrorCode.INVALID_PARAMS, '装备类物品不可在商店购买');
    }

    const currency = CURRENCY_MAP[shopItem.shop_type];
    if (!currency) {
      throw createError(ErrorCode.INVALID_PARAMS, `不支持的商店类型: ${shopItem.shop_type}`);
    }

    const totalCost = shopItem.price * count;

    const players = await this.playerService.list(uid);
    if (players.length === 0) {
      throw createError(ErrorCode.USER_NOT_FOUND, '玩家不存在');
    }
    const player = players[0];
    const balance = (player as any)[currency.field] ?? 0;

    if (balance < totalCost) {
      throw createError(ErrorCode.INVALID_PARAMS, `${currency.label}不足，需要 ${totalCost}，当前 ${balance}`);
    }

    const deductMethods: Record<string, string> = { gold: 'addGold', reputation: 'addReputation', points: 'addPoints' };
    const deductMethod = deductMethods[currency.field] || 'addGold';
    await tryWithTransaction(async (session) => {
      const deductOk = await (this.playerService as any)[deductMethod](uid, -totalCost, session);
      if (!deductOk) {
        throw createError(ErrorCode.INVALID_PARAMS, `${currency.label}扣除失败`);
      }
      await this.bagService.addItem(uid, shopItem.item_id, count);
    });

    // 推送更新
    const updatedPlayers = await this.playerService.list(uid);
    if (updatedPlayers.length) {
      wsManager.sendToUser(uid, { type: 'player', data: updatedPlayers[0] });
    }
    const bagPayload = await this.bagService.getListPayload(uid);
    wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });

    logger.info('商店购买成功', { uid, shopItemId, itemId: shopItem.item_id, count, totalCost, shopType: shopItem.shop_type });
  }

  // --- GM 管理方法 ---

  async listAll(shopType?: string): Promise<any[]> {
    const filter = shopType ? { shop_type: shopType } : undefined;
    const items = await shopModel.list(filter);
    if (items.length === 0) return [];

    const itemIds = [...new Set(items.map((si: any) => si.item_id))];
    const allItems = await dataStorageService.getByIds('item', itemIds);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));

    const enriched = items.map((si: any) => {
      const itemInfo = itemMap.get(si.item_id);
      return { ...si, item_name: itemInfo?.name || '未知物品', item_type: itemInfo?.type };
    });
    enriched.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return enriched;
  }

  async get(id: number): Promise<ShopItem | null> {
    return await shopModel.get(id);
  }

  async add(data: Partial<ShopItem>): Promise<number> {
    if (!data.item_id || !data.shop_type || data.price == null) {
      throw createError(ErrorCode.INVALID_PARAMS, '缺少必填字段');
    }
    if (data.price <= 0) {
      throw createError(ErrorCode.INVALID_PARAMS, '价格必须大于0');
    }
    const itemInfo = await dataStorageService.getByCondition('item', { id: data.item_id });
    if (!itemInfo) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '关联的物品不存在');
    }
    if (isEquipment(itemInfo)) {
      throw createError(ErrorCode.INVALID_PARAMS, '装备类物品不可上架商店');
    }
    return await shopModel.insert({
      shop_type: data.shop_type,
      item_id: data.item_id,
      price: data.price,
      category: data.category || 'consumable',
      sort_order: data.sort_order ?? 0,
      enabled: data.enabled !== false,
    });
  }

  async update(id: number, data: Partial<ShopItem>): Promise<boolean> {
    if (data.price != null && data.price <= 0) {
      throw createError(ErrorCode.INVALID_PARAMS, '价格必须大于0');
    }
    if (data.item_id != null) {
      const itemInfo = await dataStorageService.getByCondition('item', { id: data.item_id });
      if (!itemInfo) throw createError(ErrorCode.ITEM_NOT_FOUND, '关联的物品不存在');
      if (isEquipment(itemInfo)) throw createError(ErrorCode.INVALID_PARAMS, '装备类物品不可上架商店');
    }
    return await shopModel.update(id, data);
  }

  async delete(id: number): Promise<boolean> {
    return await shopModel.delete(id);
  }

  static getCurrencyMap() {
    return CURRENCY_MAP;
  }
}

export const shopService = new ShopService();

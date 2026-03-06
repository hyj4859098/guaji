/**
 * 拍卖行服务：上架、购买、下架
 */
import { dataStorageService } from './data-storage.service';
import { PlayerService } from './player.service';
import { BagService } from './bag.service';
import { EquipInstanceService } from './equip_instance.service';
import { logger } from '../utils/logger';
import { createError, ErrorCode } from '../utils/error';
import { wsManager } from '../event/ws-manager';
import { Uid } from '../types';
import { getHpRestore, getMpRestore, isEquipment } from '../utils/item-type';
import { enrichEquipDetail, enrichEquipFromBase } from '../utils/enrich-equip';
import { withUserLock } from '../utils/per-user-lock';
import { tryWithTransaction } from '../config/db';
import type { TxCtx } from './data-storage.service';

export interface AuctionListing {
  id: number;
  seller_uid: number;
  item_id: number;
  equipment_uid: number | null;
  count: number;
  price: number;
  create_time: number;
}

const _auctionLocks = new Map<string, Promise<unknown>>();
const AUCTION_RECORD_MAX = 20;

export class AuctionService {
  private playerService: PlayerService;
  private bagService: BagService;
  private equipInstanceService: EquipInstanceService;

  constructor() {
    this.playerService = new PlayerService();
    this.bagService = new BagService();
    this.equipInstanceService = new EquipInstanceService();
  }

  /**
   * 获取拍卖列表（支持筛选、分页）
   * 优化：批量查询 item/equip_base/player，避免 N+1
   */
  async list(params: {
    type?: number;
    keyword?: string;
    pos?: number;
    min_level?: number;
    max_level?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: any[]; total: number }> {
    const { type, keyword, pos, min_level, max_level, page = 1, pageSize = 15 } = params;

    const allAuctions = await dataStorageService.list('auction');
    if (allAuctions.length === 0) return { items: [], total: 0 };

    // 批量预加载所有相关 item 和 equip_base
    const auctionItemIds = [...new Set(allAuctions.map((a: any) => a.item_id))];
    const [allItems, _allEquipBases] = await Promise.all([
      dataStorageService.getByIds('item', auctionItemIds),
      dataStorageService.getByIds('equip_base', []),
    ]);
    const itemMap = new Map(allItems.map((i: any) => [i.id, i]));
    // equip_base 按 item_id 索引
    const equipBaseList = await dataStorageService.list('equip_base');
    const equipBaseMap = new Map(equipBaseList.map((eb: any) => [eb.item_id, eb]));

    const keywordLower = keyword?.trim()?.toLowerCase();
    const filtered: any[] = [];

    for (const row of allAuctions) {
      const itemInfo = itemMap.get(row.item_id);
      if (!itemInfo) continue;

      if (type != null && type > 0 && itemInfo.type !== type) continue;
      if (keywordLower && !(itemInfo.name || '').toLowerCase().includes(keywordLower)) continue;

      let equipBase: any = null;
      if (row.equipment_uid) {
        equipBase = equipBaseMap.get(row.item_id) || null;
        if (pos != null) {
          const instancePos = equipBase?.pos;
          if (instancePos !== pos) continue;
        }
        if (min_level != null || max_level != null) {
          const baseLevel = equipBase?.base_level ?? 1;
          if (min_level != null && baseLevel < min_level) continue;
          if (max_level != null && baseLevel > max_level) continue;
        }
      }

      filtered.push({ ...row, _itemInfo: itemInfo, _equipBase: equipBase });
    }

    filtered.sort((a, b) => (b.create_time ?? 0) - (a.create_time ?? 0));
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    // 批量查询卖家信息
    const sellerUids = [...new Set(paged.map((r: any) => r.seller_uid))];
    const sellerPlayers = await Promise.all(sellerUids.map(uid => this.playerService.list(uid)));
    const sellerMap = new Map<string, string>();
    sellerUids.forEach((uid, i) => {
      const p = sellerPlayers[i];
      sellerMap.set(String(uid), p.length ? (p[0].name || `玩家${uid}`) : `玩家${uid}`);
    });

    const result: any[] = [];
    for (const row of paged) {
      const itemInfo = row._itemInfo || {};
      const equipBase = row._equipBase || {};
      const sellerName = sellerMap.get(String(row.seller_uid)) || `玩家${row.seller_uid}`;

      let enriched: any = {
        id: row.id,
        seller_uid: row.seller_uid,
        seller_name: sellerName,
        item_id: row.item_id,
        equipment_uid: row.equipment_uid,
        count: row.count,
        price: row.price,
        create_time: row.create_time,
        name: itemInfo.name,
        type: itemInfo.type,
        pos: itemInfo.pos ?? equipBase.pos,
        description: itemInfo.description,
        hp_restore: getHpRestore(itemInfo),
        mp_restore: getMpRestore(itemInfo),
      };

      if (row.equipment_uid) {
        const instance = await this.equipInstanceService.get(Number(row.equipment_uid));
        if (instance) {
          const detail = await enrichEquipDetail(this.equipInstanceService, instance);
          Object.assign(enriched, detail);
          enriched.pos = instance.pos ?? (equipBase as any)?.pos;
        } else if (equipBase && isEquipment(itemInfo)) {
          Object.assign(enriched, enrichEquipFromBase(equipBase));
        }
      }

      result.push(enriched);
    }

    return { items: result, total };
  }

  /**
   * 上架物品
   */
  async listItem(uid: Uid, data: { bag_id: number; count?: number; price: number }): Promise<number> {
    const { bag_id, price } = data;
    let count = data.count ?? 1;

    if (!bag_id || price == null || price <= 0) {
      throw createError(ErrorCode.INVALID_PARAMS, '缺少背包ID或价格无效');
    }

    return withUserLock(_auctionLocks, uid, () => this._doListItem(uid, bag_id, count, price));
  }

  private async _doListItem(uid: Uid, bagId: number, count: number, price: number): Promise<number> {
    const bags = await this.bagService.list(uid);
    const bagItem = bags.find((b: any) => b.id === bagId || b.original_id === bagId);
    if (!bagItem) {
      throw createError(ErrorCode.ITEM_NOT_FOUND, '背包物品不存在');
    }

    const isEquip = isEquipment(bagItem);
    const maxCount = bagItem.count ?? 1;

    if (isEquip) {
      count = 1;
      if (!bagItem.equipment_uid) {
        throw createError(ErrorCode.INVALID_PARAMS, '装备数据异常');
      }
    } else {
      if (!Number.isInteger(count) || count < 1 || count > maxCount) {
        throw createError(ErrorCode.INVALID_PARAMS, `数量无效，最多可上架 ${maxCount}`);
      }
    }

    const realBagId = bagItem.original_id ?? bagItem.id;

    const auctionData: any = {
      seller_uid: uid,
      item_id: bagItem.item_id,
      count,
      price,
    };
    if (bagItem.equipment_uid) {
      auctionData.equipment_uid = Number(bagItem.equipment_uid);
    }

    const auctionId = await tryWithTransaction(async (session: TxCtx) => {
      if (isEquip) {
        await this.bagService.delete(realBagId, { skipEquipInstance: true });
      } else {
        if (count >= maxCount) {
          await this.bagService.delete(realBagId);
        } else {
          await this.bagService.reduceBagItemCount(realBagId, count);
        }
      }
      return await dataStorageService.insert('auction', auctionData, session);
    });

    const payload = await this.bagService.getListPayload(uid);
    wsManager.sendToUser(uid, { type: 'bag', data: payload });

    logger.info('拍卖上架成功', { uid, auctionId, item_id: bagItem.item_id, count, price });
    return auctionId;
  }

  private async _addRecord(
    uid: Uid,
    type: 'buy' | 'sell',
    itemName: string,
    itemId: number,
    count: number,
    price: number,
    otherUid: Uid | null,
    otherName: string | null
  ): Promise<void> {
    const total = price * count;
    await dataStorageService.insert('auction_record', {
      uid,
      type,
      item_id: itemId,
      item_name: itemName,
      count,
      price,
      total,
      other_uid: otherUid ?? 0,
      other_name: otherName || '',
    });
    await this._trimRecords(uid);
  }

  private async _trimRecords(uid: Uid): Promise<void> {
    const all = await dataStorageService.list('auction_record', { uid });
    all.sort((a: any, b: any) => (b.create_time ?? 0) - (a.create_time ?? 0));
    if (all.length <= AUCTION_RECORD_MAX) return;
    const toDelete = all.slice(AUCTION_RECORD_MAX);
    for (const r of toDelete) {
      await dataStorageService.delete('auction_record', r.id);
    }
  }

  async getRecords(uid: Uid): Promise<any[]> {
    const all = await dataStorageService.list('auction_record', { uid });
    all.sort((a: any, b: any) => (b.create_time ?? 0) - (a.create_time ?? 0));
    return all.slice(0, AUCTION_RECORD_MAX);
  }

  /**
   * 购买
   */
  async buy(uid: Uid, auctionId: number, count: number): Promise<void> {
    if (!auctionId || !Number.isInteger(count) || count < 1) {
      throw createError(ErrorCode.INVALID_PARAMS, '参数无效');
    }

    return withUserLock(_auctionLocks, `buy-${auctionId}`, () => this._doBuy(uid, auctionId, count));
  }

  private async _doBuy(uid: Uid, auctionId: number, count: number): Promise<void> {
    const auction = await dataStorageService.getById('auction', auctionId);
    if (!auction) {
      throw createError(ErrorCode.NOT_FOUND, '拍卖物品不存在或已售出');
    }

    if (String(auction.seller_uid) === String(uid)) {
      throw createError(ErrorCode.INVALID_PARAMS, '不能购买自己上架的商品');
    }

    const buyCount = Math.min(count, auction.count);
    if (buyCount < 1) {
      throw createError(ErrorCode.ITEM_COUNT_NOT_ENOUGH, '该商品已售罄');
    }

    const totalCost = auction.price * buyCount;

    if (auction.equipment_uid) {
      const canAdd = await this.bagService.canAddEquipment(uid);
      if (!canAdd) {
        throw createError(ErrorCode.BAG_EQUIPMENT_FULL, '背包装备已满，无法购买');
      }
    }

    const players = await this.playerService.list(uid);
    if (players.length === 0) {
      throw createError(ErrorCode.USER_NOT_FOUND, '玩家不存在');
    }
    const balance = (players[0] as any).gold ?? 0;
    if (balance < totalCost) {
      throw createError(ErrorCode.INVALID_PARAMS, `金币不足，需要 ${totalCost}，当前 ${balance}`);
    }

    await tryWithTransaction(async (session) => {
      const buyerDeductOk = await this.playerService.addGold(uid, -totalCost, session);
      if (!buyerDeductOk) {
        throw createError(ErrorCode.INVALID_PARAMS, `金币扣除失败`);
      }
      await this.playerService.addGold(auction.seller_uid, totalCost, session);

      if (auction.equipment_uid) {
        const ok = await this.equipInstanceService.tradeToUser(auction.seller_uid, uid, Number(auction.equipment_uid));
        if (!ok) {
          throw createError(ErrorCode.INVALID_PARAMS, '装备转移失败');
        }
      } else {
        await this.bagService.addItem(uid, auction.item_id, buyCount);
      }

      if (auction.count === buyCount) {
        await dataStorageService.delete('auction', auctionId, session);
      } else {
        await dataStorageService.update('auction', auctionId, { count: auction.count - buyCount }, session);
      }
    });

    const buyerPlayers = await this.playerService.list(uid);
    if (buyerPlayers.length) {
      wsManager.sendToUser(uid, { type: 'player', data: buyerPlayers[0] });
    }
    const buyerPayload = await this.bagService.getListPayload(uid);
    wsManager.sendToUser(uid, { type: 'bag', data: buyerPayload });

    const sellerPlayers = await this.playerService.list(auction.seller_uid);
    if (sellerPlayers.length) {
      wsManager.sendToUser(auction.seller_uid, { type: 'player', data: sellerPlayers[0] });
    }

    const itemInfo = await dataStorageService.getByCondition('item', { id: auction.item_id });
    const itemName = itemInfo?.name || '未知';
    const sellerName = sellerPlayers.length ? (sellerPlayers[0] as any).name || '' : '';
    const buyerName = buyerPlayers.length ? (buyerPlayers[0] as any).name || '' : '';
    await this._addRecord(uid, 'buy', itemName, auction.item_id, buyCount, auction.price, auction.seller_uid, sellerName);
    await this._addRecord(auction.seller_uid, 'sell', itemName, auction.item_id, buyCount, auction.price, uid, buyerName);

    logger.info('拍卖购买成功', { buyerUid: uid, sellerUid: auction.seller_uid, auctionId, count: buyCount, totalCost });
  }

  /**
   * 下架
   */
  async offShelf(uid: Uid, auctionId: number): Promise<void> {
    const auction = await dataStorageService.getById('auction', auctionId);
    if (!auction) {
      throw createError(ErrorCode.NOT_FOUND, '拍卖物品不存在');
    }

    if (String(auction.seller_uid) !== String(uid)) {
      throw createError(ErrorCode.FORBIDDEN, '只能下架自己上架的商品');
    }

    if (auction.equipment_uid) {
      const canAdd = await this.bagService.canAddEquipment(uid);
      if (!canAdd) {
        throw createError(ErrorCode.BAG_EQUIPMENT_FULL, '背包装备已满，无法下架');
      }
      await this.bagService.addEquipInstanceToBag(uid, auction.item_id, String(auction.equipment_uid));
    } else {
      await this.bagService.addItem(uid, auction.item_id, auction.count);
    }

    await dataStorageService.delete('auction', auctionId);

    const payload = await this.bagService.getListPayload(uid);
    wsManager.sendToUser(uid, { type: 'bag', data: payload });

    logger.info('拍卖下架成功', { uid, auctionId });
  }
}

export const auctionService = new AuctionService();

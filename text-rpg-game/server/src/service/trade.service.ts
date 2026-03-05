/**
 * 实时交易服务
 *
 * 全内存状态管理，不持久化。管理：
 * - 交易大厅在线玩家
 * - 邀请
 * - 交易会话状态机
 * - 交易执行（服务端校验 + 物品/金币转移）
 */
import { Uid } from '../types/index';
import { PlayerService } from './player.service';
import { BagService } from './bag.service';
import { EquipInstanceService } from './equip_instance.service';
import { BattleService } from './battle.service';
import { dataStorageService } from './data-storage.service';
import { wsManager } from '../event/ws-manager';
import { logger } from '../utils/logger';

interface PlayerInfo {
  uid: string;
  name: string;
  level: number;
}

interface InviteInfo {
  from_uid: string;
  from_name: string;
  timestamp: number;
}

interface TradeItem {
  bag_id: number;
  item_id: number;
  count: number;
  name: string;
  equipment_uid?: string;
}

interface TradeOffer {
  items: TradeItem[];
  gold: number;
  itemsConfirmed: boolean;
  tradeConfirmed: boolean;
}

interface TradeSession {
  id: string;
  player1: { uid: string; offer: TradeOffer };
  player2: { uid: string; offer: TradeOffer };
  state: 'selecting' | 'completed' | 'cancelled';
}

function toKey(uid: Uid): string { return String(uid); }
/** Map key(string) → DB 查询用的原始类型 uid */
function toDbUid(key: string): Uid {
  const n = Number(key);
  return isNaN(n) ? key : n;
}

function emptyOffer(): TradeOffer {
  return { items: [], gold: 0, itemsConfirmed: false, tradeConfirmed: false };
}

class TradeService {
  private lobbyPlayers = new Map<string, PlayerInfo>();
  private pendingInvites = new Map<string, InviteInfo>();
  private sessions = new Map<string, TradeSession>();
  private playerSession = new Map<string, string>();

  private playerService = new PlayerService();
  private bagService = new BagService();
  private equipInstanceService = new EquipInstanceService();
  private battleService = new BattleService();

  private inviteTimeout = 30000;

  async handleMessage(uid: Uid, data: any): Promise<void> {
    const action = data?.action;
    const key = toKey(uid);

    try {
      switch (action) {
        case 'join': return await this.join(key);
        case 'leave': return this.leave(key);
        case 'invite': return await this.invite(key, toKey(data.target_uid));
        case 'invite_respond': return await this.respondInvite(key, toKey(data.from_uid), !!data.accepted);
        case 'update_offer': return this.updateOffer(key, data.items || [], data.gold || 0);
        case 'confirm_items': return this.confirmItems(key);
        case 'confirm_trade': return await this.confirmTrade(key);
        case 'cancel': return this.cancel(key, '对方取消了交易');
        default: logger.warn('未知交易消息', { uid, action });
      }
    } catch (e) {
      logger.error('交易消息处理异常', { uid, action, e: e instanceof Error ? e.message : String(e) });
      this.sendTrade(key, 'error', { message: e instanceof Error ? e.message : '交易操作失败' });
    }
  }

  // ==================== 大厅 ====================

  async join(uid: string): Promise<void> {
    const dbUid = toDbUid(uid);
    const status = await this.battleService.getBattleStatus(dbUid);
    if (status.isFighting || status.state === 'offline_battle') {
      this.sendTrade(uid, 'error', { message: '请先停止战斗再进入交易' });
      return;
    }

    const players = await this.playerService.list(dbUid);
    if (!players.length) return;

    this.lobbyPlayers.set(uid, { uid, name: players[0].name, level: players[0].level });
    this.broadcastLobby();
  }

  leave(uid: string): void {
    if (this.playerSession.has(uid)) {
      this.cancel(uid, '对方离开了交易页面');
    }
    this.pendingInvites.delete(uid);
    for (const [toUid, inv] of this.pendingInvites) {
      if (inv.from_uid === uid) this.pendingInvites.delete(toUid);
    }
    this.lobbyPlayers.delete(uid);
    this.broadcastLobby();
  }

  handleDisconnect(uid: Uid): void {
    this.leave(toKey(uid));
  }

  // ==================== 邀请 ====================

  async invite(fromUid: string, toUid: string): Promise<void> {
    if (fromUid === toUid) return;
    if (!this.lobbyPlayers.has(fromUid) || !this.lobbyPlayers.has(toUid)) {
      this.sendTrade(fromUid, 'error', { message: '对方不在交易大厅' });
      return;
    }
    if (this.playerSession.has(fromUid) || this.playerSession.has(toUid)) {
      this.sendTrade(fromUid, 'error', { message: '你或对方正在交易中' });
      return;
    }

    const fromInfo = this.lobbyPlayers.get(fromUid)!;
    this.pendingInvites.set(toUid, { from_uid: fromUid, from_name: fromInfo.name, timestamp: Date.now() });

    this.sendTrade(toUid, 'invite_received', { from_uid: fromUid, from_name: fromInfo.name });

    setTimeout(() => {
      const inv = this.pendingInvites.get(toUid);
      if (inv && inv.from_uid === fromUid) {
        this.pendingInvites.delete(toUid);
        this.sendTrade(fromUid, 'invite_result', { accepted: false, target_name: this.lobbyPlayers.get(toUid)?.name || '', reason: '邀请超时' });
      }
    }, this.inviteTimeout);
  }

  async respondInvite(toUid: string, fromUid: string, accepted: boolean): Promise<void> {
    const inv = this.pendingInvites.get(toUid);
    if (!inv || inv.from_uid !== fromUid) {
      this.sendTrade(toUid, 'error', { message: '邀请已过期' });
      return;
    }
    this.pendingInvites.delete(toUid);

    const toName = this.lobbyPlayers.get(toUid)?.name || '';

    if (!accepted) {
      this.sendTrade(fromUid, 'invite_result', { accepted: false, target_name: toName });
      return;
    }

    if (this.playerSession.has(fromUid) || this.playerSession.has(toUid)) {
      this.sendTrade(toUid, 'error', { message: '你或对方已在交易中' });
      this.sendTrade(fromUid, 'invite_result', { accepted: false, target_name: toName, reason: '对方已在交易中' });
      return;
    }

    const sessionId = `trade_${Date.now()}_${fromUid}_${toUid}`;
    const session: TradeSession = {
      id: sessionId,
      player1: { uid: fromUid, offer: emptyOffer() },
      player2: { uid: toUid, offer: emptyOffer() },
      state: 'selecting',
    };
    this.sessions.set(sessionId, session);
    this.playerSession.set(fromUid, sessionId);
    this.playerSession.set(toUid, sessionId);

    const fromInfo = this.lobbyPlayers.get(fromUid);
    const toInfo = this.lobbyPlayers.get(toUid);
    this.sendTrade(fromUid, 'invite_result', { accepted: true, target_name: toName });
    this.sendTrade(fromUid, 'session_start', { partner: toInfo });
    this.sendTrade(toUid, 'session_start', { partner: fromInfo });
    this.broadcastLobby();
  }

  // ==================== 交易操作 ====================

  updateOffer(uid: string, items: TradeItem[], gold: number): void {
    const session = this.getSession(uid);
    if (!session || session.state !== 'selecting') return;

    const me = this.getMyOffer(session, uid);
    const partnerUid = this.getPartnerUid(session, uid);

    me.items = items;
    me.gold = Math.max(0, Math.floor(gold));
    me.itemsConfirmed = false;
    me.tradeConfirmed = false;

    this.sendTrade(partnerUid, 'partner_offer', { items: me.items, gold: me.gold });
  }

  confirmItems(uid: string): void {
    const session = this.getSession(uid);
    if (!session || session.state !== 'selecting') return;

    const me = this.getMyOffer(session, uid);
    const partnerUid = this.getPartnerUid(session, uid);
    me.itemsConfirmed = true;
    this.sendTrade(partnerUid, 'partner_confirmed_items', {});
  }

  async confirmTrade(uid: string): Promise<void> {
    const session = this.getSession(uid);
    if (!session || session.state !== 'selecting') return;

    const me = this.getMyOffer(session, uid);
    const partner = this.getPartnerOffer(session, uid);
    const partnerUid = this.getPartnerUid(session, uid);

    if (!me.itemsConfirmed || !partner.itemsConfirmed) {
      this.sendTrade(uid, 'error', { message: '双方都需要先确认物品' });
      return;
    }

    me.tradeConfirmed = true;
    this.sendTrade(partnerUid, 'partner_confirmed_trade', {});

    if (me.tradeConfirmed && partner.tradeConfirmed) {
      await this.executeTrade(session);
    }
  }

  cancel(uid: string, reason: string = '交易已取消'): void {
    const sessionId = this.playerSession.get(uid);
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'selecting') return;

    session.state = 'cancelled';
    const otherUid = session.player1.uid === uid ? session.player2.uid : session.player1.uid;

    this.sendTrade(uid, 'trade_cancelled', { reason: '你取消了交易' });
    this.sendTrade(otherUid, 'trade_cancelled', { reason });

    this.cleanupSession(sessionId);
    this.broadcastLobby();
  }

  // ==================== 交易执行 ====================

  private async executeTrade(session: TradeSession): Promise<void> {
    const p1Key = session.player1.uid;
    const p2Key = session.player2.uid;
    const p1Uid = toDbUid(p1Key);
    const p2Uid = toDbUid(p2Key);
    const offer1 = session.player1.offer;
    const offer2 = session.player2.offer;

    try {
      const [p1List, p2List] = await Promise.all([
        this.playerService.list(p1Uid),
        this.playerService.list(p2Uid),
      ]);
      if (!p1List.length || !p2List.length) throw new Error('玩家数据不存在');
      const p1 = p1List[0];
      const p2 = p2List[0];

      if (offer1.gold > 0 && p1.gold < offer1.gold) throw new Error(`${p1.name} 金币不足`);
      if (offer2.gold > 0 && p2.gold < offer2.gold) throw new Error(`${p2.name} 金币不足`);

      const p1Bags = await this.bagService.list(p1Uid);
      const p2Bags = await this.bagService.list(p2Uid);
      this.validateItems(offer1.items, p1Bags, p1.name);
      this.validateItems(offer2.items, p2Bags, p2.name);

      await this.transferItems(p1Uid, p2Uid, offer1.items);
      await this.transferItems(p2Uid, p1Uid, offer2.items);

      if (offer1.gold > 0) {
        await this.playerService.addGold(p1Uid, -offer1.gold);
        await this.playerService.addGold(p2Uid, offer1.gold);
      }
      if (offer2.gold > 0) {
        await this.playerService.addGold(p2Uid, -offer2.gold);
        await this.playerService.addGold(p1Uid, offer2.gold);
      }

      session.state = 'completed';

      this.sendTrade(p1Key, 'trade_complete', { received_items: offer2.items, received_gold: offer2.gold });
      this.sendTrade(p2Key, 'trade_complete', { received_items: offer1.items, received_gold: offer1.gold });

      await this.pushPlayerAndBag(p1Uid);
      await this.pushPlayerAndBag(p2Uid);

      logger.info('交易完成', { p1: p1Uid, p2: p2Uid, offer1Items: offer1.items.length, offer2Items: offer2.items.length, offer1Gold: offer1.gold, offer2Gold: offer2.gold });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '交易执行失败';
      logger.error('交易执行失败', { session: session.id, error: msg });
      session.state = 'cancelled';
      this.sendTrade(p1Key, 'trade_cancelled', { reason: msg });
      this.sendTrade(p2Key, 'trade_cancelled', { reason: msg });
    } finally {
      this.cleanupSession(session.id);
      this.broadcastLobby();
    }
  }

  private validateItems(items: TradeItem[], bags: any[], playerName: string): void {
    for (const ti of items) {
      const bag = bags.find((b: any) => String(b.original_id || b.id) === String(ti.bag_id));
      if (!bag) {
        logger.warn('交易校验失败：物品不存在', { playerName, bag_id: ti.bag_id, item_name: ti.name, bagIds: bags.map((b: any) => b.original_id || b.id).slice(0, 20) });
        throw new Error(`${playerName} 的物品 ${ti.name} 不存在`);
      }
      if ((bag.count || 1) < ti.count) throw new Error(`${playerName} 的物品 ${ti.name} 数量不足`);
    }
  }

  private async transferItems(fromUid: Uid, toUid: Uid, items: TradeItem[]): Promise<void> {
    for (const ti of items) {
      const itemInfo = await dataStorageService.getByCondition('item', { id: ti.item_id });
      const isEquip = itemInfo?.type === 2;

      if (isEquip && ti.equipment_uid) {
        const canAdd = await this.bagService.canAddEquipment(toUid);
        if (!canAdd) {
          throw new Error('对方背包装备已满，无法完成交易');
        }
        const instanceId = parseInt(ti.equipment_uid, 10);
        if (!isNaN(instanceId)) {
          await this.equipInstanceService.tradeToUser(fromUid, toUid, instanceId);
        }
      } else {
        const rawBags = await dataStorageService.list('bag', { uid: toDbUid(String(fromUid)), item_id: ti.item_id });
        const bagRecord = rawBags.find((b: any) => !b.equipment_uid);
        if (bagRecord) {
          const newCount = (bagRecord.count || 0) - ti.count;
          if (newCount <= 0) {
            await dataStorageService.delete('bag', bagRecord.id);
          } else {
            await dataStorageService.update('bag', bagRecord.id, { count: newCount });
          }
        }
        await this.bagService.addItem(toUid, ti.item_id, ti.count);
      }
    }
  }

  private async pushPlayerAndBag(uid: Uid): Promise<void> {
    try {
      const [players, bagPayload] = await Promise.all([
        this.playerService.list(uid),
        this.bagService.getListPayload(uid),
      ]);
      if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
    } catch { /* ignore */ }
  }

  // ==================== 工具 ====================

  private getSession(uid: string): TradeSession | null {
    const sid = this.playerSession.get(uid);
    return sid ? this.sessions.get(sid) || null : null;
  }

  private getMyOffer(s: TradeSession, uid: string): TradeOffer {
    return s.player1.uid === uid ? s.player1.offer : s.player2.offer;
  }

  private getPartnerOffer(s: TradeSession, uid: string): TradeOffer {
    return s.player1.uid === uid ? s.player2.offer : s.player1.offer;
  }

  private getPartnerUid(s: TradeSession, uid: string): string {
    return s.player1.uid === uid ? s.player2.uid : s.player1.uid;
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.playerSession.delete(session.player1.uid);
      this.playerSession.delete(session.player2.uid);
      this.sessions.delete(sessionId);
    }
  }

  private sendTrade(uid: string, action: string, data: any): void {
    wsManager.sendToUser(uid, { type: 'trade', data: { action, ...data } });
  }

  private broadcastLobby(): void {
    const list = Array.from(this.lobbyPlayers.values())
      .filter(p => !this.playerSession.has(p.uid));
    for (const p of this.lobbyPlayers.values()) {
      this.sendTrade(p.uid, 'lobby_players', { players: list });
    }
  }
}

export const tradeService = new TradeService();

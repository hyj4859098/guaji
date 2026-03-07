/**
 * 战斗公共逻辑：自动吃药、掉落处理、结算奖励
 * battle.service 和 boss.service 共用，消除重复代码
 */
import { Uid } from '../types';
import { isVipActive } from '../types/player';
import { logger } from './logger';
import { dataStorageService } from '../service/data-storage.service';
import { writeDropToDb } from './drop-handler';
import { wsManager } from '../event/ws-manager';
import { Collections } from '../config/collections';

// ======================= 自动吃药 =======================

interface AutoHealConfig {
  hp_enabled?: boolean;
  hp_potion_bag_id?: number;
  hp_threshold?: number;
  mp_enabled?: boolean;
  mp_potion_bag_id?: number;
  mp_threshold?: number;
}

interface AutoHealDeps {
  bagService: { useItem: (uid: Uid, bagId: number) => Promise<any> };
  playerService: { list: (uid: Uid) => Promise<any[]> };
}

interface RoundEvent {
  event: string;
  message: string;
  [k: string]: any;
}

/**
 * 创建 beforeEachRound 回调，用于自动补血/补蓝。
 * battle.service 和 boss.service 共用。
 */
export function createAutoHealHandler(
  uid: Uid,
  autoHeal: AutoHealConfig,
  deps: AutoHealDeps,
  logPrefix = ''
) {
  return async (attacker: any) => {
    const roundEvents: RoundEvent[] = [];
    const maxHp = attacker.max_hp || attacker.hp;
    const maxMp = attacker.max_mp ?? attacker.mp ?? 0;
    const hpPct = maxHp > 0 ? (attacker.hp / maxHp) * 100 : 100;
    const mpPct = maxMp > 0 ? ((attacker.mp ?? 0) / maxMp) * 100 : 100;
    let curPlayer = attacker;

    if (autoHeal.hp_enabled && autoHeal.hp_potion_bag_id && hpPct < (autoHeal.hp_threshold || 50)) {
      try {
        await deps.bagService.useItem(uid, autoHeal.hp_potion_bag_id);
        const pList = await deps.playerService.list(uid);
        if (pList.length) {
          curPlayer = pList[0];
          roundEvents.push({
            event: 'auto_heal',
            message: `自动使用补血药水，HP: ${curPlayer.hp}/${maxHp}`,
            player_hp: curPlayer.hp, player_max_hp: maxHp,
            player_mp: curPlayer.mp, player_max_mp: maxMp,
          });
        }
      } catch { logger.warn(`${logPrefix}自动补血失败`, { uid }); }
    }

    if (autoHeal.mp_enabled && autoHeal.mp_potion_bag_id && mpPct < (autoHeal.mp_threshold || 50)) {
      try {
        await deps.bagService.useItem(uid, autoHeal.mp_potion_bag_id);
        const pList = await deps.playerService.list(uid);
        if (pList.length) {
          curPlayer = pList[0];
          roundEvents.push({
            event: 'auto_heal',
            message: `自动使用补蓝药水，MP: ${curPlayer.mp}/${maxMp}`,
            player_hp: curPlayer.hp, player_max_hp: maxHp,
            player_mp: curPlayer.mp, player_max_mp: maxMp,
          });
        }
      } catch { logger.warn(`${logPrefix}自动补蓝失败`, { uid }); }
    }

    return { attacker: curPlayer, attackerHp: curPlayer.hp, roundEvents };
  };
}

// ======================= 掉落处理 =======================

interface DropDeps {
  bagService: { canAddEquipment: (uid: Uid) => Promise<boolean>; addEquipInstanceToBag: (uid: Uid, itemId: number, equipUid: string) => Promise<void>; addItem: (uid: Uid, itemId: number, count: number) => Promise<void> };
  equipInstanceService: { createFromDrop: (uid: Uid, itemId: number) => Promise<number | null>; deleteInstance: (id: number) => Promise<boolean> };
}

/**
 * 通用掉落处理：加载掉落表 → 概率滚动 → 写入背包。
 * @param dropTableName 掉落表名（monster_drop / boss_drop）
 * @param fallbackTableName 回退掉落表名（boss 会先查 boss_drop 再查 monster_drop）
 */
export async function processDropList(
  uid: Uid,
  entity: { id?: number; drops?: any[] },
  dropMultiplier: number,
  deps: DropDeps,
  dropTableName = 'monster_drop',
  fallbackTableName?: string,
): Promise<any[]> {
  let dropList = entity?.drops;
  if (!dropList?.length) {
    const entityId = entity?.id;
    if (!entityId) return [];
    dropList = await dataStorageService.list(dropTableName, { [dropTableName === 'boss_drop' ? 'boss_id' : 'monster_id']: Number(entityId) });
    if (!dropList?.length && fallbackTableName) {
      dropList = await dataStorageService.list(fallbackTableName, { monster_id: Number(entityId) });
    }
    const items = await dataStorageService.list(Collections.ITEM, undefined);
    const itemMap = new Map(items.map((i: any) => [i.id, i]));
    dropList = dropList.map((d: any) => ({
      item_id: d.item_id,
      item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
      quantity: d.quantity ?? 1,
      probability: d.probability ?? 0,
    }));
  }

  // Pre-compute which items actually drop to batch-load their info
  const pendingDrops: { itemId: number; qty: number }[] = [];
  for (const d of dropList) {
    const baseProb = Number(d.probability ?? 0) || 0;
    if (baseProb <= 0) continue;
    const effectiveProb = baseProb * dropMultiplier;
    let dropTimes = Math.floor(effectiveProb / 100);
    const remainProb = effectiveProb % 100;
    if (remainProb > 0 && Math.random() * 100 < remainProb) dropTimes++;
    if (dropTimes <= 0) continue;
    const itemId = Number(d.item_id);
    if (!itemId) continue;
    const baseQty = Math.max(1, Number(d.quantity) || 1);
    pendingDrops.push({ itemId, qty: baseQty * dropTimes });
  }

  if (pendingDrops.length === 0) return [];

  const uniqueItemIds = [...new Set(pendingDrops.map(d => d.itemId))];
  const itemInfos = await dataStorageService.getByIds(Collections.ITEM, uniqueItemIds);
  const itemInfoMap = new Map(itemInfos.map((i: any) => [i.id, i]));

  const result: any[] = [];
  for (const { itemId, qty } of pendingDrops) {
    const itemInfo = itemInfoMap.get(itemId);
    if (!itemInfo) continue;
    const dropped = await writeDropToDb(uid, itemId, qty, itemInfo, deps.bagService, deps.equipInstanceService);
    result.push(...dropped);
  }
  return result;
}

// ======================= 战斗结算 =======================

interface SettleInput {
  exp: number;
  gold: number;
  reputation: number;
  items?: any[];
}

interface SettleDeps {
  playerService: { list: (uid: Uid) => Promise<any[]>; addExp: (uid: Uid, v: number) => Promise<any>; addGold: (uid: Uid, v: number) => Promise<any>; addReputation: (uid: Uid, v: number) => Promise<any> };
  bagService: { getListPayload: (uid: Uid) => Promise<any> };
  pushEvent: (uid: Uid, event: string, message: string, data?: any) => void;
}

export async function settleBattleRewards(
  uid: Uid,
  result: SettleInput,
  deps: SettleDeps,
): Promise<void> {
  const { BoostService } = await import('../service/boost.service');
  const { WealthTitleService } = await import('../service/wealth-title.service');
  const { LevelTitleService } = await import('../service/level-title.service');

  const boostService = new BoostService();
  const boostConfig = await boostService.getBoostConfig(uid);
  const mult = BoostService.calcMultipliers(boostConfig);

  const players = await deps.playerService.list(uid);
  const vipMult = (players.length && isVipActive(players[0])) ? 2 : 1;

  let finalExp = result.exp * mult.exp * vipMult;
  let finalGold = result.gold * mult.gold * vipMult;

  const wealthTitleService = new WealthTitleService();
  const levelTitleService = new LevelTitleService();
  const [wealthBonus, expBonus] = await Promise.all([
    wealthTitleService.getGoldBonus(uid),
    levelTitleService.getExpBonus(uid),
  ]);
  finalExp = Math.floor(finalExp * expBonus);
  finalGold = Math.floor(finalGold * wealthBonus);
  const finalReputation = result.reputation * mult.reputation * vipMult;

  try {
    await deps.playerService.addExp(uid, finalExp);
    await deps.playerService.addGold(uid, finalGold);
    await deps.playerService.addReputation(uid, finalReputation);
    await boostService.consumeCharges(uid);
  } catch { logger.warn('结算失败', { uid }); }

  deps.pushEvent(uid, 'battle_reward', '战斗奖励结算', {
    exp: finalExp, gold: finalGold,
    reputation: finalReputation, items: result.items || [],
    boost: { exp: mult.exp * vipMult, gold: mult.gold * vipMult, drop: mult.drop * vipMult, reputation: mult.reputation * vipMult },
  });

  try {
    const [pList, bagPayload] = await Promise.all([
      deps.playerService.list(uid),
      deps.bagService.getListPayload(uid),
    ]);
    if (pList.length) wsManager.sendToUser(uid, { type: 'player', data: pList[0] });
    wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
  } catch { logger.warn('推送 player/bag 失败', { uid }); }
}

/**
 * 战斗服务
 *
 * 单场战斗：startBattle() — 同步执行一场，返回结果
 * 自动战斗：startAutoBattle() — 后台持久循环，API 立即返回
 * 离线恢复：resumeAutoBattle() — 快速模拟离线期间战斗 + 恢复在线自动战斗
 */
import { PlayerService } from './player.service';
import { MonsterService } from './monster.service';
import { SkillService } from './skill.service';
import { EquipInstanceService } from './equip_instance.service';
import { BagService } from './bag.service';
import { OfflineBattleService } from './offline-battle.service';
import { Uid } from '../types/index';
import { AutoBattleConfig, isVipActive } from '../types/player';
import { BoostService } from './boost.service';
import { WealthTitleService } from './wealth-title.service';
import { LevelTitleService } from './level-title.service';
import { BattleResultEnum } from '../types/enum';
import { wsManager } from '../event/ws-manager';
import { logger } from '../utils/logger';
import { dataStorageService } from './data-storage.service';
import { calculateHit, calcPhysicalDamage, calcMagicDamage, calcElementBonus } from '../battle/core';

interface BattleResult {
  result: BattleResultEnum;
  rounds: number;
  exp: number;
  gold: number;
  reputation: number;
  items: any[];
  logs: any[];
  create_time: number;
}

const MAX_ROUNDS_PER_BATTLE = 100;

const battleState = new Map<string, { running: boolean; stopRequested: boolean }>();

function toKey(uid: Uid): string {
  return String(uid);
}

export class BattleService {
  private playerService = new PlayerService();
  private monsterService = new MonsterService();
  private skillService = new SkillService();
  private equipInstanceService = new EquipInstanceService();
  private bagService = new BagService();
  private offlineBattleService = new OfflineBattleService();
  private wealthTitleService = new WealthTitleService();
  private levelTitleService = new LevelTitleService();
  private _eventSeq = 0;

  // ==================== 单场战斗（不变） ====================

  async startBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<BattleResult> {
    const key = toKey(uid);
    if (battleState.get(key)?.running) {
      return this.createLoseResult();
    }

    battleState.set(key, { running: true, stopRequested: false });
    let result: BattleResult;

    try {
      result = await this.runOneBattle(uid, enemyId, autoHeal);
      if (result.result === BattleResultEnum.WIN) {
        await this.settle(uid, result);
      }
      this.pushEvent(uid, 'battle_end', '战斗结束', { result: 'completed' });
    } catch (e) {
      logger.error('战斗异常', { uid, e: e instanceof Error ? e.message : String(e) });
      this.pushEvent(uid, 'battle_end', '战斗异常结束', { result: 'error' });
      result = this.createLoseResult();
    } finally {
      battleState.delete(key);
    }

    return result;
  }

  // ==================== 自动战斗（后台持久循环） ====================

  async startAutoBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<boolean> {
    const key = toKey(uid);
    if (battleState.get(key)?.running) return false;

    await this.saveAutoBattleConfig(uid, enemyId, autoHeal);
    battleState.set(key, { running: true, stopRequested: false });

    this._autoBattleLoop(uid, enemyId, autoHeal).catch(e => {
      logger.error('自动战斗循环异常', { uid, e: e instanceof Error ? e.message : String(e) });
    });

    return true;
  }

  private async _autoBattleLoop(uid: Uid, enemyId: number, autoHeal?: any): Promise<void> {
    const key = toKey(uid);

    try {
      while (true) {
        if (battleState.get(key)?.stopRequested) {
          await this.clearAutoBattleConfig(uid);
          this.pushEvent(uid, 'battle_end', '战斗已手动停止', { result: 'stopped' });
          break;
        }

        if (!wsManager.isUserConnected(uid)) {
          const players = await this.playerService.list(uid);
          if (players.length && isVipActive(players[0])) {
            await this.updateLastBattleTime(uid);
            logger.info('VIP玩家掉线，保留自动战斗配置', { uid });
          } else {
            await this.clearAutoBattleConfig(uid);
            logger.info('非VIP玩家掉线，清除自动战斗配置', { uid });
          }
          break;
        }

        const result = await this.runOneBattle(uid, enemyId, autoHeal);

        if (result.result === BattleResultEnum.WIN) {
          await this.settle(uid, result);
          await this.updateLastBattleTime(uid);
        } else {
          await this.clearAutoBattleConfig(uid);
          this.pushEvent(uid, 'battle_end', '战斗结束', { result: 'completed' });
          break;
        }

        await this.delay(2000);
      }
    } catch (e) {
      logger.error('自动战斗异常', { uid, e: e instanceof Error ? e.message : String(e) });
      this.pushEvent(uid, 'battle_end', '战斗异常结束', { result: 'error' });
    } finally {
      battleState.delete(key);
    }
  }

  // ==================== 离线恢复 ====================

  async resumeAutoBattle(uid: Uid): Promise<{ offlineBattles: number; died: boolean; resumed: boolean }> {
    const players = await this.playerService.list(uid);
    if (!players.length) return { offlineBattles: 0, died: false, resumed: false };
    const player = players[0];
    const config = player.auto_battle_config;
    if (!config) return { offlineBattles: 0, died: false, resumed: false };

    let offlineBattles = 0;
    let died = false;

    if (isVipActive(player) && config.last_battle_time) {
      const simResult = await this.offlineBattleService.simulate(uid, config);
      offlineBattles = simResult.totalBattles;
      died = simResult.died;
    }

    if (died) {
      return { offlineBattles, died: true, resumed: false };
    }

    const freshPlayers = await this.playerService.list(uid);
    const freshConfig = freshPlayers[0]?.auto_battle_config;
    if (!freshConfig) return { offlineBattles, died: false, resumed: false };

    const autoHeal = freshConfig.auto_heal ? {
      hp_enabled: freshConfig.auto_heal.hp_enabled,
      hp_potion_bag_id: await this.resolveItemToBagId(uid, freshConfig.auto_heal.hp_item_id),
      hp_threshold: freshConfig.auto_heal.hp_threshold,
      mp_enabled: freshConfig.auto_heal.mp_enabled,
      mp_potion_bag_id: await this.resolveItemToBagId(uid, freshConfig.auto_heal.mp_item_id),
      mp_threshold: freshConfig.auto_heal.mp_threshold,
    } : undefined;

    const started = await this.startAutoBattle(uid, freshConfig.enemy_id, autoHeal);
    return { offlineBattles, died: false, resumed: started };
  }

  // ==================== 停止 & 状态 ====================

  async stopBattle(uid: Uid): Promise<boolean> {
    const s = battleState.get(toKey(uid));
    if (!s?.running) return false;
    s.stopRequested = true;
    return true;
  }

  async getBattleStatus(uid: Uid): Promise<{ isFighting: boolean; state: string; config?: any }> {
    const s = battleState.get(toKey(uid));
    if (s?.running) {
      return { isFighting: true, state: 'battle' };
    }

    const players = await this.playerService.list(uid);
    if (players.length) {
      const config = players[0].auto_battle_config;
      if (config) {
        return { isFighting: false, state: 'offline_battle', config };
      }
    }

    return { isFighting: false, state: 'idle' };
  }

  // ==================== 单场战斗逻辑（在线版，有 WS 推送） ====================

  private async runOneBattle(uid: Uid, enemyId: number, autoHeal?: any): Promise<BattleResult> {
    const key = toKey(uid);
    const players = await this.playerService.list(uid);
    if (!players.length) return this.createLoseResult();
    let player = players[0];

    const monster = await this.monsterService.get(enemyId);
    if (!monster) return this.createLoseResult();

    const monsterCopy = { ...monster };

    // 应用百分比加成（来自祝福/宝石/附魔等，已在穿戴时累加到 player 字段）
    const phyDefPct = (player as any).phy_def_pct || 0;
    const magDefPct = (player as any).mag_def_pct || 0;
    const maxHpPct = (player as any).max_hp_pct || 0;
    if (phyDefPct) player = { ...player, phy_def: Math.floor((player.phy_def || 0) * (1 + phyDefPct / 100)) };
    if (magDefPct) player = { ...player, mag_def: Math.floor((player.mag_def || 0) * (1 + magDefPct / 100)) };
    if (maxHpPct) {
      const hpBonus = Math.floor((player.max_hp || player.hp) * maxHpPct / 100);
      player = { ...player, hp: player.hp + hpBonus, max_hp: (player.max_hp || player.hp) + hpBonus };
    }

    let playerHP = player.hp;
    let monsterHP = monsterCopy.hp;
    const maxHp = player.max_hp || player.hp;
    const maxMp = player.max_mp || player.mp;

    this.pushEvent(uid, 'battle_start', `战斗开始！对阵${monsterCopy.name}`, {
      player_hp: playerHP, player_max_hp: maxHp,
      monster_hp: monsterHP, monster_max_hp: monsterCopy.hp,
    });

    let round = 1;
    while (playerHP > 0 && monsterHP > 0 && round <= MAX_ROUNDS_PER_BATTLE) {
      if (battleState.get(key)?.stopRequested) return this.createLoseResult();

      const roundEvents: Array<{ event: string; message: string; [k: string]: any }> = [];
      const add = (ev: string, msg: string, d?: any) => roundEvents.push({ event: ev, message: msg, ...d });

      if (autoHeal) {
        const hpPct = maxHp > 0 ? (playerHP / maxHp) * 100 : 100;
        const mpPct = maxMp > 0 ? (player.mp / maxMp) * 100 : 100;
        if (autoHeal.hp_enabled && autoHeal.hp_potion_bag_id && hpPct < (autoHeal.hp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.hp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              player = pList[0];
              playerHP = player.hp;
              add('auto_heal', `自动使用补血药水，HP: ${playerHP}/${maxHp}`, {
                player_hp: playerHP, player_max_hp: maxHp, player_mp: player.mp, player_max_mp: maxMp,
              });
            }
          } catch { logger.warn('自动补血失败', { uid }); }
        }
        if (autoHeal.mp_enabled && autoHeal.mp_potion_bag_id && mpPct < (autoHeal.mp_threshold || 50)) {
          try {
            await this.bagService.useItem(uid, autoHeal.mp_potion_bag_id);
            const pList = await this.playerService.list(uid);
            if (pList.length) {
              player = pList[0];
              playerHP = player.hp;
              add('auto_heal', `自动使用补蓝药水，MP: ${player.mp}/${maxMp}`, {
                player_hp: playerHP, player_max_hp: maxHp, player_mp: player.mp, player_max_mp: maxMp,
              });
            }
          } catch { logger.warn('自动补蓝失败', { uid }); }
        }
      }

      add('round_start', `回合 ${round}`);

      const playerElemBonus = calcElementBonus(player, monsterCopy);
      const monsterElemBonus = calcElementBonus(monsterCopy, player);
      const pElemMul = 1 + playerElemBonus / 100;
      const mElemMul = 1 + monsterElemBonus / 100;

      const skills = await this.skillService.getEquippedSkills(uid);
      const vipSkillBonus = isVipActive(player) ? 20 : 0;
      const skillProbPhyBonus = ((player as any).phy_skill_prob || 0) + vipSkillBonus;
      const skillProbMagBonus = ((player as any).mag_skill_prob || 0) + vipSkillBonus;
      const skillDmgPct = (player as any).skill_dmg_pct || 0;
      const skillDmgMul = skillDmgPct ? (1 + skillDmgPct / 100) : 1;
      if (skills.physical?.length) {
        const s = skills.physical[0];
        const prob = s.probability + skillProbPhyBonus;
        if (Math.random() * 100 < prob && player.mp >= s.cost) {
          const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
          const newMp = player.mp - s.cost;
          monsterHP = Math.max(0, monsterHP - dmg);
          await this.playerService.update(player.id, { mp: newMp });
          player.mp = newMp;
          add('player_skill_attack', `你使用了 ${s.name} ${monsterCopy.name} 掉血 ${dmg}`, {
            damage: dmg, player_hp: playerHP, player_max_hp: maxHp, player_mp: newMp, player_max_mp: maxMp,
            monster_hp: monsterHP, monster_max_hp: monsterCopy.hp,
          });
        }
      }
      if (skills.magic?.length) {
        const s = skills.magic[0];
        const prob = s.probability + skillProbMagBonus;
        if (Math.random() * 100 < prob && player.mp >= s.cost) {
          const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
          const newMp = player.mp - s.cost;
          monsterHP = Math.max(0, monsterHP - dmg);
          await this.playerService.update(player.id, { mp: newMp });
          player.mp = newMp;
          add('player_skill_attack', `你使用了 ${s.name} ${monsterCopy.name} 掉血 ${dmg}`, {
            damage: dmg, player_hp: playerHP, player_max_hp: maxHp, player_mp: newMp, player_max_mp: maxMp,
            monster_hp: monsterHP, monster_max_hp: monsterCopy.hp,
          });
        }
      }

      const pPhyHit = calculateHit(player, monsterCopy);
      const pPhyRaw = pPhyHit ? calcPhysicalDamage(player, monsterCopy) : { damage: 0, isCrit: false };
      const pPhy = { damage: Math.floor(pPhyRaw.damage * pElemMul), isCrit: pPhyRaw.isCrit };
      const pMagHit = calculateHit(player, monsterCopy);
      const pMagRaw = pMagHit ? calcMagicDamage(player, monsterCopy) : { damage: 0, isCrit: false };
      const pMag = { damage: Math.floor(pMagRaw.damage * pElemMul), isCrit: pMagRaw.isCrit };
      const mPhyHit = calculateHit(monsterCopy, player);
      const mPhyRaw = mPhyHit ? calcPhysicalDamage(monsterCopy, player) : { damage: 0, isCrit: false };
      const mPhy = { damage: Math.floor(mPhyRaw.damage * mElemMul), isCrit: mPhyRaw.isCrit };
      const mMagHit = calculateHit(monsterCopy, player);
      const mMagRaw = mMagHit ? calcMagicDamage(monsterCopy, player) : { damage: 0, isCrit: false };
      const mMag = { damage: Math.floor(mMagRaw.damage * mElemMul), isCrit: mMagRaw.isCrit };

      const newMonsterHP = Math.max(0, monsterHP - pPhy.damage - pMag.damage);
      const newPlayerHP = Math.max(0, playerHP - mPhy.damage - mMag.damage);

      const critTag = (c: boolean) => c ? '【暴击】' : '';
      add('player_phy_attack', pPhyHit
        ? `你使用了 物理攻击${critTag(pPhy.isCrit)} ${monsterCopy.name} 掉血 ${pPhy.damage}`
        : `你使用了 物理攻击 ${monsterCopy.name} 掉血 未命中`, {
        damage: pPhy.damage, is_crit: pPhy.isCrit, player_hp: newPlayerHP, player_max_hp: maxHp, monster_hp: newMonsterHP, monster_max_hp: monsterCopy.hp,
      });
      add('player_mag_attack', pMagHit
        ? `你使用了 魔法攻击${critTag(pMag.isCrit)} ${monsterCopy.name} 掉血 ${pMag.damage}`
        : `你使用了 魔法攻击 ${monsterCopy.name} 掉血 未命中`, {
        damage: pMag.damage, is_crit: pMag.isCrit, player_hp: newPlayerHP, player_max_hp: maxHp, monster_hp: newMonsterHP, monster_max_hp: monsterCopy.hp,
      });
      add('monster_phy_attack', mPhyHit
        ? `${monsterCopy.name} 使用了 物理攻击${critTag(mPhy.isCrit)} 你 掉血 ${mPhy.damage}`
        : `${monsterCopy.name} 使用了 物理攻击 你 掉血 未命中`, {
        damage: mPhy.damage, is_crit: mPhy.isCrit, player_hp: newPlayerHP, player_max_hp: maxHp, monster_hp: newMonsterHP, monster_max_hp: monsterCopy.hp,
      });
      add('monster_mag_attack', mMagHit
        ? `${monsterCopy.name} 使用了 魔法攻击${critTag(mMag.isCrit)} 你 掉血 ${mMag.damage}`
        : `${monsterCopy.name} 使用了 魔法攻击 你 掉血 未命中`, {
        damage: mMag.damage, is_crit: mMag.isCrit, player_hp: newPlayerHP, player_max_hp: maxHp, monster_hp: newMonsterHP, monster_max_hp: monsterCopy.hp,
      });

      this.pushBatch(uid, roundEvents);
      await this.delay(1000);

      playerHP = newPlayerHP;
      monsterHP = newMonsterHP;
      round++;
    }

    if (playerHP > 0) {
      await this.playerService.update(player.id, { hp: playerHP });
    }

    if (playerHP > 0 && monsterHP > 0) {
      this.pushEvent(uid, 'battle_draw', `战斗超过${MAX_ROUNDS_PER_BATTLE}回合，判定为平局`);
      return this.createLoseResult();
    }
    if (playerHP <= 0 && monsterHP <= 0) {
      this.pushEvent(uid, 'battle_draw', '战斗平局');
      return this.createLoseResult();
    }
    if (playerHP <= 0) {
      this.pushEvent(uid, 'battle_lose', '战斗失败');
      return this.createLoseResult();
    }

    this.pushEvent(uid, 'battle_win', `战斗胜利！击败了${monsterCopy.name}`);
    const boostSvc = new BoostService();
    const bCfg = await boostSvc.getBoostConfig(uid);
    const pList = await this.playerService.list(uid);
    const vipDropMult = (pList.length && isVipActive(pList[0])) ? 2 : 1;
    const dropMult = BoostService.calcMultipliers(bCfg).drop * vipDropMult;
    const items = await this.processDrop(uid, monsterCopy, dropMult);
    return {
      result: BattleResultEnum.WIN,
      rounds: round - 1,
      exp: monsterCopy.exp || 0,
      gold: monsterCopy.gold || 0,
      reputation: monsterCopy.reputation || 0,
      items,
      logs: [],
      create_time: Math.floor(Date.now() / 1000),
    };
  }

  // ==================== 结算 ====================

  private async settle(uid: Uid, result: BattleResult): Promise<void> {
    const boostService = new BoostService();
    const boostConfig = await boostService.getBoostConfig(uid);
    const mult = BoostService.calcMultipliers(boostConfig);

    const players = await this.playerService.list(uid);
    const vipMult = (players.length && isVipActive(players[0])) ? 2 : 1;

    let finalExp = result.exp * mult.exp * vipMult;
    let finalGold = result.gold * mult.gold * vipMult;
    const [wealthBonus, expBonus] = await Promise.all([
      this.wealthTitleService.getGoldBonus(uid),
      this.levelTitleService.getExpBonus(uid),
    ]);
    finalExp = Math.floor(finalExp * expBonus);
    finalGold = Math.floor(finalGold * wealthBonus);
    const finalReputation = result.reputation * mult.reputation * vipMult;

    try {
      await this.playerService.addExp(uid, finalExp);
      await this.playerService.addGold(uid, finalGold);
      await this.playerService.addReputation(uid, finalReputation);
      await boostService.consumeCharges(uid);
    } catch { logger.warn('结算失败', { uid }); }

    this.pushEvent(uid, 'battle_reward', '战斗奖励结算', {
      exp: finalExp, gold: finalGold,
      reputation: finalReputation, items: result.items || [],
      boost: { exp: mult.exp * vipMult, gold: mult.gold * vipMult, drop: mult.drop * vipMult, reputation: mult.reputation * vipMult },
    });

    try {
      const [players, bagPayload] = await Promise.all([
        this.playerService.list(uid),
        this.bagService.getListPayload(uid),
      ]);
      if (players.length) wsManager.sendToUser(uid, { type: 'player', data: players[0] });
      wsManager.sendToUser(uid, { type: 'bag', data: bagPayload });
    } catch { logger.warn('推送 player/bag 失败', { uid }); }
  }

  // ==================== 掉落 ====================

  private async processDrop(uid: Uid, monster: any, dropMultiplier: number = 1): Promise<any[]> {
    let dropList = monster?.drops;
    if (!dropList?.length) {
      const monsterId = monster?.id;
      if (!monsterId) return [];
      dropList = await dataStorageService.list('monster_drop', { monster_id: Number(monsterId) });
      const items = await dataStorageService.list('item', undefined);
      const itemMap = new Map(items.map((i: any) => [i.id, i]));
      dropList = dropList.map((d: any) => ({
        item_id: d.item_id,
        item_name: itemMap.get(d.item_id)?.name || `物品${d.item_id}`,
        quantity: d.quantity ?? 1,
        probability: d.probability ?? 0,
      }));
    }
    const result: any[] = [];
    for (const d of dropList) {
      const baseProb = Number(d.probability ?? 0) || 0;
      if (baseProb <= 0) continue;
      const effectiveProb = baseProb * dropMultiplier;
      let dropTimes = Math.floor(effectiveProb / 100);
      const remainProb = effectiveProb % 100;
      if (remainProb > 0 && Math.random() * 100 < remainProb) dropTimes++;
      if (dropTimes <= 0) continue;
      const itemId = Number(d.item_id);
      const baseQty = Math.max(1, Number(d.quantity) || 1);
      const qty = baseQty * dropTimes;
      if (!itemId) continue;
      const itemInfo = await dataStorageService.getByCondition('item', { id: itemId }, undefined);
      const itemType = itemInfo?.type ?? 2;
      if (itemType === 2) {
        for (let i = 0; i < qty; i++) {
          const canAdd = await this.bagService.canAddEquipment(uid);
          if (!canAdd) continue;
          const equipId = await this.equipInstanceService.createFromDrop(uid, itemId);
          if (equipId) {
            try {
              await this.bagService.addEquipInstanceToBag(uid, itemId, String(equipId));
              result.push({ item_id: itemId, name: itemInfo?.name || `物品${itemId}`, count: 1, equipment_uid: String(equipId) });
            } catch {
              await this.equipInstanceService.deleteInstance(equipId);
            }
          }
        }
      } else {
        await this.bagService.addItem(uid, itemId, qty);
        result.push({ item_id: itemId, name: itemInfo?.name || `物品${itemId}`, count: qty });
      }
    }
    return result;
  }

  // ==================== 持久化配置 ====================

  private async saveAutoBattleConfig(uid: Uid, enemyId: number, autoHeal?: any): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length) return;

    let healConfig: AutoBattleConfig['auto_heal'] = null;
    if (autoHeal) {
      let hpItemId = 0;
      let mpItemId = 0;
      if (autoHeal.hp_potion_bag_id) {
        const bag = await this.bagService.get(autoHeal.hp_potion_bag_id);
        if (bag) hpItemId = bag.item_id;
      }
      if (autoHeal.mp_potion_bag_id) {
        const bag = await this.bagService.get(autoHeal.mp_potion_bag_id);
        if (bag) mpItemId = bag.item_id;
      }
      healConfig = {
        hp_enabled: !!autoHeal.hp_enabled,
        hp_item_id: hpItemId,
        hp_threshold: autoHeal.hp_threshold || 50,
        mp_enabled: !!autoHeal.mp_enabled,
        mp_item_id: mpItemId,
        mp_threshold: autoHeal.mp_threshold || 50,
      };
    }

    const config: AutoBattleConfig = {
      enemy_id: enemyId,
      auto_heal: healConfig,
      last_battle_time: Math.floor(Date.now() / 1000),
    };
    await this.playerService.update(players[0].id, { auto_battle_config: config } as any);
  }

  private async updateLastBattleTime(uid: Uid): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length || !players[0].auto_battle_config) return;
    const config = { ...players[0].auto_battle_config, last_battle_time: Math.floor(Date.now() / 1000) };
    await this.playerService.update(players[0].id, { auto_battle_config: config } as any);
  }

  private async clearAutoBattleConfig(uid: Uid): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length) return;
    await this.playerService.update(players[0].id, { auto_battle_config: null } as any);
  }

  private async resolveItemToBagId(uid: Uid, itemId: number): Promise<number | undefined> {
    if (!itemId) return undefined;
    const bags = await this.bagService.list(uid);
    const match = bags.find((b: any) => b.item_id === itemId && !b.equipment_uid);
    return match ? (match.original_id || match.id) : undefined;
  }

  // ==================== 工具 ====================

  private createLoseResult(): BattleResult {
    return {
      result: BattleResultEnum.LOSE,
      rounds: 0, exp: 0, gold: 0, reputation: 0,
      items: [], logs: [],
      create_time: Math.floor(Date.now() / 1000),
    };
  }

  private pushEvent(uid: Uid, type: string, message: string, data?: any): void {
    this._eventSeq++;
    wsManager.sendToUser(uid, {
      type: 'battle',
      data: { event: type, message, _seq: this._eventSeq, ...data },
    });
  }

  private pushBatch(uid: Uid, events: Array<{ event: string; message: string; [k: string]: any }>): void {
    if (!events.length) return;
    const seq = ++this._eventSeq;
    const withSeq = events.map((e, i) => ({ ...e, _seq: seq * 1000 + i }));
    wsManager.sendToUser(uid, { type: 'battle', data: { batch: true, events: withSeq } });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

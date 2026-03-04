/**
 * 战斗核心运行器：通用回合循环，支持 PVE（怪物/Boss）和 PVP
 * 命中、暴击、伤害、五行复用 battle/core.ts
 */
import { calculateHit, calcPhysicalDamage, calcMagicDamage, calcElementBonus } from './core';

/** 战斗单位接口：Player、Monster、Boss 均满足 */
export interface Combatant {
  id?: any;
  name?: string;
  hp: number;
  max_hp?: number;
  mp?: number;
  max_mp?: number;
  phy_atk?: number;
  mag_atk?: number;
  phy_def?: number;
  mag_def?: number;
  hit_rate?: number;
  dodge_rate?: number;
  crit_rate?: number;
  elem_metal?: number;
  elem_wood?: number;
  elem_earth?: number;
  elem_water?: number;
  elem_fire?: number;
  phy_skill_prob?: number;
  mag_skill_prob?: number;
  skill_dmg_pct?: number;
}

export interface SkillInfo {
  name: string;
  damage: number;
  cost: number;
  probability: number;
}

export interface BattleRunResult {
  winner: 'attacker' | 'defender' | 'draw';
  rounds: number;
  attackerHp: number;
  defenderHp: number;
}

export interface BattleRunOptions {
  maxRounds?: number;
  /** VIP 技能概率加成 */
  vipSkillBonus?: number;
  /** 每回合开始前调用，用于自动喝药等 */
  beforeEachRound?: (attacker: Combatant, round: number) => Promise<{ attacker: Combatant; attackerHp: number; roundEvents?: Array<{ event: string; message: string; [k: string]: any }> }>;
  /** 获取攻击方技能，不传则不用技能；若已提供 attackerSkills 则优先使用 */
  getAttackerSkills?: (attacker: Combatant) => Promise<{ physical?: SkillInfo[]; magic?: SkillInfo[] }>;
  /** 预加载的攻击方技能（PVP 优化：避免每回合拉取） */
  attackerSkills?: { physical?: SkillInfo[]; magic?: SkillInfo[] };
  /** 攻击方消耗 MP（技能用） */
  consumeAttackerMp?: (attacker: Combatant, amount: number) => Promise<void>;
  /** 对防守方造成伤害，返回新的防守方 HP；返回 null 表示被他人击杀，战斗终止 */
  applyDamageToDefender?: (damage: number) => Promise<number | null>;
  /** 防守方技能（PVP 时双方都用技能）；若已提供 defenderSkills 则优先使用 */
  getDefenderSkills?: (defender: Combatant) => Promise<{ physical?: SkillInfo[]; magic?: SkillInfo[] }>;
  /** 预加载的防守方技能（PVP 优化：避免每回合拉取） */
  defenderSkills?: { physical?: SkillInfo[]; magic?: SkillInfo[] };
  consumeDefenderMp?: (defender: Combatant, amount: number) => Promise<void>;
  /** 推送单事件 */
  pushEvent?: (event: string, message: string, data?: any) => void;
  /** 推送批量事件 */
  pushBatch?: (events: Array<{ event: string; message: string; [k: string]: any }>) => void;
  /** 检查是否应停止（如手动停止） */
  shouldStop?: () => boolean;
  /** 回合间延迟 ms */
  delayMs?: number;
}

const DEFAULT_MAX_ROUNDS = 100;

export async function runBattle(
  attacker: Combatant,
  defender: Combatant,
  options: BattleRunOptions
): Promise<BattleRunResult> {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const delayMs = options.delayMs ?? 1000;
  let attackerHp = attacker.hp;
  let defenderHp = defender.hp;
  const maxAttackerHp = attacker.max_hp ?? attacker.hp;
  const maxAttackerMp = attacker.max_mp ?? attacker.mp ?? 0;
  const maxDefenderHp = defender.max_hp ?? defender.hp;
  const defenderName = defender.name ?? '对手';

  const pushEvent = options.pushEvent || (() => {});
  const pushBatch = options.pushBatch || (() => {});

  pushEvent('battle_start', `战斗开始！对阵${defenderName}`, {
    player_hp: attackerHp, player_max_hp: maxAttackerHp,
    monster_hp: defenderHp, monster_max_hp: maxDefenderHp,
  });

  let round = 1;
  let currentAttacker: Combatant = { ...attacker, hp: attackerHp, mp: attacker.mp ?? 0 };
  let currentDefender = { ...defender, hp: defenderHp };

  while (attackerHp > 0 && defenderHp > 0 && round <= maxRounds) {
    if (options.shouldStop?.()) {
      return { winner: 'defender', rounds: round - 1, attackerHp: 0, defenderHp };
    }

    const roundEvents: Array<{ event: string; message: string; [k: string]: any }> = [];
    if (options.beforeEachRound) {
      const updated = await options.beforeEachRound(currentAttacker, round);
      currentAttacker = updated.attacker;
      attackerHp = updated.attackerHp;
      if (updated.roundEvents?.length) roundEvents.push(...updated.roundEvents);
    }
    const add = (ev: string, msg: string, d?: any) => roundEvents.push({ event: ev, message: msg, ...d });

    add('round_start', `回合 ${round}`);

    const pElemMul = 1 + calcElementBonus(currentAttacker, currentDefender) / 100;
    const mElemMul = 1 + calcElementBonus(currentDefender, currentAttacker) / 100;

    let totalDamageToDefender = 0;

    // 攻击方技能（优先使用预加载，避免每回合拉取）
    const skills = options.attackerSkills ?? (options.getAttackerSkills ? await options.getAttackerSkills(currentAttacker) : null);
    const skillDmgMul = (currentAttacker.skill_dmg_pct ? (1 + currentAttacker.skill_dmg_pct / 100) : 1);
    const vipBonus = options.vipSkillBonus ?? 0;
    if (skills?.physical?.length && options.consumeAttackerMp) {
      const s = skills.physical[0];
      const prob = s.probability + (currentAttacker.phy_skill_prob || 0) + vipBonus;
      const curMp = currentAttacker.mp ?? 0;
      if (Math.random() * 100 < prob && curMp >= s.cost) {
        const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
        totalDamageToDefender += dmg;
        const newMp = curMp - s.cost;
        currentAttacker = { ...currentAttacker, mp: newMp };
        await options.consumeAttackerMp!({ ...currentAttacker, mp: newMp }, s.cost);
        add('player_skill_attack', `你使用了 ${s.name} ${defenderName} 掉血 ${dmg}`, {
          damage: dmg, player_hp: attackerHp, player_max_hp: maxAttackerHp,
          monster_hp: defenderHp - totalDamageToDefender, monster_max_hp: maxDefenderHp,
        });
      }
    }
    if (skills?.magic?.length && options.consumeAttackerMp) {
      const s = skills.magic[0];
      const prob = s.probability + (currentAttacker.mag_skill_prob || 0) + vipBonus;
      const curMp2 = currentAttacker.mp ?? 0;
      if (Math.random() * 100 < prob && curMp2 >= s.cost) {
        const dmg = Math.floor(s.damage * skillDmgMul * pElemMul);
        totalDamageToDefender += dmg;
        const newMp = curMp2 - s.cost;
        currentAttacker = { ...currentAttacker, mp: newMp };
        await options.consumeAttackerMp!({ ...currentAttacker, mp: newMp }, s.cost);
        add('player_skill_attack', `你使用了 ${s.name} ${defenderName} 掉血 ${dmg}`, {
          damage: dmg, player_hp: attackerHp, player_max_hp: maxAttackerHp,
          monster_hp: defenderHp - totalDamageToDefender, monster_max_hp: maxDefenderHp,
        });
      }
    }

    // 攻击方物理/魔法
    const pPhyHit = calculateHit(currentAttacker, currentDefender);
    const pPhyRaw = pPhyHit ? calcPhysicalDamage(currentAttacker, currentDefender) : { damage: 0, isCrit: false };
    const pPhy = { damage: Math.floor(pPhyRaw.damage * pElemMul), isCrit: pPhyRaw.isCrit };
    const pMagHit = calculateHit(currentAttacker, currentDefender);
    const pMagRaw = pMagHit ? calcMagicDamage(currentAttacker, currentDefender) : { damage: 0, isCrit: false };
    const pMag = { damage: Math.floor(pMagRaw.damage * pElemMul), isCrit: pMagRaw.isCrit };
    totalDamageToDefender += pPhy.damage + pMag.damage;

    const critTag = (c: boolean) => c ? '【暴击】' : '';
    add('player_phy_attack', pPhyHit
      ? `你使用了 物理攻击${critTag(pPhy.isCrit)} ${defenderName} 掉血 ${pPhy.damage}`
      : `你使用了 物理攻击 ${defenderName} 掉血 未命中`, {
      damage: pPhy.damage, is_crit: pPhy.isCrit, player_hp: attackerHp, player_max_hp: maxAttackerHp,
      monster_hp: defenderHp - totalDamageToDefender, monster_max_hp: maxDefenderHp,
    });
    add('player_mag_attack', pMagHit
      ? `你使用了 魔法攻击${critTag(pMag.isCrit)} ${defenderName} 掉血 ${pMag.damage}`
      : `你使用了 魔法攻击 ${defenderName} 掉血 未命中`, {
      damage: pMag.damage, is_crit: pMag.isCrit, player_hp: attackerHp, player_max_hp: maxAttackerHp,
      monster_hp: defenderHp - totalDamageToDefender, monster_max_hp: maxDefenderHp,
    });

    if (options.applyDamageToDefender) {
      const newHp = await options.applyDamageToDefender(totalDamageToDefender);
      if (newHp === null) {
        pushEvent('battle_lose', 'Boss 已被其他玩家击杀');
        return { winner: 'defender', rounds: round - 1, attackerHp: 0, defenderHp: 0 };
      }
      defenderHp = newHp;
    } else {
      defenderHp = Math.max(0, defenderHp - totalDamageToDefender);
    }

    // 防守方技能（PVP 时；优先使用预加载）
    let totalDamageToAttacker = 0;
    const defSkills = options.defenderSkills ?? (options.getDefenderSkills ? await options.getDefenderSkills(currentDefender) : null);
    const defSkillDmgMul = (currentDefender.skill_dmg_pct ? (1 + currentDefender.skill_dmg_pct / 100) : 1);
    const defVipBonus = options.vipSkillBonus ?? 0;
    if (defSkills?.physical?.length && options.consumeDefenderMp) {
      const s = defSkills.physical[0];
      const prob = s.probability + (currentDefender.phy_skill_prob || 0) + defVipBonus;
      const defMp = currentDefender.mp ?? 0;
      if (Math.random() * 100 < prob && defMp >= s.cost) {
        const dmg = Math.floor(s.damage * defSkillDmgMul * mElemMul);
        totalDamageToAttacker += dmg;
        currentDefender = { ...currentDefender, mp: defMp - s.cost };
        await options.consumeDefenderMp!({ ...currentDefender, mp: defMp - s.cost }, s.cost);
        add('monster_skill_attack', `${defenderName} 使用了 ${s.name} 你 掉血 ${dmg}`, {
          damage: dmg, player_hp: attackerHp - totalDamageToAttacker, player_max_hp: maxAttackerHp,
          monster_hp: defenderHp, monster_max_hp: maxDefenderHp,
        });
      }
    }
    if (defSkills?.magic?.length && options.consumeDefenderMp) {
      const s = defSkills.magic[0];
      const prob = s.probability + (currentDefender.mag_skill_prob || 0) + defVipBonus;
      const defMp = currentDefender.mp ?? 0;
      if (Math.random() * 100 < prob && defMp >= s.cost) {
        const dmg = Math.floor(s.damage * defSkillDmgMul * mElemMul);
        totalDamageToAttacker += dmg;
        currentDefender = { ...currentDefender, mp: defMp - s.cost };
        await options.consumeDefenderMp!({ ...currentDefender, mp: defMp - s.cost }, s.cost);
        add('monster_skill_attack', `${defenderName} 使用了 ${s.name} 你 掉血 ${dmg}`, {
          damage: dmg, player_hp: attackerHp - totalDamageToAttacker, player_max_hp: maxAttackerHp,
          monster_hp: defenderHp, monster_max_hp: maxDefenderHp,
        });
      }
    }

    // 防守方物理/魔法反击
    const mPhyHit = calculateHit(currentDefender, currentAttacker);
    const mPhyRaw = mPhyHit ? calcPhysicalDamage(currentDefender, currentAttacker) : { damage: 0, isCrit: false };
    const mPhy = { damage: Math.floor(mPhyRaw.damage * mElemMul), isCrit: mPhyRaw.isCrit };
    const mMagHit = calculateHit(currentDefender, currentAttacker);
    const mMagRaw = mMagHit ? calcMagicDamage(currentDefender, currentAttacker) : { damage: 0, isCrit: false };
    const mMag = { damage: Math.floor(mMagRaw.damage * mElemMul), isCrit: mMagRaw.isCrit };

    attackerHp = Math.max(0, attackerHp - totalDamageToAttacker - mPhy.damage - mMag.damage);

    add('monster_phy_attack', mPhyHit
      ? `${defenderName} 使用了 物理攻击${critTag(mPhy.isCrit)} 你 掉血 ${mPhy.damage}`
      : `${defenderName} 使用了 物理攻击 你 掉血 未命中`, {
      damage: mPhy.damage, is_crit: mPhy.isCrit, player_hp: attackerHp, player_max_hp: maxAttackerHp,
      monster_hp: defenderHp, monster_max_hp: maxDefenderHp,
    });
    add('monster_mag_attack', mMagHit
      ? `${defenderName} 使用了 魔法攻击${critTag(mMag.isCrit)} 你 掉血 ${mMag.damage}`
      : `${defenderName} 使用了 魔法攻击 你 掉血 未命中`, {
      damage: mMag.damage, is_crit: mMag.isCrit, player_hp: attackerHp, player_max_hp: maxAttackerHp,
      monster_hp: defenderHp, monster_max_hp: maxDefenderHp,
    });

    pushBatch(roundEvents);
    await new Promise(r => setTimeout(r, delayMs));

    round++;
  }

  if (attackerHp > 0 && defenderHp > 0) {
    pushEvent('battle_draw', `战斗超过${maxRounds}回合，判定为平局`);
    return { winner: 'draw', rounds: round - 1, attackerHp, defenderHp };
  }
  if (attackerHp <= 0 && defenderHp <= 0) {
    pushEvent('battle_draw', '战斗平局');
    return { winner: 'draw', rounds: round - 1, attackerHp: 0, defenderHp: 0 };
  }
  if (attackerHp <= 0) {
    pushEvent('battle_lose', '战斗失败');
    return { winner: 'defender', rounds: round - 1, attackerHp: 0, defenderHp };
  }

  pushEvent('battle_win', `战斗胜利！击败了${defenderName}`);
  return { winner: 'attacker', rounds: round - 1, attackerHp, defenderHp: 0 };
}

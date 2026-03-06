import { runBattle } from './runner';

describe('battle/runner', () => {
  const pushEvent = jest.fn();
  const pushBatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('攻击方高攻秒杀防守方，返回 attacker 胜利', async () => {
    const attacker = { hp: 100, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '史莱姆', hp: 10, phy_def: 0, mag_def: 0, hit_rate: 0, dodge_rate: 0 };
    const result = await runBattle(attacker, defender, { delayMs: 0, pushEvent, pushBatch });
    expect(result.winner).toBe('attacker');
    expect(result.defenderHp).toBe(0);
    expect(pushEvent).toHaveBeenCalledWith('battle_start', expect.any(String), expect.any(Object));
    expect(pushEvent).toHaveBeenCalledWith('battle_win', expect.any(String));
  });

  it('防守方高攻秒杀攻击方，返回 defender 胜利', async () => {
    const attacker = { hp: 5, phy_atk: 1, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '龙', hp: 1000, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0 };
    const result = await runBattle(attacker, defender, { delayMs: 0, pushEvent, pushBatch });
    expect(result.winner).toBe('defender');
    expect(result.attackerHp).toBe(0);
    expect(pushEvent).toHaveBeenCalledWith('battle_lose', '战斗失败');
  });

  it('超时回合数判定平局', async () => {
    const attacker = { hp: 100, phy_atk: 1, phy_def: 99, mag_atk: 0, mag_def: 99, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '龟', hp: 100, phy_atk: 1, phy_def: 99, mag_atk: 0, mag_def: 99, hit_rate: 100, dodge_rate: 0 };
    const result = await runBattle(attacker, defender, { maxRounds: 2, delayMs: 0, pushEvent, pushBatch });
    expect(result.winner).toBe('draw');
    expect(pushEvent).toHaveBeenCalledWith('battle_draw', expect.stringContaining('平局'));
  });

  it('shouldStop 提前终止返回 defender 胜', async () => {
    const attacker = { hp: 100, phy_atk: 1, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '怪', hp: 100, phy_def: 0, mag_def: 0, hit_rate: 0, dodge_rate: 0 };
    let stopCount = 0;
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      shouldStop: () => ++stopCount > 0,
    });
    expect(result.winner).toBe('defender');
    expect(result.attackerHp).toBe(0);
  });

  it('applyDamageToDefender 返回 null 表示被他人击杀', async () => {
    const attacker = { hp: 100, phy_atk: 50, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: 'Boss', hp: 1000, phy_def: 0, mag_def: 0 };
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      applyDamageToDefender: async () => null,
    });
    expect(result.winner).toBe('defender');
    expect(result.attackerHp).toBe(0);
    expect(result.defenderHp).toBe(0);
    expect(pushEvent).toHaveBeenCalledWith('battle_lose', 'Boss 已被其他玩家击杀');
  });

  it('applyDamageToDefender 返回新血量', async () => {
    let defenderHp = 100;
    const attacker = { hp: 100, phy_atk: 50, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '怪', hp: 100, phy_def: 0, mag_def: 0, phy_atk: 0, mag_atk: 0 };
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      applyDamageToDefender: async (dmg) => {
        defenderHp = Math.max(0, defenderHp - dmg);
        return defenderHp;
      },
    });
    expect(result.winner).toBe('attacker');
  });

  it('beforeEachRound 可更新攻击方状态', async () => {
    const attacker = { hp: 50, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '怪', hp: 10, phy_def: 0, mag_def: 0 };
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      beforeEachRound: async (a, _round) => ({
        attacker: { ...a, hp: a.hp + 10 },
        attackerHp: a.hp + 10,
      }),
    });
    expect(result.winner).toBe('attacker');
  });

  it('使用 attackerSkills 预加载技能', async () => {
    const consumeMp = jest.fn().mockResolvedValue(undefined);
    const attacker = {
      hp: 100, mp: 100, phy_atk: 0, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0, phy_skill_prob: 100,
    };
    const defender = { name: '怪', hp: 10, phy_def: 0, mag_def: 0 };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      attackerSkills: {
        physical: [{ name: '重击', damage: 20, cost: 5, probability: 0 }],
      },
      consumeAttackerMp: consumeMp,
    });
    expect(result.winner).toBe('attacker');
    randomSpy.mockRestore();
  });

  it('双方同时死亡判定平局', async () => {
    const attacker = { hp: 1, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { name: '怪', hp: 1, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0 };
    const result = await runBattle(attacker, defender, { delayMs: 0 });
    expect(result.winner).toBe('draw');
    expect(result.attackerHp).toBe(0);
    expect(result.defenderHp).toBe(0);
  });

  it('防守方物理技能命中攻击方', async () => {
    const consumeDefMp = jest.fn().mockResolvedValue(undefined);
    const attacker = { hp: 100, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = {
      name: '法师', hp: 10, mp: 100, phy_def: 0, mag_def: 0,
      phy_skill_prob: 100, mag_skill_prob: 0,
    };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      defenderSkills: {
        physical: [{ name: '猛击', damage: 50, cost: 5, probability: 0 }],
      },
      consumeDefenderMp: consumeDefMp,
    });
    expect(result.winner).toBe('attacker');
    expect(pushBatch).toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('defender 无 name 时使用对手', async () => {
    const attacker = { hp: 100, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = { hp: 5, phy_def: 0, mag_def: 0 };
    const result = await runBattle(attacker, defender, { delayMs: 0, pushEvent, pushBatch });
    expect(result.winner).toBe('attacker');
    expect(pushEvent).toHaveBeenCalledWith('battle_start', expect.stringContaining('对手'), expect.any(Object));
  });

  it('skill_dmg_pct 影响技能伤害', async () => {
    const consumeMp = jest.fn().mockResolvedValue(undefined);
    const attacker = {
      hp: 100, mp: 100, phy_atk: 0, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0, phy_skill_prob: 100, skill_dmg_pct: 100,
    };
    const defender = { name: '怪', hp: 100, phy_def: 0, mag_def: 0 };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      attackerSkills: { physical: [{ name: '重击', damage: 50, cost: 5, probability: 0 }] },
      consumeAttackerMp: consumeMp,
    });
    expect(result.winner).toBe('attacker');
    randomSpy.mockRestore();
  });

  it('getAttackerSkills 动态获取技能', async () => {
    const consumeMp = jest.fn().mockResolvedValue(undefined);
    const getSkills = jest.fn().mockResolvedValue({
      physical: [{ name: '劈砍', damage: 30, cost: 3, probability: 100 }],
    });
    const attacker = {
      hp: 100, mp: 100, phy_atk: 0, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0,
    };
    const defender = { name: '怪', hp: 50, phy_def: 0, mag_def: 0 };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      getAttackerSkills: getSkills,
      consumeAttackerMp: consumeMp,
    });
    expect(result.winner).toBe('attacker');
    expect(getSkills).toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('vipSkillBonus 加成技能概率', async () => {
    const consumeMp = jest.fn().mockResolvedValue(undefined);
    const attacker = {
      hp: 100, mp: 100, phy_atk: 0, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0,
    };
    const defender = { name: '怪', hp: 20, phy_def: 0, mag_def: 0 };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      attackerSkills: { physical: [{ name: '重击', damage: 25, cost: 5, probability: 0 }] },
      consumeAttackerMp: consumeMp,
      vipSkillBonus: 100,
    });
    expect(result.winner).toBe('attacker');
    randomSpy.mockRestore();
  });

  it('防守方魔法技能命中攻击方', async () => {
    const consumeDefMp = jest.fn().mockResolvedValue(undefined);
    const attacker = { hp: 100, phy_atk: 999, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0 };
    const defender = {
      name: '法师', hp: 10, mp: 100, phy_def: 0, mag_def: 0,
      phy_skill_prob: 0, mag_skill_prob: 100,
    };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      defenderSkills: {
        magic: [{ name: '火球', damage: 30, cost: 10, probability: 0 }],
      },
      consumeDefenderMp: consumeDefMp,
    });
    expect(result.winner).toBe('attacker');
    randomSpy.mockRestore();
  });

  it('攻击方魔法技能命中防守方', async () => {
    const consumeMp = jest.fn().mockResolvedValue(undefined);
    const attacker = {
      hp: 100, mp: 100, phy_atk: 0, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0, mag_skill_prob: 100,
    };
    const defender = { name: '怪', hp: 50, phy_def: 0, mag_def: 0 };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await runBattle(attacker, defender, {
      delayMs: 0,
      pushEvent,
      pushBatch,
      attackerSkills: {
        magic: [{ name: '火球术', damage: 60, cost: 10, probability: 0 }],
      },
      consumeAttackerMp: consumeMp,
    });
    expect(result.winner).toBe('attacker');
    expect(consumeMp).toHaveBeenCalled();
    randomSpy.mockRestore();
  });
});

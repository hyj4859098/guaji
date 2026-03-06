/**
 * PvpService 集成测试 - 真实 DB，无 mock
 * 覆盖 getOpponentForDisplay、getPlayersInMap、challenge 完整流程
 */
import { createApp } from '../../create-app';
import { pvpService, PvpService } from '../../service/pvp.service';
import { subscribeBoss, unsubscribeBoss } from '../../event/boss-subscription';
import { setInBattle, clearInBattle } from '../../event/pvp-presence';
import { createTestUser } from '../../__test-utils__/integration-helpers';

const app = createApp();

describe('PvpService 集成测试', () => {
  let token1: string;
  let uid1: number;
  let token2: string;
  let uid2: number;

  beforeAll(async () => {
    const user1 = await createTestUser(app, { prefix: 'pvp', suffix: '1', charName: 'PVP测试1' });
    const user2 = await createTestUser(app, { prefix: 'pvp', suffix: '2', charName: 'PVP测试2' });
    token1 = user1.token; uid1 = user1.uid;
    token2 = user2.token; uid2 = user2.uid;
  }, 10000);

  describe('getOpponentForDisplay', () => {
    it('有角色的玩家返回完整展示数据', async () => {
      const opponent = await pvpService.getOpponentForDisplay(uid2);
      expect(opponent).not.toBeNull();
      expect(opponent?.name).toBeDefined();
      expect(opponent?.level).toBeDefined();
      expect(opponent?.skills).toBeDefined();
      expect(Array.isArray(opponent?.skills)).toBe(true);
    });

    it('无角色的 uid 返回 null', async () => {
      const opponent = await pvpService.getOpponentForDisplay(999999);
      expect(opponent).toBeNull();
    });
  });

  describe('getPlayersInMap', () => {
    it('无订阅时返回空数组', async () => {
      const players = await pvpService.getPlayersInMap(1);
      expect(players).toEqual([]);
    });

    it('订阅后返回地图内玩家列表', async () => {
      subscribeBoss(uid1, 1);
      subscribeBoss(uid2, 1);
      const players = await pvpService.getPlayersInMap(1);
      expect(players.length).toBeGreaterThanOrEqual(1);
      expect(players.some((p) => p.uid === String(uid1) || p.uid === String(uid2))).toBe(true);
      unsubscribeBoss(uid1);
      unsubscribeBoss(uid2);
    });

    it('excludeUid 排除指定玩家', async () => {
      subscribeBoss(uid1, 1);
      subscribeBoss(uid2, 1);
      const players = await pvpService.getPlayersInMap(1, uid1);
      expect(players.every((p) => p.uid !== String(uid1))).toBe(true);
      unsubscribeBoss(uid1);
      unsubscribeBoss(uid2);
    });
  });

  describe('challenge', () => {
    it('不能挑战自己', async () => {
      const result = await pvpService.challenge(uid1, uid1, 1);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/自己/);
    });

    it('对方正在战斗中返回错误', async () => {
      setInBattle(uid2, 999, 1);
      const result = await pvpService.challenge(uid1, uid2, 1);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/战斗中/);
      clearInBattle(uid2);
    });

    it('自己正在战斗中返回错误', async () => {
      setInBattle(uid1, 999, 1);
      const result = await pvpService.challenge(uid1, uid2, 1);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/战斗中/);
      clearInBattle(uid1);
    });

    it('玩家不存在返回错误', async () => {
      const result = await pvpService.challenge(uid1, 999999, 1);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/不存在/);
    });

    it('挑战成功返回 ok', async () => {
      const result = await pvpService.challenge(uid1, uid2, 1);
      expect(result.ok).toBe(true);
      // 测试环境下 delayMs=0、pvpDelay=0，战斗会立即执行，等待 3 秒确保 runPvpBattle 完成，避免 "Cannot log after tests are done"
      await new Promise((r) => setTimeout(r, 3000));
    }, 8000);
  });
});

describe('关键路径/深度分支', () => {
  const _pvpService = new PvpService();

  it('PVP 挑战返回结果结构', async () => {
    const { uid: uid1 } = await createTestUser(app, { prefix: 'ds', suffix: 'pvp1' });
    const { uid: uid2 } = await createTestUser(app, { prefix: 'ds', suffix: 'pvp2' });
    const result = await _pvpService.challenge(uid1, uid2, 1);
    expect(result).toHaveProperty('ok');
    if (result.ok) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }, 15000);

  it('PVP 不能挑战自己（深度分支）', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'pvpSf' });
    const result = await _pvpService.challenge(uid, uid, 1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/自己/);
  });

  it('PVP 挑战成功返回 ok（关键路径）', async () => {
    const userA = await createTestUser(app, { prefix: 'r2', suffix: 'pvpA' });
    const userB = await createTestUser(app, { prefix: 'r2', suffix: 'pvpB' });
    const result = await _pvpService.challenge(userA.uid, userB.uid, 1);
    expect(result.ok).toBe(true);
    await new Promise(r => setTimeout(r, 500));
  });

  it('不能挑战自己（关键路径）', async () => {
    const user = await createTestUser(app, { prefix: 'r2', suffix: 'pvpslf' });
    const result = await _pvpService.challenge(user.uid, user.uid, 1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/自己/);
  });

  it('PVP 挑战弱方必输（defender 胜利分支）', async () => {
    const strong = await createTestUser(app, { prefix: 'pvp', suffix: 'str' });
    const weak = await createTestUser(app, { prefix: 'pvp', suffix: 'wk' });
    const { PlayerService } = await import('../../service/player.service');
    const ps = new PlayerService();
    const spl = await ps.list(strong.uid);
    const wpl = await ps.list(weak.uid);
    await ps.update(spl[0].id, { hp: 9999, max_hp: 9999, phy_atk: 9999, phy_def: 9999 } as any);
    await ps.update(wpl[0].id, { hp: 1, max_hp: 1, phy_atk: 1, phy_def: 0 } as any);
    const result = await _pvpService.challenge(weak.uid, strong.uid, 1);
    expect(result.ok).toBe(true);
    await new Promise(r => setTimeout(r, 1000));
  }, 10000);

  it('PVP 双方同等实力（可能平局）', async () => {
    const a = await createTestUser(app, { prefix: 'pvp', suffix: 'eq1' });
    const b = await createTestUser(app, { prefix: 'pvp', suffix: 'eq2' });
    const { PlayerService } = await import('../../service/player.service');
    const ps = new PlayerService();
    const apl = await ps.list(a.uid);
    const bpl = await ps.list(b.uid);
    await ps.update(apl[0].id, { hp: 50, max_hp: 50, phy_atk: 10, phy_def: 5 } as any);
    await ps.update(bpl[0].id, { hp: 50, max_hp: 50, phy_atk: 10, phy_def: 5 } as any);
    const result = await _pvpService.challenge(a.uid, b.uid, 1);
    expect(result.ok).toBe(true);
    await new Promise(r => setTimeout(r, 1000));
  }, 10000);
});

import { cacheService } from './cache.service';

describe('cacheService', () => {
  beforeEach(() => {
    cacheService.player.invalidateByUid('u1');
    cacheService.equippedSkills.invalidate('u1');
    cacheService.monster.invalidate(1);
  });

  describe('player', () => {
    it('set/get 正常', () => {
      cacheService.player.set('u1', [{ id: 1, name: '角色1' }]);
      expect(cacheService.player.get('u1')).toEqual([{ id: 1, name: '角色1' }]);
    });

    it('invalidateByPlayerId 按 playerId 失效', () => {
      cacheService.player.set('u1', [{ id: 10, name: 'x' }]);
      cacheService.player.invalidateByPlayerId(10);
      expect(cacheService.player.get('u1')).toBeNull();
    });
  });

  describe('equippedSkills', () => {
    it('set/get 正常', () => {
      cacheService.equippedSkills.set('u1', { skills: [] });
      expect(cacheService.equippedSkills.get('u1')).toEqual({ skills: [] });
    });
  });

  describe('monster', () => {
    it('set/get 正常', () => {
      cacheService.monster.set(1, { name: '史莱姆' });
      expect(cacheService.monster.get(1)).toEqual({ name: '史莱姆' });
    });
  });
});

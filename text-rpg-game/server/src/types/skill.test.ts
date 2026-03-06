import { SkillTypeEnum } from './skill';

describe('skill', () => {
  describe('SkillTypeEnum', () => {
    it('物理=0 魔法=1', () => {
      expect(SkillTypeEnum.PHYSICAL).toBe(0);
      expect(SkillTypeEnum.MAGIC).toBe(1);
    });
  });
});

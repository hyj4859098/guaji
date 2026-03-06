const SkillPage = {
  style: '',

  skills: [],
  equippedSkills: {
    physical: [],
    magic: []
  },

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="skill-container">
        <!-- 物理技能 -->
        <div class="skill-module physical-skills">
          <h3>物理技能</h3>
          <div id="physicalSkills">
            <div class="empty-skills">暂无物理技能</div>
          </div>
        </div>
        
        <!-- 魔法技能 -->
        <div class="skill-module magic-skills">
          <h3>魔法技能</h3>
          <div id="magicSkills">
            <div class="empty-skills">暂无魔法技能</div>
          </div>
        </div>
        
        <!-- 技能学习提示 -->
        <div class="skill-learning">
          <h4>技能学习</h4>
          <p>使用技能书可以学习新技能</p>
          <p>每种技能类型最多只能装备1个技能</p>
        </div>
      </div>
    `;
    
    this.renderSkills();
  },

  async load() {
    try {
      // 获取技能列表
      const skillsResult = await API.get('/skill/list');
      if (skillsResult.code === 0 && Array.isArray(skillsResult.data)) {
        this.skills = skillsResult.data;
      } else {
        this.skills = [];
      }
      
      // 获取已装备的技能
      const equippedResult = await API.get('/skill/equipped');
      if (equippedResult.code === 0 && equippedResult.data) {
        this.equippedSkills = equippedResult.data;
      }
    } catch (error) {
      console.error('加载技能失败:', error);
      this.skills = [];
    } finally {
      this.render();
    }
  },

  renderSkills() {
    // type: 0=物理, 1=魔法（与数据库一致）
    const physicalSkills = this.skills.filter(skill => skill.type === 0);
    const magicSkills = this.skills.filter(skill => skill.type === 1);
    
    // 渲染物理技能
    const physicalContainer = document.getElementById('physicalSkills');
    if (physicalSkills.length > 0) {
      physicalContainer.innerHTML = physicalSkills.map(skill => `
        <div class="skill-card ${skill.is_equipped === 1 ? 'equipped' : ''}" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="skill-name" style="flex: 1;">${skill.name}</div>
          <div style="display: flex; gap: 12px; flex: 2; flex-wrap: wrap;">
            <div class="skill-info">消耗: ${skill.cost} MP</div>
            <div class="skill-info">伤害: ${skill.damage}</div>
            <div class="skill-info">概率: ${skill.probability}%</div>
          </div>
          ${skill.is_equipped === 1 ? 
            `<button class="skill-btn unequip-btn" onclick="SkillPage.unequipSkill(${skill.skill_id ?? skill.id})">卸下</button>` : 
            `<button class="skill-btn equip-btn" onclick="SkillPage.equipSkill(${skill.skill_id ?? skill.id})">装备</button>`
          }
        </div>
      `).join('');
    } else {
      physicalContainer.innerHTML = '<div class="empty-skills">暂无物理技能</div>';
    }
    
    // 渲染魔法技能
    const magicContainer = document.getElementById('magicSkills');
    if (magicSkills.length > 0) {
      magicContainer.innerHTML = magicSkills.map(skill => `
        <div class="skill-card ${skill.is_equipped === 1 ? 'equipped' : ''}" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="skill-name" style="flex: 1;">${skill.name}</div>
          <div style="display: flex; gap: 12px; flex: 2; flex-wrap: wrap;">
            <div class="skill-info">消耗: ${skill.cost} MP</div>
            <div class="skill-info">伤害: ${skill.damage}</div>
            <div class="skill-info">概率: ${skill.probability}%</div>
          </div>
          ${skill.is_equipped === 1 ? 
            `<button class="skill-btn unequip-btn" onclick="SkillPage.unequipSkill(${skill.skill_id ?? skill.id})">卸下</button>` : 
            `<button class="skill-btn equip-btn" onclick="SkillPage.equipSkill(${skill.skill_id ?? skill.id})">装备</button>`
          }
        </div>
      `).join('');
    } else {
      magicContainer.innerHTML = '<div class="empty-skills">暂无魔法技能</div>';
    }
  },

  async equipSkill(skillId) {
    try {
      const result = await API.post('/skill/equip', { skill_id: skillId });
      if (result.code === 0) {
        UI.showToast('技能装备成功');
        await this.load();
      } else {
        UI.showToast(result.msg || '装备失败');
      }
    } catch (error) {
      console.error('装备技能失败:', error);
      UI.showToast('装备技能失败');
    }
  },

  async unequipSkill(skillId) {
    try {
      const result = await API.post('/skill/unequip', { skill_id: skillId });
      if (result.code === 0) {
        UI.showToast('技能卸下成功');
        await this.load();
      } else {
        UI.showToast(result.msg || '卸下失败');
      }
    } catch (error) {
      console.error('卸下技能失败:', error);
      UI.showToast('卸下技能失败');
    }
  }
};

const SkillPage = {
  style: `
    <style>
      body {
        background: #0a1929;
      }
      
      #app {
        background: #0a1929;
        min-height: calc(100vh - 140px);
        position: relative;
      }
      
      /* 技能容器样式 */
      .skill-container {
        position: relative;
        width: 100%;
        height: 800px;
        background: #0a1929;
        padding: 20px;
        box-sizing: border-box;
      }
      
      /* 模块基础样式 */
      .skill-module {
        position: absolute;
        background: #1a202c;
        border-radius: 8px;
        padding: 16px;
        color: #e2e8f0;
        overflow-y: auto;
        z-index: 1;
        min-width: 45%;
        height: 650px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      /* 物理技能模块 */
      .physical-skills {
        left: 20px;
        top: 20px;
      }
      
      /* 魔法技能模块 */
      .magic-skills {
        right: 20px;
        top: 20px;
      }
      
      /* 模块标题样式 */
      .skill-module h3 {
        margin-top: 0;
        margin-bottom: 16px;
        color: #4299e1;
        font-size: 16px;
        border-bottom: 1px solid rgba(66, 153, 225, 0.2);
        padding-bottom: 8px;
      }
      
      /* 技能卡片样式 */
      .skill-card {
        background: #2d3748;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      }
      
      .skill-card:hover {
        border-color: #4299e1;
        box-shadow: 0 0 10px rgba(66, 153, 225, 0.3);
      }
      
      .skill-card.equipped {
        border-color: #48bb78;
        background: rgba(72, 187, 120, 0.1);
      }
      
      .skill-name {
        font-size: 16px;
        font-weight: bold;
        color: #e2e8f0;
        margin-bottom: 8px;
      }
      
      .skill-info {
        font-size: 14px;
        color: #a0aec0;
        margin-bottom: 8px;
      }
      
      .skill-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .skill-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.3s ease;
      }
      
      .equip-btn {
        background: #48bb78;
        color: white;
      }
      
      .equip-btn:hover {
        background: #38a169;
      }
      
      .unequip-btn {
        background: #f56565;
        color: white;
      }
      
      .unequip-btn:hover {
        background: #e53e3e;
      }
      
      /* 空技能提示 */
      .empty-skills {
        text-align: center;
        color: #a0aec0;
        margin-top: 40px;
        font-size: 14px;
      }
      
      /* 技能学习提示 */
      .skill-learning {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        padding: 16px;
        border-radius: 8px;
        color: #e2e8f0;
        text-align: center;
        width: 300px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .skill-learning h4 {
        margin-top: 0;
        margin-bottom: 8px;
        color: #4299e1;
      }
      
      .skill-learning p {
        margin: 0;
        font-size: 14px;
        color: #a0aec0;
      }
    </style>
  `,

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

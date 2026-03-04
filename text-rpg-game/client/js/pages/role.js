// 角色信息页面样式
const style = document.createElement('style');
style.textContent = `
  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .role-header h2 {
    font-size: 20px;
    font-weight: bold;
    color: #4a90e2;
  }
  
  .role-level {
    background: linear-gradient(135deg, #4a90e2, #50e3c2);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: bold;
  }
  
  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    background: none;
    border-radius: 0;
    backdrop-filter: none;
    border: none;
    transition: all 0.3s ease;
  }
  
  .stat-item:hover {
    background: none;
    border-color: transparent;
  }
  
  .stat-item span:first-child {
    font-size: 14px;
    color: #ccc;
  }
  
  .stat-item span:last-child {
    font-size: 14px;
    font-weight: bold;
    color: #fff;
  }
`;
document.head.appendChild(style);

const RolePage = {
  levelExp: 0,

  async load() {
    await EquipPage.load();
    await BagPage.load();
  },

  render() {
    const roleInfo = document.getElementById('roleInfo');
    if (!roleInfo) return;
    
    roleInfo.innerHTML = `
      <div class="role-header">
        <h2>角色信息</h2>
        <span class="role-level">Lv.${State.player?.level || 1}</span>
      </div>
      <div class="stats-list">
        <div class="stat-item">
          <span>生命</span>
          <span>${State.player?.hp || 0} / ${State.player?.max_hp || 0}</span>
        </div>
        <div class="stat-item">
          <span>蓝量</span>
          <span>${State.player?.mp || 0} / ${State.player?.max_mp || 0}</span>
        </div>
        <div class="stat-item">
          <span>物理攻击</span>
          <span>${State.player?.phy_atk || 0}</span>
        </div>
        <div class="stat-item">
          <span>魔法攻击</span>
          <span>${State.player?.mag_atk || 0}</span>
        </div>
        <div class="stat-item">
          <span>物理防御</span>
          <span>${State.player?.phy_def || 0}</span>
        </div>
        <div class="stat-item">
          <span>魔法防御</span>
          <span>${State.player?.mag_def || 0}</span>
        </div>
        <div class="stat-item">
          <span>命中</span>
          <span>${State.player?.hit_rate || 0}%</span>
        </div>
        <div class="stat-item">
          <span>闪避</span>
          <span>${State.player?.dodge_rate || 0}%</span>
        </div>
        <div class="stat-item">
          <span>暴击</span>
          <span>${State.player?.crit_rate || 0}%</span>
        </div>
        <div class="stat-item">
          <span>经验</span>
          <span>${State.player?.exp || 0} / ${this.levelExp || 100}</span>
        </div>
        <div class="stat-item">
          <span>金币</span>
          <span>${Helper.formatNumber(State.player?.gold || 0)}</span>
        </div>
        <div class="stat-item">
          <span>声望</span>
          <span>${State.player?.reputation || 0}</span>
        </div>
      </div>
    `;
  },

  async load() {
    const result = await API.get('/player/list');

    if (result.code === 0 && result.data.length > 0) {
      State.setPlayer(result.data[0]);
      
      const player = result.data[0];
      const levelExpResult = await API.get('/level_exp/get', { level: player.level });
      if (levelExpResult.code === 0 && levelExpResult.data) {
        this.levelExp = levelExpResult.data.exp;
      } else {
        this.levelExp = 100;
      }
      
      this.render();
    } else {
      UI.showToast('加载角色信息失败');
    }
  }
};

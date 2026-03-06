const RolePage = {
  levelExp: 0,
  isMaxLevel: false,

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
          <span>${this.isMaxLevel ? (State.player?.exp || 0) + '（已满级）' : (State.player?.exp || 0) + ' / ' + (this.levelExp || 100)}</span>
        </div>
        <div class="stat-item">
          <span>金币</span>
          <span>${Helper.formatNumber(State.player?.gold || 0)}</span>
        </div>
        <div class="stat-item">
          <span>声望</span>
          <span>${State.player?.reputation || 0}</span>
        </div>
        <div class="stat-item">
          <span>积分</span>
          <span>${State.player?.points ?? 0}</span>
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
        this.isMaxLevel = !!levelExpResult.data.is_max_level;
      } else {
        this.levelExp = 0;
        this.isMaxLevel = true;
      }
      
      this.render();
    } else {
      UI.showToast('加载角色信息失败');
    }
  }
};

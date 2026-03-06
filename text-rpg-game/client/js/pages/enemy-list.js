const EnemyListPage = {
  style: '',

  enemies: [],
  currentMap: null,

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="enemy-list-container">
        <h1 class="enemy-list-title">敌人列表</h1>
        <div class="enemy-grid">
          ${this.enemies.length > 0 ? this.enemies.map(enemy => `
            <div class="enemy-card">
              <div class="enemy-header">
                <div class="enemy-info">
                  <div class="enemy-name">${enemy.name}</div>
                  <div class="enemy-level">Lv.${enemy.level}</div>
                </div>
                <div class="enemy-image-placeholder">
                  <!-- 图片格，目前没有图片 -->
                </div>
              </div>
              <button class="enemy-battle-btn" onclick="EnemyListPage.startBattle(${enemy.id})">战斗</button>
            </div>
          `).join('') : '<div style="text-align: center; color: #a0aec0; grid-column: 1 / -1;">加载敌人列表中...</div>'}
        </div>
      </div>
    `;
  },

  async load() {
    const mapId = State.getCurrentMapId();
    
    if (!mapId) {
      // 如果没有选择地图，返回地图页面
      navigateTo('map');
      return;
    }
    
    // 获取地图信息
    const mapResult = await API.get(`/map/get?id=${mapId}`);
    
    if (mapResult.code === 0) {
      this.currentMap = mapResult.data;
    }
    
    // 获取该地图的敌人
    const enemyResult = await API.get(`/monster/map?map_id=${mapId}`);

    if (enemyResult.code === 0) {
      this.enemies = enemyResult.data;
    }
    this.render();
  },

  startBattle(enemyId) {
    State.setCurrentEnemyId(enemyId);
    State.setCurrentBossId(0);
    State.setCurrentPvpTargetUid(null);
    State.setCurrentPvpTargetInfo(null);
    State.currentBattleMode = 'monster';
    navigateTo('battle');
  }
};

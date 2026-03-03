const EnemyListPage = {
  style: `
    <style>
      .enemy-list-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .enemy-list-title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 24px;
        text-align: center;
      }
      .enemy-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .enemy-card {
        background: #1a202c;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        min-height: 120px;
      }
      .enemy-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      .enemy-info {
        flex: 1;
      }
      .enemy-name {
        font-size: 18px;
        font-weight: bold;
        color: #e2e8f0;
        margin-bottom: 4px;
      }
      .enemy-level {
        font-size: 12px;
        color: #a0aec0;
      }
      .enemy-image-placeholder {
        width: 50px;
        height: 50px;
        background: #2d3748;
        border-radius: 4px;
        margin-left: 12px;
      }
      .enemy-battle-btn {
        width: 80%;
        padding: 8px;
        background: #4299e1;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.3s ease;
        align-self: center;
      }
      .enemy-battle-btn:hover {
        background: #3182ce;
      }
      .enemy-battle-btn:active {
        transform: scale(0.98);
      }
    </style>
  `,

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
    navigateTo('battle');
  }
};

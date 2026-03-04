/**
 * Boss 列表页 - 与敌人列表流程一致
 * 地图 → Boss列表 → 战斗页
 */
const BossListPage = {
  style: `
    <style>
      .boss-list-container { max-width: 1200px; margin: 0 auto; padding: 24px; }
      .boss-list-title { font-size: 24px; font-weight: bold; margin-bottom: 24px; text-align: center; }
      .boss-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .boss-card {
        background: #1a202c; border-radius: 8px; padding: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;
        display: flex; flex-direction: column; min-height: 120px;
        border-left: 4px solid #ed8936;
      }
      .boss-header { display: flex; align-items: center; margin-bottom: 12px; }
      .boss-info { flex: 1; }
      .boss-name { font-size: 18px; font-weight: bold; color: #f6ad55; margin-bottom: 4px; }
      .boss-level { font-size: 12px; color: #a0aec0; }
      .boss-hp { font-size: 11px; color: #e2e8f0; margin-top: 4px; }
      .boss-status { font-size: 11px; margin-top: 4px; }
      .boss-status.can-fight { color: #48bb78; }
      .boss-status.respawn { color: #f56565; }
      .boss-image-placeholder { width: 50px; height: 50px; background: #2d3748; border-radius: 4px; margin-left: 12px; }
      .boss-battle-btn {
        width: 80%; padding: 8px; background: #ed8936; color: white; border: none; border-radius: 4px;
        font-size: 12px; font-weight: bold; cursor: pointer; align-self: center; transition: background 0.3s;
      }
      .boss-battle-btn:hover { background: #dd6b20; }
      .boss-battle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    </style>
  `,

  bosses: [],
  currentMap: null,
  _bossRespawnHandler: null,

  render() {
    const visibleBosses = this.bosses.filter(b => b.can_fight && !b.respawn_remain);
    const hasDeadBoss = this.bosses.some(b => !b.can_fight || b.respawn_remain > 0);
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="boss-list-container">
        <h1 class="boss-list-title">Boss 列表</h1>
        ${this.currentMap ? `<p style="text-align:center;color:#a0aec0;margin-bottom:16px;">${this.currentMap.name} · 血量全局共享，仅击杀者得奖励，死亡30秒刷新</p>` : ''}
        <div class="boss-grid">
          ${visibleBosses.length > 0 ? visibleBosses.map(boss => `
            <div class="boss-card">
              <div class="boss-header">
                <div class="boss-info">
                  <div class="boss-name">${boss.name}</div>
                  <div class="boss-level">Lv.${boss.level}</div>
                  <div class="boss-hp">HP: ${boss.current_hp || 0}/${boss.max_hp || boss.hp}</div>
                  <span class="boss-status can-fight">可挑战</span>
                </div>
                <div class="boss-image-placeholder"></div>
              </div>
              <button class="boss-battle-btn" onclick="BossListPage.startBattle(${boss.id})">战斗</button>
            </div>
          `).join('') : (this.bosses.length > 0 && hasDeadBoss
            ? '<div style="text-align:center;color:#a0aec0;grid-column:1/-1;">Boss 已死亡，30 秒后自动刷新</div>'
            : '<div style="text-align:center;color:#a0aec0;grid-column:1/-1;">该地图暂无Boss</div>')}
        </div>
      </div>
    `;
  },

  async load() {
    const mapId = State.getCurrentMapId();
    if (!mapId) {
      navigateTo('map');
      return;
    }

    const mapResult = await API.get(`/map/get?id=${mapId}`);
    if (mapResult.code === 0) this.currentMap = mapResult.data;

    const bossResult = await API.get(`/boss/list?map_id=${mapId}`);
    if (bossResult.code === 0) this.bosses = bossResult.data || [];
    else this.bosses = [];

    this._unsubscribeBoss();
    this._subscribeBoss(mapId);
    this.render();
  },

  async _subscribeBoss(mapId) {
    await WS.ensureConnected(2000);
    if (!WS.isConnected()) return;
    WS.send({ type: 'subscribe_boss', data: { map_id: mapId } });
    this._bossRespawnHandler = (data) => {
      if (State.currentPage !== 'boss-list') return;
      const mapIdCur = State.getCurrentMapId();
      if (data.map_id === mapIdCur) this._refreshBossList();
    };
    WS.on('boss_respawn', this._bossRespawnHandler);
  },

  _unsubscribeBoss() {
    if (this._bossRespawnHandler) {
      const fns = WS.handlers['boss_respawn'];
      if (fns) {
        const idx = fns.indexOf(this._bossRespawnHandler);
        if (idx >= 0) fns.splice(idx, 1);
      }
      this._bossRespawnHandler = null;
    }
    if (WS.isConnected()) WS.send({ type: 'unsubscribe_boss' });
  },

  async _refreshBossList() {
    const mapId = State.getCurrentMapId();
    if (!mapId || State.currentPage !== 'boss-list') return;
    const bossResult = await API.get(`/boss/list?map_id=${mapId}`);
    if (bossResult.code === 0) this.bosses = bossResult.data || [];
    this.render();
  },

  onLeave() {
    this._unsubscribeBoss();
  },

  startBattle(bossId) {
    State.setCurrentBossId(bossId);
    State.setCurrentEnemyId(0);
    navigateTo('battle');
  }
};

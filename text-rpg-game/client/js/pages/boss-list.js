/**
 * Boss 列表页 - 与敌人列表流程一致
 * 地图 → Boss列表 → 战斗页
 */
const BossListPage = {
  style: '',

  bosses: [],
  mapPlayers: [],
  currentMap: null,
  _bossRespawnHandler: null,
  _pvpMapPlayersHandler: null,

  render() {
    const visibleBosses = this.bosses.filter(b => b.can_fight && !b.respawn_remain);
    const hasDeadBoss = this.bosses.some(b => !b.can_fight || b.respawn_remain > 0);
    const otherPlayers = (this.mapPlayers || []).filter(p => String(p.uid) !== String(State.uid));
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="boss-list-container">
        <div class="boss-list-pve-section">
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
        <div class="boss-list-divider"></div>
        <div class="boss-list-pvp-section">
          <div class="pvp-title">同地图玩家（PVP）</div>
          <div class="pvp-player-grid">
            ${otherPlayers.map(p => `
              <div class="pvp-player-card">
                <div class="pvp-player-avatar">${(p.name || '?').charAt(0)}</div>
                <div class="pvp-player-name">${(p.name || '玩家').replace(/</g, '&lt;')}</div>
                <div class="pvp-player-level">Lv.${p.level || 1}</div>
                ${p.in_battle
                  ? '<span class="pvp-in-battle">战斗中</span>'
                  : `<button class="pvp-challenge-btn" onclick="BossListPage.challengePvp('${String(p.uid).replace(/'/g, "\\'")}')">挑战</button>`}
              </div>
            `).join('')}
          </div>
          ${otherPlayers.length === 0 ? '<div style="color:#a0aec0;font-size:12px;">暂无其他玩家</div>' : ''}
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

    this.mapPlayers = [];
    this._unsubscribeBoss();
    this._subscribePvpMapPlayers(mapId);
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
    if (this._pvpMapPlayersHandler) {
      const fns = WS.handlers['pvp_map_players'];
      if (fns) {
        const idx = fns.indexOf(this._pvpMapPlayersHandler);
        if (idx >= 0) fns.splice(idx, 1);
      }
      this._pvpMapPlayersHandler = null;
    }
    if (WS.isConnected()) WS.send({ type: 'unsubscribe_boss' });
  },

  _subscribePvpMapPlayers(mapId) {
    this._pvpMapPlayersHandler = (data) => {
      if (State.currentPage !== 'boss-list') return;
      const curMapId = State.getCurrentMapId();
      if (data.map_id === curMapId && data.players) {
        this.mapPlayers = data.players;
        this.render();
      }
    };
    WS.on('pvp_map_players', this._pvpMapPlayersHandler);
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
    State.setCurrentPvpTargetUid(null);
    State.currentBattleMode = 'boss';
    navigateTo('battle');
  },

  async challengePvp(targetUid) {
    const mapId = State.getCurrentMapId();
    if (!mapId) return;
    const p = this.mapPlayers.find(m => String(m.uid) === String(targetUid));
    State.setCurrentPvpTargetUid(targetUid);
    State.setCurrentPvpTargetInfo(p ? { name: p.name, level: p.level, uid: p.uid } : null);
    State.isPvpChallenger = true;
    State.currentBattleMode = 'pvp';
    State.setCurrentBossId(0);
    State.setCurrentEnemyId(0);
    const res = await API.post('/pvp/challenge', { target_uid: targetUid, map_id: mapId });
    if (res.code !== 0) {
      UI.showToast(res.msg || '挑战失败');
      return;
    }
    navigateTo('battle');
  }
};

const MapPage = {
  style: '',

  maps: [],

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="map-container">
        <h1 class="map-title">地图</h1>
        <div class="map-grid">
          ${this.maps.length > 0 ? this.maps.map(map => `
            <div class="map-card">
              <div class="map-name">${map.name}</div>
              <div style="display:flex;gap:8px;width:100%;">
                <button class="map-enter-btn" onclick="MapPage.enterMap(${map.id})">怪物</button>
                <button class="map-enter-btn" style="background:#ed8936" onclick="MapPage.enterBossList(${map.id})">Boss</button>
              </div>
            </div>
          `).join('') : '<div style="text-align: center; color: #a0aec0; grid-column: 1 / -1;">加载地图列表中...</div>'}
        </div>
      </div>
    `;
  },

  async load() {
    const result = await API.get('/map/list');

    if (result.code === 0) {
      this.maps = result.data;
    }
    this.render();
  },

  enterMap(mapId) {
    State.setCurrentMapId(mapId);
    navigateTo('enemy-list');
  },

  enterBossList(mapId) {
    const banUntil = State.getMapBanUntil(mapId);
    const nowSec = Math.floor(Date.now() / 1000);
    if (banUntil > nowSec) {
      const remain = banUntil - nowSec;
      UI.showToast(`${remain} 秒后可再次进入该地图`);
      return;
    }
    State.setCurrentMapId(mapId);
    navigateTo('boss-list');
  }
};

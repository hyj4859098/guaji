const MapPage = {
  style: `
    <style>
      .map-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .map-title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 24px;
        text-align: center;
      }
      .map-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        margin-bottom: 24px;
      }
      .map-card {
        background: #1a202c;
        border-radius: 8px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 150px;
      }
      .map-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
      }
      .map-name {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 24px;
        color: #e2e8f0;
        text-align: center;
      }
      .map-enter-btn {
        width: 100%;
        padding: 12px;
        background: #4299e1;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.3s ease;
      }
      .map-enter-btn:hover {
        background: #3182ce;
      }
      .map-enter-btn:active {
        transform: scale(0.98);
      }
    </style>
  `,

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

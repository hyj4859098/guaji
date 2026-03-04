/**
 * 全服排行榜：财力榜、等级榜
 */
const RankPage = {
  tabs: [
    { key: 'gold', label: '财力榜' },
    { key: 'level', label: '等级榜' },
  ],
  currentTab: 'gold',
  items: [],
  total: 0,
  currentPage: 1,
  pageSize: 20,

  style: `<style>
    .rank-container { max-width: 700px; margin: 0 auto; color: #e2e8f0; display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .rank-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .rank-title { font-size: 18px; color: #ecc94b; font-weight: bold; }
    .rank-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .rank-tab {
      padding: 6px 16px; background: #2d3748; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; color: #a0aec0; cursor: pointer; font-size: 13px; transition: all .2s;
    }
    .rank-tab:hover { background: #4a5568; }
    .rank-tab.active { background: #ecc94b; color: #1a202c; border-color: #ecc94b; }
    .rank-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .rank-table th, .rank-table td {
      padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .rank-table th {
      background: rgba(0,0,0,0.3); color: #a0aec0; font-weight: 600; font-size: 12px;
    }
    .rank-table tr:hover td { background: rgba(45,55,72,0.5); }
    .rank-table .col-rank { width: 60px; text-align: center; }
    .rank-table .col-name { min-width: 120px; }
    .rank-table .col-value { width: 100px; color: #ecc94b; font-weight: 600; }
    .rank-rank-1 td { color: #fbbf24; font-weight: bold; }
    .rank-rank-2 td { color: #a0aec0; font-weight: bold; }
    .rank-rank-3 td { color: #ed8936; font-weight: bold; }
    .rank-title-1 { color: #ff4444 !important; font-weight: bold; animation: rank-glow-red 1.5s ease-in-out infinite alternate; }
    .rank-title-2 { color: #ff8800 !important; font-weight: bold; animation: rank-glow-orange 1.5s ease-in-out infinite alternate; }
    .rank-title-3 { color: #ffcc00 !important; font-weight: bold; animation: rank-glow-yellow 1.5s ease-in-out infinite alternate; }
    @keyframes rank-glow-red { from { text-shadow: 0 0 4px #ff4444, 0 0 8px rgba(255,68,68,0.6); } to { text-shadow: 0 0 8px #ff6666, 0 0 16px rgba(255,68,68,0.8); } }
    @keyframes rank-glow-orange { from { text-shadow: 0 0 4px #ff8800, 0 0 8px rgba(255,136,0,0.6); } to { text-shadow: 0 0 8px #ffaa44, 0 0 16px rgba(255,136,0,0.8); } }
    @keyframes rank-glow-yellow { from { text-shadow: 0 0 4px #ffcc00, 0 0 8px rgba(255,204,0,0.6); } to { text-shadow: 0 0 8px #ffdd44, 0 0 16px rgba(255,204,0,0.8); } }
    .rank-pager { display: flex; justify-content: center; gap: 4px; margin-top: 12px; flex-wrap: wrap; }
    .rank-pager-btn {
      padding: 4px 10px; background: #2d3748; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px; color: #a0aec0; cursor: pointer; font-size: 12px;
    }
    .rank-pager-btn:hover { background: #4a5568; }
    .rank-pager-btn.active { background: #ecc94b; color: #1a202c; }
    .rank-pager-info { color: #718096; font-size: 12px; text-align: center; margin-top: 4px; }
    .rank-empty { text-align: center; color: #a0aec0; padding: 40px 20px; font-size: 14px; }
    .rank-main { display: flex; gap: 16px; align-items: flex-start; }
    .rank-list-wrap { flex: 1; min-width: 0; }
    .rank-desc {
      width: 220px; flex-shrink: 0;
      background: #1a202c; border-radius: 8px; padding: 12px;
      border: 1px solid rgba(255,255,255,0.1); font-size: 12px; line-height: 1.6;
      color: #a0aec0;
    }
    .rank-desc h4 { margin: 0 0 8px; color: #ecc94b; font-size: 13px; }
    .rank-desc p { margin: 0 0 6px; }
    .rank-title-tag { margin-left: 4px; }
  </style>`,

  async load() {
    this.currentPage = 1;
    await this.fetchItems();
    this.render();
  },

  async fetchItems() {
    const result = await API.get('/rank/list', {
      type: this.currentTab,
      page: this.currentPage,
      pageSize: this.pageSize,
    });
    if (result.code === 0 && result.data) {
      this.items = result.data.items || [];
      this.total = result.data.total || 0;
    } else {
      this.items = [];
      this.total = 0;
    }
  },

  async switchTab(key) {
    this.currentTab = key;
    this.currentPage = 1;
    await this.fetchItems();
    this.render();
  },

  async goPage(p) {
    const totalPages = this.totalPages;
    this.currentPage = Math.max(1, Math.min(p, totalPages));
    await this.fetchItems();
    this.render();
  },

  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  },

  getValueColumnHeader() {
    if (this.currentTab === 'gold') return '金币';
    return '等级';
  },

  getValueCell(item) {
    if (this.currentTab === 'gold') return `${item.gold ?? 0}`;
    return `Lv.${item.level ?? 1}`;
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    const tabsHtml = this.tabs.map(t =>
      `<span class="rank-tab ${this.currentTab === t.key ? 'active' : ''}" onclick="RankPage.switchTab('${t.key}')">${t.label}</span>`
    ).join('');

    let listHtml;
    if (!this.items.length) {
      listHtml = '<div class="rank-empty">暂无排行数据</div>';
    } else {
      const valueHeader = this.getValueColumnHeader();
      const rows = this.items.map((item) => {
        const rankCls = item.rank === 1 ? 'rank-rank-1' : item.rank === 2 ? 'rank-rank-2' : item.rank === 3 ? 'rank-rank-3' : '';
        const titleCls = item.rank === 1 ? 'rank-title-1' : item.rank === 2 ? 'rank-title-2' : item.rank === 3 ? 'rank-title-3' : '';
        const nameHtml = (this.currentTab === 'gold' || this.currentTab === 'level') && item.title
          ? `${(item.name || '未知').replace(/</g, '&lt;')}<span class="rank-title-tag ${titleCls}">${item.title}</span>`
          : (item.name || '未知').replace(/</g, '&lt;');
        return `<tr class="${rankCls}">
          <td class="col-rank">${item.rank}</td>
          <td class="col-name">${nameHtml}</td>
          <td class="col-value">${this.getValueCell(item)}</td>
        </tr>`;
      }).join('');
      listHtml = `
        <table class="rank-table">
          <thead><tr>
            <th class="col-rank">名次</th>
            <th class="col-name">玩家</th>
            <th class="col-value">${valueHeader}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const totalPages = this.totalPages;
    let pagerHtml = '';
    if (totalPages > 1) {
      pagerHtml = `
        <div class="rank-pager">
          ${this.currentPage > 1 ? `<button class="rank-pager-btn" onclick="RankPage.goPage(${this.currentPage - 1})">上一页</button>` : ''}
          ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = this.currentPage - 2 + i;
            if (p < 1) p = i + 1;
            if (p > totalPages) p = totalPages - (4 - i);
            if (p < 1) p = 1;
            return `<button class="rank-pager-btn ${p === this.currentPage ? 'active' : ''}" onclick="RankPage.goPage(${p})">${p}</button>`;
          }).join('')}
          ${this.currentPage < totalPages ? `<button class="rank-pager-btn" onclick="RankPage.goPage(${this.currentPage + 1})">下一页</button>` : ''}
        </div>
        <div class="rank-pager-info">共 ${this.total} 名 · 第 ${this.currentPage}/${totalPages} 页</div>`;
    }

    const descHtml = this.currentTab === 'gold' ? `
      <div class="rank-desc">
        <h4>说明</h4>
        <p>资本：战斗获得金币 +10%</p>
        <p>财阀：战斗获得金币 +8%</p>
        <p>地主：战斗获得金币 +5%</p>
        <p style="margin-top:10px;color:#718096;font-size:11px;">每日 0 点根据财力榜更新称号。</p>
      </div>
    ` : this.currentTab === 'level' ? `
      <div class="rank-desc">
        <h4>说明</h4>
        <p>天人合一：战斗获得经验 +10%</p>
        <p>无人之境：战斗获得经验 +8%</p>
        <p>势如破竹：战斗获得经验 +5%</p>
        <p style="margin-top:10px;color:#718096;font-size:11px;">每日 0 点根据等级榜更新称号。</p>
      </div>
    ` : '';

    app.innerHTML = `${this.style}
      <div class="rank-container">
        <div class="rank-header">
          <div class="rank-title">全服排行榜</div>
          <div class="rank-tabs">${tabsHtml}</div>
        </div>
        <div class="rank-main">
          <div class="rank-list-wrap">
            <div class="rank-body">${listHtml}</div>
            ${pagerHtml}
          </div>
          ${descHtml}
        </div>
      </div>`;
  },
};

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

  style: '',

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

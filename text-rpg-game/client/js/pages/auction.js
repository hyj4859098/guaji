const AuctionPage = {
  currentTab: 0,
  items: [],
  total: 0,
  currentPage: 1,
  pageSize: 12,
  keyword: '',
  pos: null,
  minLevel: '',
  maxLevel: '',
  buying: false,
  listing: false,
  records: [],

  itemTypeTabs: [
    { key: 0, label: '全部' },
    { key: 2, label: '装备' },
    { key: 1, label: '消耗品' },
    { key: 4, label: '道具' },
    { key: 3, label: '材料' },
  ],

  posOptions: [
    { key: 1, label: '武器' },
    { key: 2, label: '衣服' },
    { key: 3, label: '腰带' },
    { key: 4, label: '裤子' },
    { key: 5, label: '鞋子' },
    { key: 6, label: '戒指' },
    { key: 7, label: '项链' },
    { key: 8, label: '坐骑' },
  ],

  style: `<style>
    .auction-container { max-width: 1100px; margin: 0 auto; color: #e2e8f0; display: flex; flex-direction: column; gap: 12px; height: 100%; }
    .auction-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .auction-title { font-size: 18px; color: #4299e1; font-weight: bold; }
    .auction-balance { font-size: 14px; color: #a0aec0; }
    .auction-balance .val { font-weight: bold; color: #ecc94b; margin-left: 4px; }

    .auction-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .auction-tab {
      padding: 5px 14px; background: #2d3748; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; color: #a0aec0; cursor: pointer; font-size: 12px; transition: all .2s;
    }
    .auction-tab:hover { background: #4a5568; }
    .auction-tab.active { background: #4299e1; color: white; border-color: #4299e1; }

    .auction-main { flex: 1; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
    .auction-left { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; }

    .auction-search {
      display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
      padding: 10px; background: #1a202c; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
    }
    .auction-search input, .auction-search select {
      padding: 5px 10px; background: #2d3748; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px; color: #e2e8f0; font-size: 13px;
    }
    .auction-search input { min-width: 120px; }
    .auction-search select { min-width: 90px; }
    .auction-search .search-btn {
      padding: 5px 14px; background: #4299e1; color: white; border: none;
      border-radius: 4px; cursor: pointer; font-size: 12px;
    }
    .auction-search .search-btn:hover { background: #3182ce; }
    .auction-search .equip-filters { display: flex; gap: 6px; align-items: center; }
    .auction-search .equip-filters input { width: 60px; text-align: center; }

    .auction-items { flex: 1; overflow-y: auto; min-height: 0; }
    .auction-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .auction-table th, .auction-table td {
      padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .auction-table th {
      background: rgba(0,0,0,0.3); color: #a0aec0; font-weight: 600; font-size: 12px;
    }
    .auction-table tr:hover td { background: rgba(45,55,72,0.5); }
    .auction-table .col-name { min-width: 160px; }
    .auction-table .col-qty { width: 70px; text-align: center; }
    .auction-table .col-seller { width: 90px; }
    .auction-table .col-price { width: 100px; color: #ecc94b; font-weight: 600; }
    .auction-table .col-time { width: 140px; font-size: 11px; color: #718096; }
    .auction-table .col-action { width: 80px; text-align: center; }
    .auction-table .item-cell { display: flex; align-items: center; gap: 8px; }
    .auction-table .item-icon {
      width: 32px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: bold; color: white; flex-shrink: 0; cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .auction-table .item-icon.equipment { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
    .auction-table .item-icon.consumable { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
    .auction-table .item-icon.material { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
    .auction-table .item-name { font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .auction-table .item-meta { font-size: 11px; color: #718096; margin-top: 2px; }
    .auction-table .action-btn {
      padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;
    }
    .auction-table .action-btn.buy { background: #48bb78; color: white; }
    .auction-table .action-btn.buy:hover { background: #38a169; }
    .auction-table .action-btn.off { background: #ed8936; color: white; }
    .auction-table .action-btn.off:hover { background: #dd6b20; }
    .auction-table .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .auction-pager { display: flex; justify-content: center; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
    .auction-pager-btn {
      padding: 4px 10px; background: #2d3748; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px; color: #a0aec0; cursor: pointer; font-size: 12px;
    }
    .auction-pager-btn:hover { background: #4a5568; }
    .auction-pager-btn.active { background: #4299e1; color: white; }
    .auction-pager-info { color: #718096; font-size: 12px; text-align: center; margin-top: 4px; }

    .auction-records-btn {
      padding: 5px 12px; background: #2d3748; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px; color: #4299e1; cursor: pointer; font-size: 12px;
    }
    .auction-records-btn:hover { background: #4a5568; }
    .auction-records-table { width: 100%; font-size: 12px; border-collapse: collapse; }
    .auction-records-table th, .auction-records-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .auction-records-table th { color: #a0aec0; font-weight: 500; }
    .auction-records-table .rec-type-buy { color: #48bb78; }
    .auction-records-table .rec-type-sell { color: #ed8936; }
    .auction-records-empty { color: #718096; text-align: center; padding: 20px; font-size: 13px; }

    .auction-popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99; }
    .auction-popup {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #1a202c; border: 2px solid #4299e1; border-radius: 12px;
      padding: 24px; z-index: 100; min-width: 300px; color: #e2e8f0;
    }
    .auction-popup .title { font-size: 15px; margin-bottom: 12px; font-weight: bold; }
    .auction-popup .row { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
    .auction-popup .row label { min-width: 60px; font-size: 13px; }
    .auction-popup input {
      flex: 1; padding: 6px 10px; background: #2d3748; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px; color: #e2e8f0; font-size: 14px;
    }
    .auction-popup .btns { display: flex; justify-content: center; gap: 10px; margin-top: 16px; }
    .auction-popup .btns .btn {
      padding: 8px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .auction-popup .btn-ok { background: #48bb78; color: white; }
    .auction-popup .btn-no { background: #718096; color: white; }
    .auction-popup-records { min-width: 520px; max-width: 90vw; max-height: 70vh; display: flex; flex-direction: column; }
    .auction-popup-records .records-body { max-height: 400px; overflow-y: auto; padding: 0 4px; }
  </style>`,

  getItemTypeKey(item) {
    return Helper.getItemType(item);
  },

  showItemTooltip(event, index) {
    const item = this.items[index];
    if (item) Tooltip.showForItem(event, item);
  },

  async load() {
    this.currentPage = 1;
    await this.fetchItems();
    this.render();
  },

  async fetchRecords() {
    const result = await API.get('/auction/records');
    this.records = (result.code === 0 && result.data?.records) ? result.data.records : [];
  },

  onLeave() {
    this.removePopups();
  },

  async fetchItems() {
    const params = { page: this.currentPage, pageSize: this.pageSize };
    if (this.keyword && this.keyword.trim()) params.keyword = this.keyword.trim();
    if (this.pos != null) params.pos = this.pos;
    if (this.minLevel) params.min_level = Number(this.minLevel);
    if (this.maxLevel) params.max_level = Number(this.maxLevel);
    if (this.currentTab > 0) params.type = this.currentTab;
    const result = await API.get('/auction/list', params);
    if (result.code === 0 && result.data) {
      this.items = result.data.items || [];
      this.total = result.data.total || 0;
    } else {
      this.items = [];
      this.total = 0;
    }
  },

  async doSearch() {
    this.currentPage = 1;
    await this.fetchItems();
    this.render();
  },

  async switchTab(key) {
    this.currentTab = key;
    this.currentPage = 1;
    await this.fetchItems();
    this.render();
  },

  async goPage(p) {
    const totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));
    this.currentPage = Math.max(1, Math.min(p, totalPages));
    await this.fetchItems();
    this.render();
  },

  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  },

  getBalance() {
    return State.player?.gold ?? 0;
  },

  isMyListing(item) {
    return String(item.seller_uid) === String(State.uid);
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    const tabsHtml = this.itemTypeTabs.map(t =>
      `<span class="auction-tab ${this.currentTab === t.key ? 'active' : ''}" onclick="AuctionPage.switchTab(${t.key})">${t.label}</span>`
    ).join('');

    const isEquipTab = this.currentTab === 2;
    const searchHtml = `
      <div class="auction-search">
        <input type="text" placeholder="物品名称" id="auctionKeyword" value="${(this.keyword || '').replace(/"/g, '&quot;')}">
        ${isEquipTab ? `
        <select id="auctionPos">
          <option value="">全部部位</option>
          ${this.posOptions.map(p => `<option value="${p.key}" ${this.pos === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        <div class="equip-filters">
          <input type="number" placeholder="最低等级" id="auctionMinLevel" value="${this.minLevel || ''}" min="1">
          <span>-</span>
          <input type="number" placeholder="最高等级" id="auctionMaxLevel" value="${this.maxLevel || ''}" min="1">
        </div>
        ` : ''}
        <button class="search-btn" onclick="AuctionPage.applySearch()">搜索</button>
      </div>
    `;

    const itemsHtml = this.items.length
      ? `<table class="auction-table">
          <thead><tr>
            <th class="col-name">物品名称</th>
            <th class="col-qty">数量</th>
            <th class="col-seller">卖家</th>
            <th class="col-price">价格</th>
            <th class="col-time">上架时间</th>
            <th class="col-action">操作</th>
          </tr></thead>
          <tbody>${this.items.map((item, idx) => this.renderItemRow(item, idx)).join('')}</tbody>
        </table>`
      : '<div style="text-align:center;color:#718096;padding:40px;">暂无拍卖物品</div>';

    const totalPages = this.totalPages;
    let pagerHtml = '';
    if (totalPages > 1) {
      pagerHtml = `
        <div class="auction-pager">
          ${this.currentPage > 1 ? `<button class="auction-pager-btn" onclick="AuctionPage.goPage(${this.currentPage - 1})">上一页</button>` : ''}
          ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = this.currentPage - 2 + i;
            if (p < 1) p = i + 1;
            if (p > totalPages) p = totalPages - (4 - i);
            if (p < 1) p = 1;
            return `<button class="auction-pager-btn ${p === this.currentPage ? 'active' : ''}" onclick="AuctionPage.goPage(${p})">${p}</button>`;
          }).join('')}
          ${this.currentPage < totalPages ? `<button class="auction-pager-btn" onclick="AuctionPage.goPage(${this.currentPage + 1})">下一页</button>` : ''}
        </div>
        <div class="auction-pager-info">共 ${this.total} 件 · 第 ${this.currentPage}/${totalPages} 页</div>
      `;
    }

    app.innerHTML = `${this.style}
      <div class="auction-container">
        <div class="auction-header">
          <div>
            <div class="auction-title">拍卖行</div>
            <div class="auction-tabs">${tabsHtml}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="auction-records-btn" onclick="AuctionPage.showRecordsPopup()">记录</button>
            <div class="auction-balance">金币：<span class="val">${this.getBalance()}</span></div>
          </div>
        </div>
        <div class="auction-main">
          <div class="auction-left">
            ${searchHtml}
            <div class="auction-items">${itemsHtml}</div>
            ${pagerHtml}
          </div>
        </div>
      </div>`;

    document.getElementById('auctionKeyword')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applySearch();
    });
    if (isEquipTab) {
      document.getElementById('auctionPos')?.addEventListener('change', (e) => {
        this.pos = e.target.value ? Number(e.target.value) : null;
      });
      document.getElementById('auctionMinLevel')?.addEventListener('input', (e) => {
        this.minLevel = e.target.value;
      });
      document.getElementById('auctionMaxLevel')?.addEventListener('input', (e) => {
        this.maxLevel = e.target.value;
      });
    }
  },

  async showRecordsPopup() {
    await this.fetchRecords();
    this.removePopups();

    const overlay = document.createElement('div');
    overlay.className = 'auction-popup-overlay';
    overlay.onclick = () => this.removePopups();
    document.body.appendChild(overlay);

    const rows = this.records.length
      ? this.records.map(r => {
          const typeLabel = r.type === 'buy' ? '购买' : '售出';
          const typeClass = r.type === 'buy' ? 'rec-type-buy' : 'rec-type-sell';
          const other = r.other_name ? ` (${r.other_name})` : '';
          const timeStr = r.create_time ? Helper.formatDate(r.create_time) : '-';
          return `<tr>
            <td class="${typeClass}">${typeLabel}</td>
            <td>${r.item_name || '未知'}</td>
            <td>${r.count || 1}</td>
            <td>${r.price || 0} 金币</td>
            <td>${r.total || 0} 金币</td>
            <td>${other || '-'}</td>
            <td style="font-size:11px;color:#718096;">${timeStr}</td>
          </tr>`;
        }).join('')
      : '';

    const tableHtml = this.records.length
      ? `<table class="auction-records-table">
          <thead><tr>
            <th>类型</th><th>物品</th><th>数量</th><th>单价</th><th>总额</th><th>对方</th><th>时间</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<div class="auction-records-empty">暂无购买/售出记录</div>';

    const popup = document.createElement('div');
    popup.className = 'auction-popup auction-popup-records';
    popup.onclick = (e) => e.stopPropagation();
    popup.innerHTML = `
      <div class="title">购买/售出记录 (最近20条)</div>
      <div class="records-body">${tableHtml}</div>
      <div class="btns" style="margin-top:12px;">
        <button class="btn btn-no" onclick="AuctionPage.removePopups()">关闭</button>
      </div>`;
    document.body.appendChild(popup);
  },

  applySearch() {
    this.keyword = document.getElementById('auctionKeyword')?.value?.trim() || '';
    if (this.currentTab === 2) {
      const posEl = document.getElementById('auctionPos');
      this.pos = posEl?.value ? Number(posEl.value) : null;
      this.minLevel = document.getElementById('auctionMinLevel')?.value || '';
      this.maxLevel = document.getElementById('auctionMaxLevel')?.value || '';
    }
    this.doSearch();
  },

  renderItemRow(item, index) {
    const typeKey = this.getItemTypeKey(item);
    const isMine = this.isMyListing(item);
    const safeIndex = index >= 0 ? index : 0;
    const sellerText = isMine ? '我' : (item.seller_name || `玩家${item.seller_uid || ''}`);
    const timeStr = item.create_time ? Helper.formatDate(item.create_time) : '-';

    let actionBtn = '';
    if (isMine) {
      actionBtn = `<button class="action-btn off" onclick="AuctionPage.offShelf(${item.id})">下架</button>`;
    } else {
      actionBtn = `<button class="action-btn buy" onclick="AuctionPage.showBuyPopup(${item.id})" ${this.buying ? 'disabled' : ''}>购买</button>`;
    }

    return `<tr>
      <td class="col-name">
        <div class="item-cell">
          <div class="item-icon ${typeKey}" onmouseenter="AuctionPage.showItemTooltip(event, ${safeIndex})" onmouseleave="Tooltip.hide()">${(item.name || '?')[0]}</div>
          <div>
            <div class="item-name">${item.name || '未知'}</div>
            ${item.equip_level ? `<div class="item-meta">等级 ${item.equip_level}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="col-qty">${item.count || 1}</td>
      <td class="col-seller">${sellerText}</td>
      <td class="col-price">${item.price} 金币</td>
      <td class="col-time">${timeStr}</td>
      <td class="col-action">${actionBtn}</td>
    </tr>`;
  },

  showBuyPopup(auctionId) {
    const item = this.items.find(i => i.id === auctionId);
    if (!item) return;

    this.removePopups();
    const overlay = document.createElement('div');
    overlay.className = 'auction-popup-overlay';
    overlay.onclick = () => this.removePopups();
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'auction-popup';
    popup.onclick = (e) => e.stopPropagation();
    const maxCount = item.count || 1;
    popup.innerHTML = `
      <div class="title">购买 ${item.name || '物品'}</div>
      <div class="row">
        <label>数量：</label>
        <input type="number" id="auctionBuyQty" value="1" min="1" max="${maxCount}">
      </div>
      <div class="row">
        <label>单价：</label>
        <span>${item.price} 金币</span>
      </div>
      <div class="row">
        <label>合计：</label>
        <span id="auctionBuyTotal">${item.price} 金币</span>
      </div>
      <div class="btns">
        <button class="btn btn-ok" onclick="AuctionPage.doBuy(${auctionId})">确定</button>
        <button class="btn btn-no" onclick="AuctionPage.removePopups()">取消</button>
      </div>`;
    document.body.appendChild(popup);

    const qtyEl = document.getElementById('auctionBuyQty');
    const totalEl = document.getElementById('auctionBuyTotal');
    const updateTotal = () => {
      const qty = Math.max(1, Math.min(maxCount, parseInt(qtyEl?.value || '1') || 1));
      if (totalEl) totalEl.textContent = (item.price * qty) + ' 金币';
    };
    qtyEl?.addEventListener('input', updateTotal);
  },

  async doBuy(auctionId) {
    const item = this.items.find(i => i.id === auctionId);
    if (!item) { this.removePopups(); return; }

    const qtyEl = document.getElementById('auctionBuyQty');
    const rawVal = parseInt(qtyEl?.value, 10);
    const maxCount = item.count || 1;

    if (isNaN(rawVal) || rawVal < 1 || rawVal > maxCount) {
      UI.showToast(`购买失败：数量超出范围，最多可购买 ${maxCount} 件`, 'error');
      return;
    }
    const count = rawVal;

    const totalCost = (item.price || 0) * count;
    const balance = this.getBalance();
    if (totalCost > balance) {
      UI.showToast(`购买失败：金币不足，需要 ${totalCost} 金币，当前 ${balance} 金币`, 'error');
      return;
    }

    this.removePopups();
    this.buying = true;
    const result = await API.post('/auction/buy', { auction_id: auctionId, count });
    this.buying = false;

    if (result.code === 0) {
      UI.showToast('购买成功', 'success');
      await this.fetchItems();
      this.render();
    } else {
      UI.showToast(result.msg || '购买失败', 'error');
    }
  },

  showListPopupFromBagId(bagId) {
    const item = typeof BagPage !== 'undefined' && BagPage.items
      ? BagPage.items.find(b => String(b.original_id || b.id) === String(bagId))
      : null;
    if (item) this.showListPopup(item);
    else UI.showToast('物品未找到，请刷新背包', 'error');
  },

  showListPopup(bagItem) {
    if (!bagItem) return;
    const isEquip = Helper.isEquipment(bagItem);
    const maxCount = bagItem.count || 1;
    const bagId = bagItem.original_id || bagItem.id;

    this.removePopups();
    this._listBagItem = { id: bagId, type: bagItem.type, count: maxCount };

    const overlay = document.createElement('div');
    overlay.className = 'auction-popup-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;';
    overlay.onclick = () => this.removePopups();
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'auction-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a202c;border:2px solid #4299e1;border-radius:12px;padding:24px;z-index:10000;min-width:300px;color:#e2e8f0;';
    popup.onclick = (e) => e.stopPropagation();
    popup.innerHTML = `
      <div class="title" style="font-size:15px;margin-bottom:12px;font-weight:bold;">上架 ${bagItem.name || '物品'}</div>
      <div class="row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">
        <label style="min-width:60px;font-size:13px;">单价：</label>
        <input type="number" id="auctionListPrice" value="1" min="1" placeholder="金币" style="flex:1;padding:6px 10px;background:#2d3748;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#e2e8f0;font-size:14px;">
      </div>
      ${!isEquip ? `
      <div class="row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">
        <label style="min-width:60px;font-size:13px;">数量：</label>
        <input type="number" id="auctionListCount" value="${maxCount}" min="1" max="${maxCount}" style="flex:1;padding:6px 10px;background:#2d3748;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#e2e8f0;font-size:14px;">
      </div>
      ` : '<input type="hidden" id="auctionListCount" value="1">'}
      <div class="btns" style="display:flex;justify-content:center;gap:10px;margin-top:16px;">
        <button class="btn btn-ok" onclick="AuctionPage.doList()" style="padding:8px 20px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:500;background:#48bb78;color:white;">确定上架</button>
        <button class="btn btn-no" onclick="AuctionPage.removePopups()" style="padding:8px 20px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:500;background:#718096;color:white;">取消</button>
      </div>`;
    document.body.appendChild(popup);
  },

  async doList() {
    const bagItemData = this._listBagItem;
    if (!bagItemData) return;

    const price = parseInt(document.getElementById('auctionListPrice')?.value || '0', 10);
    if (isNaN(price) || price < 1) {
      UI.showToast('上架失败：请输入有效价格', 'error');
      return;
    }

    let count;
    if (bagItemData.type === 2) {
      count = 1;
    } else {
      const countEl = document.getElementById('auctionListCount');
      const rawVal = parseInt(countEl?.value, 10);
      const maxCount = bagItemData.count || 1;
      if (isNaN(rawVal) || rawVal < 1 || rawVal > maxCount) {
        UI.showToast(`上架失败：数量超出范围，最多可上架 ${maxCount} 个`, 'error');
        return;
      }
      count = rawVal;
    }

    this.removePopups();
    this._listBagItem = null;
    this.listing = true;
    const result = await API.post('/auction/list', {
      bag_id: bagItemData.id,
      count: Helper.isEquipment({ type: bagItemData.type }) ? undefined : count,
      price,
    });
    this.listing = false;

    if (result.code === 0) {
      UI.showToast('上架成功', 'success');
      if (State.currentPage === 'auction') {
        await this.fetchItems();
        this.render();
      }
    } else {
      UI.showToast(result.msg || '上架失败', 'error');
    }
  },

  async offShelf(auctionId) {
    if (!confirm('确定要下架该商品吗？')) return;

    const result = await API.post('/auction/off-shelf', { auction_id: auctionId });
    if (result.code === 0) {
      UI.showToast('下架成功', 'success');
      if (State.currentPage === 'auction') {
        await this.fetchItems();
        this.render();
      }
    } else {
      UI.showToast(result.msg || '下架失败', 'error');
    }
  },

  removePopups() {
    document.querySelectorAll('.auction-popup-overlay, .auction-popup').forEach(el => el.remove());
  },

  refreshBalance() {
    const el = document.querySelector('.auction-balance .val');
    if (el) el.textContent = this.getBalance();
  },
};

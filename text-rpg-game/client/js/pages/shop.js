const ShopPage = {
  shopType: 'gold',
  items: [],
  leftPage: 1,
  rightPage: 1,
  pageSize: 6,
  buying: false,

  shopTypes: [
    { key: 'gold', label: '金币商店', currency: '金币', color: '#ecc94b' },
    { key: 'reputation', label: '声望商店', currency: '声望', color: '#9f7aea' },
    { key: 'points', label: '积分商店', currency: '积分', color: '#f56565' },
  ],

  style: '',

  async load() {
    this.leftPage = 1;
    this.rightPage = 1;
    this.buying = false;
    await this.fetchItems();
    this.render();
  },

  onLeave() {},

  async fetchItems() {
    const res = await API.get('/shop/list', { type: this.shopType });
    this.items = (res.code === 0 && res.data) ? res.data : [];
  },

  getCurrencyInfo() {
    return this.shopTypes.find(s => s.key === this.shopType) || this.shopTypes[0];
  },

  getBalance() {
    const info = this.getCurrencyInfo();
    const player = State.player;
    if (!player) return 0;
    return player[info.key] ?? 0;
  },

  getLeftItems() {
    return this.items.filter(i => i.category === 'consumable');
  },

  getRightItems() {
    return this.items.filter(i => ['material', 'tool', 'equipment'].includes(i.category || ''));
  },

  paginate(items, page) {
    const total = Math.max(1, Math.ceil(items.length / this.pageSize));
    const p = Math.max(1, Math.min(page, total));
    return { items: items.slice((p - 1) * this.pageSize, p * this.pageSize), page: p, total };
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;
    const info = this.getCurrencyInfo();
    const balance = this.getBalance();

    const typeTabs = this.shopTypes.map(s =>
      `<span class="shop-type-tab ${this.shopType === s.key ? 'active' : ''}" onclick="ShopPage.switchShopType('${s.key}')">${s.label}</span>`
    ).join('');

    app.innerHTML = `${this.style}
      <div class="shop-container">
        <div class="shop-header">
          <h2>商店</h2>
          <div class="shop-type-tabs">${typeTabs}</div>
          <div class="shop-balance">当前${info.currency}：<span class="val" style="color:${info.color}">${balance}</span></div>
        </div>
        <div class="shop-panel">
          <div class="shop-side left" id="shop-left">${this.renderSide('left')}</div>
          <div class="shop-side right" id="shop-right">${this.renderSide('right')}</div>
        </div>
      </div>`;
  },

  renderSide(side) {
    const isLeft = side === 'left';
    const allItems = isLeft ? this.getLeftItems() : this.getRightItems();
    const page = isLeft ? this.leftPage : this.rightPage;
    const pg = this.paginate(allItems, page);
    const info = this.getCurrencyInfo();

    const title = isLeft ? '消耗品' : '材料 / 道具';
    const emptyText = isLeft ? '暂无消耗品出售' : '暂无材料道具出售';

    if (isLeft) this._shopLeftItems = pg.items;
    else this._shopRightItems = pg.items;
    const itemsHtml = pg.items.length
      ? pg.items.map((si, i) => this.renderShopItem(si, info, isLeft ? 'consumable' : 'material', i, side)).join('')
      : `<div class="shop-empty">${emptyText}</div>`;

    const pager = this.renderPager(pg.page, pg.total, side);

    return `<h3>${title}</h3><div class="shop-list">${itemsHtml}</div>${pager}`;
  },

  renderShopItem(si, info, iconClass, index, side) {
    return `<div class="shop-item">
      <div class="shop-item-icon ${iconClass}"
        onmouseenter="ShopPage.showItemTooltip(event, ${index}, '${side}')" onmouseleave="Tooltip.hide()">
        ${(si.item_name || '?')[0]}
      </div>
      <div class="shop-item-info">
        <div class="shop-item-name">${si.item_name || '未知'}</div>
        <div class="shop-item-desc">${si.item_description || ''}</div>
      </div>
      <div class="shop-item-price" style="color:${info.color}">${si.price} ${info.currency}</div>
      <div class="shop-item-actions">
        <button class="shop-buy-btn" onclick="ShopPage.confirmBuy(${si.id})">购买</button>
      </div>
    </div>`;
  },

  renderPager(current, total, side) {
    if (total <= 1) return '';
    let h = '';
    for (let i = 1; i <= total; i++) {
      h += `<button class="shop-pager-btn ${i === current ? 'active' : ''}" onclick="ShopPage.setPage('${side}',${i})">${i}</button>`;
    }
    return `<div class="shop-pager">${h}</div>`;
  },

  showItemTooltip(event, index, side) {
    const list = side === 'left' ? this._shopLeftItems : this._shopRightItems;
    const si = list?.[index];
    if (!si) return;
    const item = { name: si.item_name, type: si.item_type, item_id: si.item_id, description: si.item_description, hp: Helper.getHpRestore(si), mp: Helper.getMpRestore(si) };
    Tooltip.showForItem(event, item);
  },

  setPage(side, p) {
    if (side === 'left') { this.leftPage = p; this.refreshSide('left'); }
    else { this.rightPage = p; this.refreshSide('right'); }
  },

  refreshSide(side) {
    const el = document.getElementById(`shop-${side}`);
    if (el) el.innerHTML = this.renderSide(side);
  },

  refreshBalance() {
    const info = this.getCurrencyInfo();
    const balEl = document.querySelector('.shop-balance .val');
    if (balEl) {
      balEl.textContent = this.getBalance();
      balEl.style.color = info.color;
    }
  },

  async switchShopType(type) {
    if (this.shopType === type) return;
    this.shopType = type;
    this.leftPage = 1;
    this.rightPage = 1;
    await this.fetchItems();
    this.render();
  },

  confirmBuy(shopItemId) {
    const si = this.items.find(i => i.id === shopItemId);
    if (!si) return;
    const info = this.getCurrencyInfo();

    this.removeConfirmPopup();
    const overlay = document.createElement('div');
    overlay.id = 'shop-confirm-overlay';
    overlay.className = 'shop-confirm-overlay';
    overlay.onclick = () => this.removeConfirmPopup();
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.id = 'shop-confirm-popup';
    popup.className = 'shop-confirm-popup';
    popup.innerHTML = `
      <div class="title">购买 ${si.item_name}</div>
      <div class="detail">单价 <span class="cost" style="color:${info.color}">${si.price} ${info.currency}</span></div>
      <div class="qty-row">
        <label>数量：</label>
        <input class="qty-input" type="number" id="shop-buy-qty" value="1" min="1"
          oninput="ShopPage.updatePopupTotal(${si.id})">
      </div>
      <div class="total-row">合计：<span class="cost" style="color:${info.color}" id="shop-buy-total">${si.price} ${info.currency}</span></div>
      <div class="btns">
        <button class="btn btn-ok" onclick="ShopPage.doBuyFromPopup(${shopItemId})">确定</button>
        <button class="btn btn-no" onclick="ShopPage.removeConfirmPopup()">取消</button>
      </div>`;
    document.body.appendChild(popup);
    setTimeout(() => {
      const inp = document.getElementById('shop-buy-qty');
      if (inp) { inp.focus(); inp.select(); }
    }, 50);
  },

  updatePopupTotal(shopItemId) {
    const si = this.items.find(i => i.id === shopItemId);
    if (!si) return;
    const inp = document.getElementById('shop-buy-qty');
    const totalEl = document.getElementById('shop-buy-total');
    if (!inp || !totalEl) return;
    const count = Math.max(1, parseInt(inp.value) || 1);
    const info = this.getCurrencyInfo();
    totalEl.textContent = `${si.price * count} ${info.currency}`;
  },

  doBuyFromPopup(shopItemId) {
    const si = this.items.find(i => i.id === shopItemId);
    if (!si) { this.removeConfirmPopup(); return; }

    const inp = document.getElementById('shop-buy-qty');
    const rawVal = parseInt(inp?.value, 10);
    if (isNaN(rawVal) || rawVal < 1) {
      UI.showToast('购买失败：请输入有效数量', 'error');
      return;
    }
    const count = rawVal;

    const info = this.getCurrencyInfo();
    const totalCost = si.price * count;
    const balance = this.getBalance();
    if (totalCost > balance) {
      UI.showToast(`${info.currency}不足！需要 ${totalCost}，当前 ${balance}`, 'error');
      return;
    }

    this.doBuy(shopItemId, count);
  },

  removeConfirmPopup() {
    ['shop-confirm-overlay', 'shop-confirm-popup'].forEach(id => document.getElementById(id)?.remove());
  },

  async doBuy(shopItemId, count) {
    if (this.buying) return;

    const si = this.items.find(i => i.id === shopItemId);
    if (!si) { this.removeConfirmPopup(); return; }

    const info = this.getCurrencyInfo();
    const totalCost = si.price * count;
    const balance = this.getBalance();
    if (balance < totalCost) {
      this.removeConfirmPopup();
      UI.showToast(`${info.currency}不足！需要 ${totalCost}，当前 ${balance}`, 'error');
      return;
    }

    this.removeConfirmPopup();
    this.buying = true;
    const res = await API.post('/shop/buy', { shop_item_id: shopItemId, count });
    this.buying = false;

    if (res.code === 0) {
      UI.showToast('购买成功！', 'success');
    } else {
      UI.showToast(res.msg || '购买失败', 'error');
    }
  },
};

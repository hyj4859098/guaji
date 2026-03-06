const TradePage = {
  view: 'lobby',
  lobbyPlayers: [],
  partner: null,
  myOffer: { items: [], gold: 0 },
  partnerOffer: { items: [], gold: 0 },
  myItemsConfirmed: false,
  partnerItemsConfirmed: false,
  myTradeConfirmed: false,
  partnerTradeConfirmed: false,
  bagItems: [],
  bagTab: 'equipment',
  bagPage: 1,
  bagPageSize: 8,
  offerTab: 'equipment',
  offerPage: 1,
  partnerTab: 'equipment',
  partnerPage: 1,

  get tabs() { return Helper.BAG_TABS; },

  style: '',

  filterByTab(items, tab) {
    return items.filter(i => Helper.getItemType(i) === tab);
  },

  paginate(items, page, pageSize) {
    const total = Math.max(1, Math.ceil(items.length / pageSize));
    const p = Math.max(1, Math.min(page, total));
    return { items: items.slice((p - 1) * pageSize, p * pageSize), page: p, total };
  },

  renderPager(current, total, onclickFn) {
    if (total <= 1) return '';
    let h = '';
    for (let i = 1; i <= total; i++) {
      h += `<button class="t-pager-btn ${i === current ? 'active' : ''}" onclick="${onclickFn}(${i})">${i}</button>`;
    }
    return `<div class="t-pager">${h}</div>`;
  },

  renderItemRow(item, actions, index, listType) {
    const tipHandler = (typeof index === 'number' && listType)
      ? `onmouseenter="TradePage.showItemTooltip(event, ${index}, '${listType}')"`
      : 'onmouseenter="Tooltip.hide()"';
    return `<div class="t-item">
      <div class="t-item-icon" ${tipHandler} onmouseleave="Tooltip.hide()">
        ${(item.name || '?')[0]}
      </div>
      <span class="t-item-name">${item.name || '未知'}</span>
      <span class="t-item-count">×${item.count || 1}</span>
      ${actions}
    </div>`;
  },

  // ==================== 生命周期 ====================

  async load() {
    this.view = 'lobby';
    this.resetTradeState();
    const bagResult = await BagService.fetchList();
    if (bagResult.code === 0 && bagResult.data) {
      this.bagItems = bagResult.data.items;
    }
    this.render();
    WS.send({ type: 'trade', data: { action: 'join' } });
  },

  onLeave() {
    WS.send({ type: 'trade', data: { action: 'leave' } });
    this.resetTradeState();
  },

  resetTradeState() {
    this.partner = null;
    this.myOffer = { items: [], gold: 0 };
    this.partnerOffer = { items: [], gold: 0 };
    this.myItemsConfirmed = false;
    this.partnerItemsConfirmed = false;
    this.myTradeConfirmed = false;
    this.partnerTradeConfirmed = false;
    this.bagTab = 'equipment'; this.bagPage = 1;
    this.offerTab = 'equipment'; this.offerPage = 1;
    this.partnerTab = 'equipment'; this.partnerPage = 1;
  },

  handleTradeEvent(data) {
    switch (data.action) {
      case 'lobby_players':
        this.lobbyPlayers = data.players || [];
        if (this.view === 'lobby') this.render();
        break;
      case 'invite_received': this.showInvitePopup(data.from_uid, data.from_name); break;
      case 'invite_result':
        if (!data.accepted) UI.showToast(data.reason || '对方拒绝了交易邀请');
        break;
      case 'session_start':
        this.view = 'trading';
        this.resetTradeState();
        this.partner = data.partner;
        this.loadBag();
        this.render();
        break;
      case 'partner_offer':
        this.partnerOffer = { items: data.items || [], gold: data.gold || 0 };
        this.refreshPartner();
        break;
      case 'partner_confirmed_items':
        this.partnerItemsConfirmed = true;
        this.refreshPartner(); this.updateTradeButtons();
        break;
      case 'partner_confirmed_trade':
        this.partnerTradeConfirmed = true;
        this.refreshPartner();
        break;
      case 'partner_unconfirmed': break;
      case 'trade_complete': {
        const itemLines = (data.received_items || []).map(i => `${i.name}×${i.count}`).join('、') || '无';
        const goldStr = data.received_gold ? `，金币 +${data.received_gold}` : '';
        UI.showToast(`交易成功！获得：${itemLines}${goldStr}`, 'success');
        this.backToLobby();
        break;
      }
      case 'trade_cancelled':
        UI.showToast(data.reason || '交易已取消', 'error');
        this.backToLobby();
        break;
      case 'error': UI.showToast(data.message || '交易错误'); break;
    }
  },

  async loadBag() {
    const result = await BagService.fetchList();
    if (result.code === 0 && result.data) {
      this.bagItems = result.data.items;
    }
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;
    if (this.view === 'lobby') app.innerHTML = this.style + this.renderLobby();
    else if (this.view === 'trading') app.innerHTML = this.style + this.renderTrading();
  },

  // ==================== 大厅 ====================

  renderLobby() {
    const myUid = String(State.uid || '');
    const others = this.lobbyPlayers.filter(p => String(p.uid) !== myUid);
    const cards = others.length === 0
      ? '<div class="empty-lobby">暂无其他玩家在线，等待中...</div>'
      : others.map(p => `
        <div class="player-card">
          <div class="avatar">${(p.name || '?')[0]}</div>
          <div class="name">${p.name}</div>
          <div class="level">Lv.${p.level}</div>
          <button class="invite-btn" onclick="TradePage.sendInvite('${p.uid}')">发起交易</button>
        </div>`).join('');
    return `<div class="trade-container">
      <h2>实时交易</h2>
      <div class="trade-hint">进入此页面即可被其他玩家看到，离开页面将退出交易大厅</div>
      <div class="player-cards">${cards}</div>
    </div>`;
  },

  sendInvite(uid) {
    WS.send({ type: 'trade', data: { action: 'invite', target_uid: uid } });
    UI.showToast('已发送交易邀请，等待对方回应...');
  },

  showInvitePopup(fromUid, fromName) {
    UI.showToast(`${fromName} 邀请你进行交易`, 'trade');
    ['invite-overlay', 'invite-popup'].forEach(id => document.getElementById(id)?.remove());
    const overlay = document.createElement('div');
    overlay.id = 'invite-overlay'; overlay.className = 'invite-overlay';
    document.body.appendChild(overlay);
    const popup = document.createElement('div');
    popup.id = 'invite-popup'; popup.className = 'invite-popup';
    popup.innerHTML = `<div style="font-size:15px;margin-bottom:14px;"><strong>${fromName}</strong> 邀请你交易</div>
      <button class="btn btn-accept" onclick="TradePage.respondInvite('${fromUid}',true)">接受</button>
      <button class="btn btn-reject" onclick="TradePage.respondInvite('${fromUid}',false)">拒绝</button>`;
    document.body.appendChild(popup);
    setTimeout(() => this.removeInvitePopup(), 30000);
  },

  respondInvite(fromUid, accepted) {
    WS.send({ type: 'trade', data: { action: 'invite_respond', from_uid: fromUid, accepted } });
    this.removeInvitePopup();
    if (!accepted) UI.showToast('已拒绝交易邀请');
  },

  removeInvitePopup() {
    ['invite-overlay', 'invite-popup'].forEach(id => document.getElementById(id)?.remove());
  },

  // ==================== 交易面板 ====================

  renderTrading() {
    return `<div class="trade-container">
      <h2>与 ${this.partner?.name || '?'} 的交易</h2>
      <div class="trade-panel">
        <div class="trade-side mine" id="trade-mine">${this.renderMySide()}</div>
        <div class="trade-side partner" id="trade-partner">${this.renderPartnerSide()}</div>
      </div>
      <div class="trade-actions" id="trade-actions">${this.renderActionButtons()}</div>
    </div>`;
  },

  // ---- 我的一侧 ----

  renderMySide() {
    const confirmTag = this.myItemsConfirmed
      ? '<span class="status-tag confirmed">已确认</span>'
      : '<span class="status-tag waiting">未确认</span>';

    const offerFiltered = this.filterByTab(this.myOffer.items, this.offerTab);
    const pg = this.paginate(offerFiltered, this.offerPage, this.bagPageSize);

    const offerTabs = this.tabs.map(t =>
      `<span class="t-tab ${this.offerTab === t.key ? 'active' : ''}" onclick="TradePage.setOfferTab('${t.key}')">${t.label}</span>`
    ).join('');

    this._myOfferFiltered = pg.items;
    const offerItems = pg.items.length
      ? pg.items.map((it, i) => {
          const realIdx = this.myOffer.items.indexOf(it);
          const rmBtn = this.myItemsConfirmed ? '' : `<button class="remove-btn" onclick="TradePage.removeItem(${realIdx})">移除</button>`;
          return this.renderItemRow(it, rmBtn, i, 'myOffer');
        }).join('')
      : '<div class="t-empty">暂无物品</div>';

    const bagSection = this.myItemsConfirmed ? '' : this.renderBagPicker();

    return `<h3>我的出价 ${confirmTag}</h3>
      <div class="t-tabs">${offerTabs}</div>
      <div class="t-item-list">${offerItems}</div>
      ${this.renderPager(pg.page, pg.total, 'TradePage.setOfferPage')}
      <div class="gold-row">
        <label>金币:</label>
        <input type="number" id="trade-gold-input" value="${this.myOffer.gold}" min="0"
          ${this.myItemsConfirmed ? 'disabled' : ''} onchange="TradePage.updateGold(this.value)">
      </div>
      ${bagSection}`;
  },

  renderBagPicker() {
    const offered = new Set(this.myOffer.items.map(i => i.bag_id));
    const available = this.bagItems.filter(b => !offered.has(b.original_id || b.id));
    const filtered = this.filterByTab(available, this.bagTab);
    const pg = this.paginate(filtered, this.bagPage, this.bagPageSize);

    const tabs = this.tabs.map(t =>
      `<span class="t-tab ${this.bagTab === t.key ? 'active' : ''}" onclick="TradePage.setBagTab('${t.key}')">${t.label}</span>`
    ).join('');

    this._bagFiltered = pg.items;
    const items = pg.items.length
      ? pg.items.map((b, i) => {
          const bagId = b.original_id || b.id;
          return this.renderItemRow(b, `<button class="add-btn" onclick="TradePage.addItem(${bagId})">添加</button>`, i, 'bag');
        }).join('')
      : '<div class="t-empty">暂无物品</div>';

    return `<div class="trade-bag-section">
      <h4>背包 (点击添加)</h4>
      <div class="t-tabs">${tabs}</div>
      <div class="t-item-list">${items}</div>
      ${this.renderPager(pg.page, pg.total, 'TradePage.setBagPage')}
    </div>`;
  },

  // ---- 对方一侧 ----

  renderPartnerSide() {
    let statusTag = '<span class="status-tag waiting">选择中</span>';
    if (this.partnerTradeConfirmed) statusTag = '<span class="status-tag confirmed">已确认交易</span>';
    else if (this.partnerItemsConfirmed) statusTag = '<span class="status-tag confirmed">已确认物品</span>';

    const filtered = this.filterByTab(this.partnerOffer.items, this.partnerTab);
    const pg = this.paginate(filtered, this.partnerPage, this.bagPageSize);

    const tabs = this.tabs.map(t =>
      `<span class="t-tab ${this.partnerTab === t.key ? 'active' : ''}" onclick="TradePage.setPartnerTab('${t.key}')">${t.label}</span>`
    ).join('');

    this._partnerOfferFiltered = pg.items;
    const items = pg.items.length
      ? pg.items.map((it, i) => this.renderItemRow(it, '', i, 'partnerOffer')).join('')
      : '<div class="t-empty">等待对方放入物品...</div>';

    return `<h3>对方出价 ${statusTag}</h3>
      <div class="t-tabs">${tabs}</div>
      <div class="t-item-list">${items}</div>
      ${this.renderPager(pg.page, pg.total, 'TradePage.setPartnerPage')}
      <div class="gold-row">
        <label>金币:</label>
        <span class="gold-display">${this.partnerOffer.gold} G</span>
      </div>`;
  },

  refreshMySide() {
    const el = document.getElementById('trade-mine');
    if (el) el.innerHTML = this.renderMySide();
  },

  refreshPartner() {
    const el = document.getElementById('trade-partner');
    if (el) el.innerHTML = this.renderPartnerSide();
    this.updateTradeButtons();
  },

  renderActionButtons() {
    const both = this.myItemsConfirmed && this.partnerItemsConfirmed;
    return `
      <button class="btn btn-confirm-items" onclick="TradePage.confirmItems()" ${this.myItemsConfirmed ? 'disabled' : ''}>
        ${this.myItemsConfirmed ? '物品已确认' : '确认物品'}
      </button>
      <button class="btn btn-confirm-trade" onclick="TradePage.confirmTrade()" ${(!both || this.myTradeConfirmed) ? 'disabled' : ''}>
        ${this.myTradeConfirmed ? '等待对方确认...' : '确认交易'}
      </button>
      <button class="btn btn-cancel" onclick="TradePage.cancelTrade()">取消交易</button>`;
  },

  updateTradeButtons() {
    const el = document.getElementById('trade-actions');
    if (el) el.innerHTML = this.renderActionButtons();
  },

  showItemTooltip(event, index, listType) {
    let list;
    if (listType === 'myOffer') list = this._myOfferFiltered;
    else if (listType === 'partnerOffer') list = this._partnerOfferFiltered;
    else if (listType === 'bag') list = this._bagFiltered;
    const item = list && list[index];
    if (item) Tooltip.showForItem(event, item);
  },

  // ==================== 分页/标签切换 ====================

  setBagTab(t) { this.bagTab = t; this.bagPage = 1; this.refreshMySide(); },
  setBagPage(p) { this.bagPage = p; this.refreshMySide(); },
  setOfferTab(t) { this.offerTab = t; this.offerPage = 1; this.refreshMySide(); },
  setOfferPage(p) { this.offerPage = p; this.refreshMySide(); },
  setPartnerTab(t) { this.partnerTab = t; this.partnerPage = 1; this.refreshPartner(); },
  setPartnerPage(p) { this.partnerPage = p; this.refreshPartner(); },

  // ==================== 交易操作 ====================

  addItem(bagId) {
    if (this.myItemsConfirmed) return;
    const item = this.bagItems.find(b => (b.original_id || b.id) === bagId);
    if (!item) return;
    if (this.myOffer.items.some(i => i.bag_id === bagId)) return;
    const isEquip = Helper.isEquipment(item);
    const maxCount = item.count || 1;
    if (isEquip || maxCount === 1) this._doAddItem(item, bagId, 1);
    else this.showQtyPopup(item, bagId, maxCount);
  },

  showQtyPopup(item, bagId, maxCount) {
    this.removeQtyPopup();
    const overlay = document.createElement('div');
    overlay.id = 'qty-overlay'; overlay.className = 'invite-overlay';
    document.body.appendChild(overlay);
    const popup = document.createElement('div');
    popup.id = 'qty-popup'; popup.className = 'qty-popup';
    popup.innerHTML = `<div class="qty-title">放入 <strong>${item.name}</strong> 的数量</div>
      <input type="number" class="qty-input" id="qty-value" value="${maxCount}" min="1" max="${maxCount}">
      <div class="qty-hint">最多 ${maxCount} 个</div>
      <div class="qty-btns">
        <button class="btn btn-all" onclick="TradePage._confirmQty(${bagId},${maxCount})">全部</button>
        <button class="btn btn-ok" onclick="TradePage._confirmQty(${bagId},0)">确定</button>
        <button class="btn btn-no" onclick="TradePage.removeQtyPopup()">取消</button>
      </div>`;
    document.body.appendChild(popup);
    setTimeout(() => document.getElementById('qty-value')?.focus(), 50);
  },

  _confirmQty(bagId, forceCount) {
    const item = this.bagItems.find(b => (b.original_id || b.id) === bagId);
    if (!item) { this.removeQtyPopup(); return; }
    const maxCount = item.count || 1;
    let count;
    if (forceCount > 0) {
      count = forceCount;
    } else {
      const rawVal = parseInt(document.getElementById('qty-value')?.value, 10);
      if (isNaN(rawVal) || rawVal < 1 || rawVal > maxCount) {
        UI.showToast(`放入失败：数量超出范围，最多可放入 ${maxCount} 个`, 'error');
        return;
      }
      count = rawVal;
    }
    this.removeQtyPopup();
    this._doAddItem(item, bagId, count);
  },

  removeQtyPopup() {
    ['qty-overlay', 'qty-popup'].forEach(id => document.getElementById(id)?.remove());
  },

  _doAddItem(item, bagId, count) {
    this.myOffer.items.push({
      ...item,
      bag_id: bagId,
      count,
    });
    this.sendOfferUpdate();
    this.refreshMySide();
  },

  removeItem(index) {
    if (this.myItemsConfirmed) return;
    this.myOffer.items.splice(index, 1);
    this.sendOfferUpdate();
    this.refreshMySide();
  },

  updateGold(val) {
    if (this.myItemsConfirmed) return;
    const rawVal = parseInt(val, 10);
    if (isNaN(rawVal) || rawVal < 0) {
      UI.showToast('放入失败：请输入有效金币数量', 'error');
      this.refreshMySide();
      return;
    }
    const balance = State.player?.gold ?? 0;
    if (rawVal > balance) {
      UI.showToast(`放入失败：金币不足，最多可放入 ${balance} 金币`, 'error');
      this.refreshMySide();
      return;
    }
    this.myOffer.gold = rawVal;
    this.sendOfferUpdate();
  },

  sendOfferUpdate() {
    WS.send({ type: 'trade', data: { action: 'update_offer', items: this.myOffer.items, gold: this.myOffer.gold } });
  },

  confirmItems() {
    this.myItemsConfirmed = true;
    WS.send({ type: 'trade', data: { action: 'confirm_items' } });
    this.refreshMySide();
    this.updateTradeButtons();
  },

  confirmTrade() {
    if (!this.myItemsConfirmed || !this.partnerItemsConfirmed) return;
    this.myTradeConfirmed = true;
    WS.send({ type: 'trade', data: { action: 'confirm_trade' } });
    this.updateTradeButtons();
  },

  cancelTrade() {
    WS.send({ type: 'trade', data: { action: 'cancel' } });
  },

  async backToLobby() {
    this.view = 'lobby';
    this.resetTradeState();
    await this.loadBag();
    this.render();
    WS.send({ type: 'trade', data: { action: 'join' } });
  }
};

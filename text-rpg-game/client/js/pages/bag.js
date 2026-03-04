const BagPage = {
  items: [],
  filteredItems: [],
  equipment_count: 0,
  equipment_capacity: 100,
  currentTab: 'equipment',
  currentPage: 1,
  pageSize: 15,

  itemTypes: [
    { key: 'equipment', label: '装备' },
    { key: 'consumable', label: '消耗品' },
    { key: 'tool', label: '道具' },
    { key: 'material', label: '材料' }
  ],

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
  },

  get pagedItems() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  },

  render() {
    const backpack = document.getElementById('backpack');
    if (!backpack) return;

    backpack.innerHTML = `
      <style>
        .bag-item {
          position: relative; margin: 3px 0; padding: 6px 10px;
          background: rgba(0, 0, 0, 0.7); border-radius: 6px;
          display: flex; align-items: center; transition: all 0.3s ease;
        }
        .bag-item:hover { background: rgba(20, 20, 40, 0.8); }
        .bag-item-icon {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 5px; display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: bold; color: white; margin-right: 10px; cursor: pointer;
        }
        .bag-item-info { flex: 1; line-height: 1.3; }
        .bag-item-name { font-size: 13px; font-weight: bold; color: #fff; }
        .bag-item-meta { font-size: 11px; color: #48bb78; }
        .bag-item-actions { display: flex; gap: 6px; }
        .bag-item-btn {
          padding: 5px 12px; border: none; border-radius: 4px;
          cursor: pointer; font-size: 12px; transition: all 0.3s ease;
        }
        .bag-item-btn.use { background: #4CAF50; color: white; }
        .bag-item-btn.wear { background: #2196F3; color: white; }
        .bag-item-btn.list { background: #ed8936; color: white; }
        .bag-item-btn.drop { background: #f44336; color: white; }
        .bag-page-info { color: #718096; font-size: 12px; text-align: center; margin-top: 4px; }
        .bag-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .bag-header-left { display: flex; align-items: center; gap: 12px; }
        .bag-capacity { font-size: 12px; color: #a0aec0; }
        .bag-page-title { margin: 0 10px 0 0; font-size: 18px; color: #3b82f6; }
      </style>
      <div class="bag-header">
        <div class="bag-header-left">
          <h2 class="bag-page-title">背包</h2>
          <button class="bag-item-btn drop" onclick="BagPage.clearAllEquipment()">一键清包</button>
          <div class="bag-title">物品</div>
          <div class="bag-tabs">
          ${this.itemTypes.map(type => `
            <div class="bag-tab ${this.currentTab === type.key ? 'active' : ''}" onclick="BagPage.switchTab('${type.key}')">
              ${type.label}
            </div>
          `).join('')}
          </div>
        </div>
        <div class="bag-capacity">背包容量: ${this.equipment_count}/${this.equipment_capacity}</div>
      </div>
      <div class="bag-grid" id="bagGrid">
        ${(this._bagTooltipItems = this.pagedItems).length ? this.pagedItems.map((item, index) => {
          const itemType = Helper.getItemType(item);
          return `
            <div class="bag-item">
              <div class="bag-item-icon" onmouseenter="BagPage.showItemTooltip(event, ${index})" onmouseleave="Tooltip.hide()">
                ${item.name?.charAt(0) || '物'}
              </div>
              <div class="bag-item-info">
                <div class="bag-item-name">${item.name || '物品' + item.item_id}${(item.count || 1) > 1 ? ' ×' + item.count : ''}</div>
                ${itemType === 'equipment' && item.equip_level ? `<div class="bag-item-meta">等级: ${item.equip_level}</div>` : ''}
              </div>
              <div class="bag-item-actions">
                ${itemType === 'equipment' ? `<button class="bag-item-btn wear" onclick="BagPage.wearItem(${item.original_id || item.id})">穿戴</button>` : ''}
                ${itemType === 'consumable' || itemType === 'tool' ? `<button class="bag-item-btn use" onclick="BagPage.onUseItem(${item.original_id || item.id}, ${item.count || 1})">使用</button>` : ''}
                <button class="bag-item-btn list" onclick="AuctionPage.showListPopupFromBagId(${item.original_id || item.id})">上架</button>
                <button class="bag-item-btn drop" onclick="BagPage.dropItem(${item.original_id || item.id})">丢弃</button>
              </div>
            </div>`;
        }).join('') : '<div style="text-align:center;color:#718096;padding:20px;">暂无物品</div>'}
      </div>
      <div class="bag-footer">
        <div class="pagination">
          ${this.renderPagination()}
        </div>
      </div>
      <div class="bag-page-info">${this.filteredItems.length} 件物品 · 第 ${this.currentPage}/${this.totalPages} 页</div>
    `;
  },

  renderPagination() {
    const total = this.totalPages;
    if (total <= 1) return '';
    let btns = '';
    if (this.currentPage > 1) {
      btns += `<button class="pagination-btn" onclick="BagPage.goPage(${this.currentPage - 1})">上一页</button>`;
    }
    for (let i = 1; i <= total; i++) {
      if (total > 7 && i > 3 && i < total - 2 && Math.abs(i - this.currentPage) > 1) {
        if (btns.slice(-3) !== '...') btns += '<span style="color:#718096;padding:0 4px;">...</span>';
        continue;
      }
      btns += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="BagPage.goPage(${i})">${i}</button>`;
    }
    if (this.currentPage < total) {
      btns += `<button class="pagination-btn" onclick="BagPage.goPage(${this.currentPage + 1})">下一页</button>`;
    }
    return btns;
  },

  goPage(p) {
    this.currentPage = Math.max(1, Math.min(p, this.totalPages));
    this.render();
  },

  showItemTooltip(event, index) {
    const item = this._bagTooltipItems?.[index];
    if (item) Tooltip.showForItem(event, item);
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.currentPage = 1;
    this.filterItems();
    this.render();
  },

  filterItems() {
    this.filteredItems = this.items.filter(item => Helper.getItemType(item) === this.currentTab);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
  },

  async load() {
    const result = await BagService.fetchList();
    if (result.code === 0 && result.data) {
      const { items, equipment_count, equipment_capacity } = result.data;
      this.items = items;
      this.equipment_count = equipment_count;
      this.equipment_capacity = equipment_capacity;
      this.filterItems();
      this.render();
    } else {
      UI.showToast('加载背包失败');
    }
  },

  onUseItem(itemId, maxCount) {
    if (maxCount <= 1) {
      this.useItem(itemId, 1);
      return;
    }
    this.showUseQtyPopup(itemId, maxCount);
  },

  showUseQtyPopup(itemId, maxCount) {
    this.removeUseQtyPopup();
    const overlay = document.createElement('div');
    overlay.id = 'bag-qty-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99;';
    document.body.appendChild(overlay);
    const popup = document.createElement('div');
    popup.id = 'bag-qty-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a202c;border:2px solid #4299e1;border-radius:12px;padding:20px;z-index:100;text-align:center;min-width:240px;color:#e2e8f0;';
    popup.innerHTML = `
      <div style="font-size:14px;margin-bottom:10px;">使用数量</div>
      <input type="number" id="bag-qty-value" value="1" min="1" max="${maxCount}" style="width:80px;padding:6px;background:#2d3748;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#e2e8f0;font-size:15px;text-align:center;">
      <div style="font-size:11px;color:#718096;margin:6px 0;">最多 ${maxCount} 个</div>
      <div style="display:flex;justify-content:center;gap:8px;">
        <button onclick="BagPage.confirmUseQty(${itemId},${maxCount},${maxCount})" style="padding:6px 16px;background:#48bb78;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">全部</button>
        <button onclick="BagPage.confirmUseQty(${itemId},${maxCount},0)" style="padding:6px 16px;background:#4299e1;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">确定</button>
        <button onclick="BagPage.removeUseQtyPopup()" style="padding:6px 16px;background:#718096;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">取消</button>
      </div>`;
    document.body.appendChild(popup);
    setTimeout(() => document.getElementById('bag-qty-value')?.focus(), 50);
  },

  confirmUseQty(itemId, maxCount, forceCount) {
    let count;
    if (forceCount > 0) {
      count = forceCount;
    } else {
      const rawVal = parseInt(document.getElementById('bag-qty-value')?.value, 10);
      if (isNaN(rawVal) || rawVal < 1 || rawVal > maxCount) {
        UI.showToast(`使用失败：数量超出范围，最多可使用 ${maxCount} 个`, 'error');
        return;
      }
      count = rawVal;
    }
    this.removeUseQtyPopup();
    this.useItem(itemId, count);
  },

  removeUseQtyPopup() {
    document.getElementById('bag-qty-overlay')?.remove();
    document.getElementById('bag-qty-popup')?.remove();
  },

  async useItem(itemId, count = 1) {
    const result = await BagService.useItem(itemId, count);
    if (result.code === 0) {
      UI.showToast(result.msg || '使用成功');
    } else {
      UI.showToast(result.msg || '使用失败');
    }
  },

  _wearLoading: false,
  async wearItem(itemId) {
    if (this._wearLoading) return;
    this._wearLoading = true;
    try {
      const result = await BagService.wearItem(itemId);
      if (result.code === 0) {
        UI.showToast('穿戴成功');
      } else {
        UI.showToast(result.msg || '穿戴失败');
      }
    } finally {
      this._wearLoading = false;
    }
  },

  async dropItem(itemId) {
    if (!confirm('确定要丢弃这个物品吗？')) return;
    const result = await BagService.deleteItem(itemId);
    if (result.code === 0) {
      UI.showToast('丢弃成功');
    } else {
      UI.showToast(result.msg || '丢弃失败');
    }
  },

  async clearAllEquipment() {
    const equipCount = this.items.filter(it => Helper.getItemType(it) === 'equipment').length;
    if (equipCount <= 0) {
      UI.showToast('背包内没有装备');
      return;
    }
    const msg = `【高危操作】确定要一键清除背包内全部 ${equipCount} 件装备吗？\n\n此操作不可撤销，装备将永久删除。`;
    if (!confirm(msg)) return;
    const result = await BagService.clearAllEquipment();
    if (result.code === 0) {
      UI.showToast(result.msg || '清包成功');
      this.load();
    } else {
      UI.showToast(result.msg || '清包失败');
    }
  }
};

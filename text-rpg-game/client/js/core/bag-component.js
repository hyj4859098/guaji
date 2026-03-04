const BagComponent = {
  // 存储所有背包数据
  allItems: [],
  // 存储各个栏的配置
  bags: {},

  // 物品类型映射（与数据库、GM 一致：3=材料 4=道具）
  itemTypes: [
    { key: 'equipment', label: '装备', type: 2 },
    { key: 'consumable', label: '消耗品', type: 1 },
    { key: 'tool', label: '道具', type: 4 },
    { key: 'material', label: '材料', type: 3 }
  ],

  // 初始化一个背包栏
  initBag(bagId, containerId, options = {}) {
    this.bags[bagId] = {
      containerId,
      mode: options.mode || 'full', // full, select, preview
      typeFilter: options.typeFilter || null,
      onSelect: options.onSelect || null,
      items: []
    };
    this.renderBag(bagId);
  },

  // 加载所有背包数据
  async load() {
    UI.showLoading();
    const result = await BagService.fetchList();
    UI.hideLoading();
    
    if (result.code === 0 && result.data) {
      this.allItems = result.data.items;
      // 更新所有背包栏
      Object.keys(this.bags).forEach(bagId => {
        this.updateBagItems(bagId);
      });
      // 更新全局状态（统一格式）
      if (State.setBag) {
        State.setBag(result.data);
      }
    } else {
      UI.showToast('加载背包失败');
    }
  },

  // 更新指定背包栏的物品
  updateBagItems(bagId) {
    const bag = this.bags[bagId];
    if (!bag) return;
    
    if (bag.typeFilter) {
      bag.items = this.allItems.filter(item => 
        this.getItemType(item) === bag.typeFilter
      );
    } else {
      bag.items = [...this.allItems];
    }
    this.renderBag(bagId);
  },

  getItemType(item) {
    return Helper.getItemType(item);
  },

  // 渲染指定背包栏
  renderBag(bagId) {
    const bag = this.bags[bagId];
    if (!bag) return;
    
    const container = document.getElementById(bag.containerId);
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 添加样式
    this.addStyles(container);
    
    // 渲染物品列表
    this.renderItems(bagId, container);
  },

  // 添加样式
  addStyles(container) {
    const style = document.createElement('style');
    style.textContent = `
      .bag-container {
        width: 100%;
      }
      
      .bag-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .bag-title {
        font-size: 16px;
        font-weight: bold;
        color: #3b82f6;
      }
      
      .bag-items {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .bag-item {
        position: relative;
        padding: 12px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 6px;
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
        cursor: ${this.mode === 'select' ? 'pointer' : 'default'};
      }
      
      .bag-item:hover {
        background: rgba(20, 20, 40, 0.8);
        transform: translateY(-2px);
      }
      
      .bag-item-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: white;
        margin-right: 12px;
      }
      
      .bag-item-info {
        flex: 1;
      }
      
      .bag-item-name {
        font-size: 14px;
        font-weight: bold;
        color: #ffffff;
        margin-bottom: 4px;
      }
      
      .bag-item-desc {
        font-size: 12px;
        color: #b0b0b0;
        margin-bottom: 2px;
      }
      
      .bag-item-count {
        font-size: 12px;
        color: #66ccff;
      }
      
      .bag-item-actions {
        display: flex;
        gap: 8px;
      }
      
      .bag-action-btn {
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 3px;
        border: none;
        cursor: pointer;
      }
      
      .bag-action-btn.use {
        background: #10b981;
        color: white;
      }
      
      .bag-action-btn.drop {
        background: #ef4444;
        color: white;
      }
      
      .bag-empty {
        text-align: center;
        color: #b0b0b0;
        padding: 20px;
        font-style: italic;
      }
    `;
    container.appendChild(style);
  },

  // 渲染物品列表
  renderItems(bagId, container) {
    const bag = this.bags[bagId];
    if (!bag) return;
    
    // 创建容器
    const bagContainer = document.createElement('div');
    bagContainer.className = 'bag-container';
    
    // 创建头部
    const header = document.createElement('div');
    header.className = 'bag-header';
    header.innerHTML = `<div class="bag-title">${this.getTypeLabel(bag.typeFilter) || '背包'}</div>`;
    bagContainer.appendChild(header);
    
    // 创建物品列表
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'bag-items';
    
    if (bag.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bag-empty';
      empty.textContent = '暂无物品';
      itemsContainer.appendChild(empty);
    } else {
      bag.items.forEach(item => {
        const itemElement = this.createItemElement(bagId, item);
        itemsContainer.appendChild(itemElement);
      });
    }
    
    bagContainer.appendChild(itemsContainer);
    container.appendChild(bagContainer);
  },

  // 获取类型标签
  getTypeLabel(typeKey) {
    if (!typeKey) return '背包';
    const type = this.itemTypes.find(t => t.key === typeKey);
    return type ? type.label : '物品';
  },

  // 创建物品元素
  createItemElement(bagId, item) {
    const bag = this.bags[bagId];
    if (!bag) return document.createElement('div');
    
    const itemElement = document.createElement('div');
    itemElement.className = 'bag-item';
    
    // 物品图标（支持 Tooltip 悬浮窗，统一使用 Tooltip.showForItem）
    const icon = document.createElement('div');
    icon.className = 'bag-item-icon';
    icon.textContent = item.name ? item.name[0] : '?';
    if (typeof Tooltip !== 'undefined') {
      icon.onmouseenter = (e) => Tooltip.showForItem(e, item);
      icon.onmouseleave = () => Tooltip.hide();
    }
    itemElement.appendChild(icon);
    
    // 物品信息
    const info = document.createElement('div');
    info.className = 'bag-item-info';
    
    const name = document.createElement('div');
    name.className = 'bag-item-name';
    name.textContent = item.name || '未知物品';
    info.appendChild(name);
    
    if (item.equip_attributes) {
      const attr = document.createElement('div');
      attr.className = 'bag-item-desc';
      attr.textContent = `攻击: ${item.equip_attributes.phy_atk || 0}`;
      info.appendChild(attr);
    }
    
    const count = document.createElement('div');
    count.className = 'bag-item-count';
    count.textContent = `数量: ${item.count || 1}`;
    info.appendChild(count);
    
    itemElement.appendChild(info);
    
    // 操作按钮
    if (bag.mode === 'full') {
      const actions = document.createElement('div');
      actions.className = 'bag-item-actions';
      
      const useBtn = document.createElement('button');
      useBtn.className = 'bag-action-btn use';
      useBtn.textContent = '使用';
      useBtn.onclick = (e) => {
        e.stopPropagation();
        this.useItem(item);
      };
      actions.appendChild(useBtn);
      
      const dropBtn = document.createElement('button');
      dropBtn.className = 'bag-action-btn drop';
      dropBtn.textContent = '丢弃';
      dropBtn.onclick = (e) => {
        e.stopPropagation();
        this.dropItem(item);
      };
      actions.appendChild(dropBtn);
      
      itemElement.appendChild(actions);
    } else if (bag.mode === 'select' && bag.onSelect) {
      // 选择模式下点击整个物品
      itemElement.onclick = () => {
        bag.onSelect(item);
      };
    }
    
    return itemElement;
  },

  // 使用物品
  async useItem(item) {
    UI.showLoading();
    const result = await BagService.useItem(item.original_id || item.id);
    UI.hideLoading();
    
    if (result.code === 0) {
      UI.showToast('使用成功');
      // 刷新由服务端 WebSocket 推送 player + bag，统一经 RefreshBus 更新
    } else {
      UI.showToast(result.msg || '使用失败');
    }
  },

  async dropItem(item) {
    if (!confirm('确定要丢弃这个物品吗？')) return;
    UI.showLoading();
    const result = await BagService.deleteItem(item.original_id || item.id);
    UI.hideLoading();

    if (result.code === 0) {
      UI.showToast('丢弃成功');
    } else {
      UI.showToast(result.msg || '丢弃失败');
    }
  },

  // 刷新指定背包栏
  refreshBag(bagId) {
    this.updateBagItems(bagId);
  },

  // 刷新所有背包栏
  refreshAll() {
    this.load();
  }
};

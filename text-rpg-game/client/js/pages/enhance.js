const EnhancePage = {
  equipItems: [],
  materials: [],
  useLuckyCharm: false,
  useAntiExplode: false,
  currentPage: 1,
  pageSize: 8,

  getStoneCost(targetLevel) {
    return targetLevel * targetLevel * 100;
  },

  getBaseSuccessRate(targetLevel) {
    return Math.max(20, 100 - (targetLevel - 1) * 10);
  },

  get totalPages() {
    return Math.max(1, Math.ceil((this.equipItems || []).length / this.pageSize));
  },

  get pagedItems() {
    const start = (this.currentPage - 1) * this.pageSize;
    return (this.equipItems || []).slice(start, start + this.pageSize);
  },

  async load(bagData) {
    if (!bagData) {
      const bagResult = await BagService.fetchList();
      bagData = (bagResult.code === 0) ? bagResult.data : null;
    }
    if (bagData) {
      this.equipItems = (bagData || []).filter(i => i.type === 2 && (i.equipment_uid || i.equip_attributes));
      this.materials = (bagData || []).filter(i => [6, 7, 8, 10].includes(Number(i.item_id)));
    } else {
      this.equipItems = [];
      this.materials = [];
    }
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this._enhancing = false;
    this._blessing = false;
    this.render();
  },

  getMaterialCount(itemId) {
    const m = (this.materials || []).find(i => Number(i.item_id) === itemId);
    return m ? (m.count ?? 1) : 0;
  },

  goPage(p) {
    this.currentPage = Math.max(1, Math.min(p, this.totalPages));
    this.render();
  },

  showItemTooltip(event, index) {
    const item = this._enhanceTooltipItems?.[index];
    if (item) Tooltip.showForItem(event, item);
  },

  renderPagination() {
    const total = this.totalPages;
    if (total <= 1) return '';
    let btns = '';
    if (this.currentPage > 1) {
      btns += `<button class="e-page-btn" onclick="EnhancePage.goPage(${this.currentPage - 1})">上一页</button>`;
    }
    for (let i = 1; i <= total; i++) {
      if (total > 7 && i > 3 && i < total - 2 && Math.abs(i - this.currentPage) > 1) {
        if (btns.slice(-3) !== '...') btns += '<span style="color:#718096;padding:0 4px;">...</span>';
        continue;
      }
      btns += `<button class="e-page-btn ${i === this.currentPage ? 'active' : ''}" onclick="EnhancePage.goPage(${i})">${i}</button>`;
    }
    if (this.currentPage < total) {
      btns += `<button class="e-page-btn" onclick="EnhancePage.goPage(${this.currentPage + 1})">下一页</button>`;
    }
    return btns;
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;
    const stoneCount = this.getMaterialCount(6);
    const antiCount = this.getMaterialCount(7);
    const luckyCount = this.getMaterialCount(8);
    const oilCount = this.getMaterialCount(10);
    const maxLevel = 20;

    app.innerHTML = `
      <style>
        .enhance-container { padding: 10px 15px; max-width: 960px; margin: 0 auto; color: #e2e8f0; }
        .enhance-container h2 { color: #e2e8f0; margin-bottom: 10px; font-size: 16px; }
        .enhance-mat { margin-bottom: 10px; padding: 8px 12px; background: rgba(26,32,44,0.8); border-radius: 6px; }
        .enhance-mat h3 { color: #48bb78; margin: 0 0 6px; font-size: 13px; }
        .enhance-mat-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; font-size: 12px; }
        .enhance-mat-row label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
        .enhance-equip-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .enhance-equip-hdr h3 { color: #4299e1; margin: 0; font-size: 13px; }
        .enhance-page-info { color: #718096; font-size: 11px; }
        .e-item {
          display: flex; align-items: center; padding: 6px 10px;
          background: rgba(0,0,0,0.7); border-radius: 5px; margin-bottom: 4px;
          transition: background 0.2s;
        }
        .e-item:hover { background: rgba(20,20,40,0.8); }
        .e-item-icon {
          width: 32px; height: 32px; border-radius: 5px; flex-shrink: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: bold; color: white; margin-right: 8px; cursor: pointer;
        }
        .e-item-info { flex: 1; min-width: 0; }
        .e-item-top { display: flex; align-items: baseline; gap: 6px; }
        .e-item-name { font-size: 13px; font-weight: bold; color: #4299e1; }
        .e-item-lv { font-size: 11px; color: #48bb78; }
        .e-item-cost { font-size: 11px; color: #ecc94b; margin-top: 1px; }
        .e-item-btns { display: flex; gap: 4px; flex-shrink: 0; }
        .e-item-btn {
          padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer;
          font-size: 11px; flex-shrink: 0; transition: background 0.2s;
        }
        .e-item-btn.enhance { background: #c53030; color: #faf089; }
        .e-item-btn.enhance:hover:not(:disabled) { background: #9b2c2c; }
        .e-item-btn.bless { background: #b7791f; color: #fefcbf; }
        .e-item-btn.bless:hover:not(:disabled) { background: #975a16; }
        .e-item-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .e-pager { display: flex; justify-content: center; gap: 4px; margin-top: 6px; }
        .e-page-btn {
          padding: 2px 8px; background: #2d3748; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px; color: #a0aec0; cursor: pointer; font-size: 11px;
        }
        .e-page-btn.active { background: #4299e1; color: white; }
        .e-page-btn:hover { background: #4a5568; }
      </style>
      <div class="enhance-container">
        <h2>装备强化</h2>
        <div class="enhance-mat">
          <h3>材料</h3>
          <div class="enhance-mat-row">
            <span>强化石 ×${stoneCount}</span>
            <label>
              <input type="checkbox" class="enhance-use-lucky" ${this.useLuckyCharm ? 'checked' : ''} ${luckyCount < 1 ? 'disabled' : ''}>
              幸运符(+20%) <span style="color:#66ccff;">×${luckyCount}</span>
            </label>
            <label>
              <input type="checkbox" class="enhance-use-anti" ${this.useAntiExplode ? 'checked' : ''} ${antiCount < 1 ? 'disabled' : ''}>
              防爆符(不损坏) <span style="color:#66ccff;">×${antiCount}</span>
            </label>
            <span style="border-left:1px solid rgba(255,255,255,0.15);padding-left:12px;">祝福油 <span style="color:#fbbf24;">×${oilCount}</span> <span style="color:#718096;font-size:10px;">| 50%成功率 | 100万金币/次</span></span>
          </div>
        </div>
        <div class="enhance-equip-hdr">
          <h3>背包装备</h3>
          <span class="enhance-page-info">${this.equipItems.length} 件 · 第 ${this.currentPage}/${this.totalPages} 页</span>
        </div>
        <div class="enhance-bag-grid">
          ${(this._enhanceTooltipItems = this.pagedItems).length ? this.pagedItems.map((e, index) => {
            const lv = e.enhance_level ?? 0;
            const equipLevel = e.equip_level ?? e.level ?? 0;
            const targetLv = lv + 1;
            const stoneCost = this.getStoneCost(targetLv);
            const canEnhance = lv < maxLevel && stoneCount >= stoneCost;
            const instanceId = e.equipment_uid ? (parseInt(String(e.equipment_uid), 10) || 0) : 0;
            const baseRate = lv < maxLevel ? this.getBaseSuccessRate(targetLv) : 0;
            const finalRate = lv < maxLevel ? Math.min(100, baseRate + (this.useLuckyCharm ? 20 : 0)) : 0;
            const rateColor = finalRate >= 80 ? '#48bb78' : finalRate >= 50 ? '#ecc94b' : '#fc8181';
            const blessLv = e.blessing_level ?? 0;
            const lvText = lv >= maxLevel ? '已满级' : `+${lv}`;
            const blessText = blessLv > 0 ? `<span style="color:#fbbf24;font-size:11px;margin-left:4px;">祝福+${blessLv}</span>` : '';
            const costText = lv < maxLevel ? `→+${targetLv} 需${stoneCost}石 | <span style="color:${rateColor}">${finalRate}%</span>` : '';
            return `
            <div class="e-item" data-instance-id="${instanceId}">
              <div class="e-item-icon" onmouseenter="EnhancePage.showItemTooltip(event, ${index})" onmouseleave="Tooltip.hide()">
                ${(e.name || '装').charAt(0)}
              </div>
              <div class="e-item-info">
                <div class="e-item-top">
                  <span class="e-item-name">${e.name || '装备'}${equipLevel ? `(${equipLevel}级)` : ''}</span>
                  <span class="e-item-lv">${lvText}</span>${blessText}
                </div>
                ${costText ? `<div class="e-item-cost">${costText}</div>` : ''}
              </div>
              <div class="e-item-btns">
                <button class="e-item-btn enhance enhance-bag-item-btn" data-instance-id="${instanceId}" ${canEnhance ? '' : 'disabled'}>强化</button>
                <button class="e-item-btn bless bless-bag-item-btn" data-instance-id="${instanceId}" ${oilCount >= 1 ? '' : 'disabled'}>祝福</button>
              </div>
            </div>`;
          }).join('') : '<div style="text-align:center;color:#718096;padding:16px;font-size:13px;">暂无可强化装备</div>'}
        </div>
        <div class="e-pager">${this.renderPagination()}</div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const container = document.querySelector('.enhance-container');
    if (!container) return;

    const luckyCb = container.querySelector('.enhance-use-lucky');
    const antiCb = container.querySelector('.enhance-use-anti');
    if (luckyCb) luckyCb.addEventListener('change', (e) => { this.useLuckyCharm = e.target.checked; this.render(); });
    if (antiCb) antiCb.addEventListener('change', (e) => { this.useAntiExplode = e.target.checked; });

    container.querySelectorAll('.enhance-bag-item-btn, .bless-bag-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const instanceId = parseInt(btn.getAttribute('data-instance-id'), 10);
        const equip = (this.equipItems || []).find(i => parseInt(String(i.equipment_uid), 10) === instanceId);
        if (!equip) return;
        if (btn.classList.contains('enhance')) this.doEnhance(equip, btn);
        else if (btn.classList.contains('bless')) this.doBlessing(equip, btn);
      });
    });
  },

  _enhancing: false,

  async doEnhance(equip, btnEl) {
    if (this._enhancing) return;

    const instanceId = parseInt(String(equip.equipment_uid), 10);
    if (!instanceId) {
      UI.showToast('装备数据异常');
      return;
    }
    const lv = equip.enhance_level ?? 0;
    if (lv >= 20) {
      UI.showToast('装备已达最大强化等级');
      return;
    }
    const stoneCost = this.getStoneCost(lv + 1);
    if (this.getMaterialCount(6) < stoneCost) {
      UI.showToast(`强化石不足，需要 ${stoneCost}`);
      return;
    }
    if (this.useLuckyCharm && this.getMaterialCount(8) < 1) {
      UI.showToast('幸运符不足');
      return;
    }
    if (this.useAntiExplode && this.getMaterialCount(7) < 1) {
      UI.showToast('防爆符不足');
      return;
    }

    this._enhancing = true;
    const allBtns = document.querySelectorAll('.enhance-bag-item-btn.enhance');
    allBtns.forEach(b => b.disabled = true);

    const res = await API.post('/equip/enhance', {
      instance_id: instanceId,
      use_lucky_charm: this.useLuckyCharm,
      use_anti_explode: this.useAntiExplode,
    });

    if (res.code === 0) {
      const msg = res.msg || (res.data?.broken ? '强化失败，装备已破碎' : '强化成功');
      UI.showToast(msg);
    } else {
      UI.showToast(res.msg || '强化失败');
      this._enhancing = false;
      allBtns.forEach(b => b.disabled = false);
      return;
    }

    setTimeout(() => {
      if (this._enhancing) {
        this._enhancing = false;
        this.load();
      }
    }, 500);
  },

  _blessing: false,

  async doBlessing(equip, btnEl) {
    if (this._blessing) return;
    const instanceId = parseInt(String(equip.equipment_uid), 10);
    if (!instanceId) { UI.showToast('装备数据异常'); return; }
    if (this.getMaterialCount(10) < 1) { UI.showToast('祝福油不足'); return; }

    this._blessing = true;
    const allBtns = document.querySelectorAll('.bless-bag-item-btn');
    allBtns.forEach(b => b.disabled = true);

    const res = await API.post('/equip/bless', { instance_id: instanceId });

    if (res.code === 0) {
      UI.showToast(res.msg || '祝福完成');
    } else {
      UI.showToast(res.msg || '祝福失败');
    }

    setTimeout(() => {
      if (this._blessing) {
        this._blessing = false;
        this.load();
      }
    }, 500);
  },
};

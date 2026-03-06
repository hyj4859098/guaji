const EnhancePage = {
  equipItems: [],
  materials: [],
  materialIds: null,
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

  async load(bagPayload) {
    if (!this.materialIds) {
      const cfgRes = await API.get('/config/enhance_materials');
      this.materialIds = (cfgRes.code === 0 && cfgRes.data)
        ? cfgRes.data
        : { stone: 6, lucky: 8, anti_explode: 7, blessing_oil: 10 };
    }
    if (!bagPayload) {
      const bagResult = await BagService.fetchList();
      bagPayload = (bagResult.code === 0 && bagResult.data) ? bagResult.data : null;
    }
    const payload = BagService.parseBagPayload(bagPayload);
    this.equipItems = payload.items.filter(i => Helper.isEquipment(i) && (i.equipment_uid || i.equip_attributes));
    const ids = this.materialIds;
    const matIdList = [ids.stone, ids.anti_explode, ids.lucky, ids.blessing_oil];
    this.materials = payload.items.filter(i => matIdList.includes(Number(i.item_id)));
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
    const ids = this.materialIds || { stone: 6, lucky: 8, anti_explode: 7, blessing_oil: 10 };
    const stoneCount = this.getMaterialCount(ids.stone);
    const antiCount = this.getMaterialCount(ids.anti_explode);
    const luckyCount = this.getMaterialCount(ids.lucky);
    const oilCount = this.getMaterialCount(ids.blessing_oil);
    const maxLevel = 20;

    app.innerHTML = `
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
    const ids = this.materialIds || { stone: 6, lucky: 8, anti_explode: 7, blessing_oil: 10 };
    const stoneCost = this.getStoneCost(lv + 1);
    if (this.getMaterialCount(ids.stone) < stoneCost) {
      UI.showToast(`强化石不足，需要 ${stoneCost}`);
      return;
    }
    if (this.useLuckyCharm && this.getMaterialCount(ids.lucky) < 1) {
      UI.showToast('幸运符不足');
      return;
    }
    if (this.useAntiExplode && this.getMaterialCount(ids.anti_explode) < 1) {
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
    const ids = this.materialIds || { blessing_oil: 10 };
    if (this.getMaterialCount(ids.blessing_oil) < 1) { UI.showToast('祝福油不足'); return; }

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

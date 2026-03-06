const BoostPage = {
  config: null,
  player: null,

  style: '',

  categoryNames: { exp: '经验', gold: '金币', drop: '掉落', reputation: '声望' },
  multiplierValues: { x2: 2, x4: 4, x8: 8 },

  async load() {
    const [boostResult, playerResult] = await Promise.all([
      API.get('/boost/config'),
      API.get('/player/list'),
    ]);
    if (boostResult.code === 0) this.config = boostResult.data;
    if (playerResult.code === 0 && playerResult.data?.length) this.player = playerResult.data[0];
    this.render();
  },

  getVipHTML() {
    const p = this.player;
    const expireTime = p?.vip_expire_time || 0;
    const now = Math.floor(Date.now() / 1000);
    const isActive = expireTime > 0 && expireTime > now;

    let statusHTML;
    if (isActive) {
      const d = new Date(expireTime * 1000);
      const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      statusHTML = `<span class="vip-active">${dateStr} 到期</span>`;
    } else {
      statusHTML = `<span class="vip-expired">已到期</span>`;
    }

    return `
      <div class="vip-panel">
        <h3>VIP 会员</h3>
        <div class="vip-status">状态：${statusHTML}</div>
        <div class="vip-benefits">
          VIP 特权：<br>
          <span>· 离线挂机</span> — 退出游戏后角色继续自动战斗<br>
          <span>· 双倍经验</span> — 战斗获得经验 ×2<br>
          <span>· 双倍金币</span> — 战斗获得金币 ×2<br>
          <span>· 双倍掉落</span> — 战斗掉落概率 ×2<br>
          <span>· 双倍声望</span> — 战斗获得声望 ×2<br>
          <span>· 技能释放</span> — 技能释放概率 +20%<br>
          <span style="color:#a0aec0;">VIP双倍与多倍卡可叠加（乘法）</span><br>
          <span style="color:#a0aec0;">在背包中使用「VIP卡（月卡）」可增加30天VIP时间</span>
        </div>
      </div>`;
  },

  calcCategoryMult(catData) {
    if (!catData) return 1;
    let m = 1;
    for (const key of ['x2', 'x4', 'x8']) {
      const slot = catData[key];
      if (slot && slot.enabled && slot.charges > 0) {
        m *= this.multiplierValues[key];
      }
    }
    return m;
  },

  render() {
    const app = document.getElementById('app');
    const cfg = this.config || {};
    const cats = ['exp', 'gold', 'drop', 'reputation'];
    const muls = ['x2', 'x4', 'x8'];

    const p = this.player;
    const vipExpire = p?.vip_expire_time || 0;
    const isVip = vipExpire > 0 && vipExpire > Math.floor(Date.now() / 1000);
    const vipMult = isVip ? 2 : 1;

    let rows = '';
    for (const cat of cats) {
      const catData = cfg[cat] || {};
      const cardMult = this.calcCategoryMult(catData);
      const totalMult = cardMult * vipMult;
      let cells = '';
      for (const mul of muls) {
        const slot = catData[mul] || { charges: 0, enabled: false };
        const hasCharges = slot.charges > 0;
        const checked = slot.enabled && hasCharges ? 'checked' : '';
        const disabled = !hasCharges ? 'disabled' : '';
        const chargesClass = slot.enabled && hasCharges ? 'active' : '';
        cells += `
          <td>
            <div class="boost-cell">
              <input type="checkbox" ${checked} ${disabled}
                onchange="BoostPage.onToggle('${cat}','${mul}',this.checked)">
              <span class="boost-charges ${chargesClass}">${slot.charges}次</span>
            </div>
          </td>`;
      }
      const vipCell = isVip
        ? '<td><span class="mult-value boosted">×2</span></td>'
        : '<td><span class="mult-value">×1</span></td>';
      const multClass = totalMult > 1 ? 'boosted' : '';
      rows += `
        <tr>
          <td class="cat-label">${this.categoryNames[cat]}</td>
          ${cells}
          ${vipCell}
          <td><span class="mult-value ${multClass}">×${totalMult}</span></td>
        </tr>`;
    }

    app.innerHTML = `
      ${this.style}
      <div class="boost-container">
        ${this.getVipHTML()}
        <h2>多倍加成</h2>
        <table class="boost-table">
          <thead>
            <tr>
              <th style="text-align:left">类别</th>
              <th>2倍</th><th>4倍</th><th>8倍</th>
              <th>VIP</th>
              <th>总倍率</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="boost-hint">
          使用多倍卡增加次数 · 勾选启用 · 每场战斗胜利消耗1次 · 倍率乘法叠加<br>
          VIP双倍自动生效，与多倍卡叠加计算
        </div>
      </div>
    `;
  },

  async onToggle(category, multiplier, enabled) {
    const result = await API.post('/boost/toggle', { category, multiplier, enabled });
    if (result.code === 0 && result.data) {
      this.config = result.data;
      this.render();
    } else {
      UI.showToast(result.msg || '切换失败');
      this.load();
    }
  }
};

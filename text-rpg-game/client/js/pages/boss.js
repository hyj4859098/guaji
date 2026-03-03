/**
 * Boss 挑战页面
 * 展示 Boss 列表、挑战次数、战斗日志
 */
const BossPage = {
  style: `
    <style>
      .boss-container { max-width: 960px; margin: 0 auto; padding: 10px 15px; }

      .boss-header {
        text-align: center; margin-bottom: 12px; color: #e2e8f0;
      }
      .boss-header h2 { color: #f6ad55; margin: 0 0 4px; font-size: 18px; }
      .boss-header .boss-info-bar {
        font-size: 12px; color: #a0aec0;
      }

      .boss-body { display: flex; gap: 10px; align-items: flex-start; }
      .boss-list-panel {
        width: 280px; flex-shrink: 0;
        background: #1a202c; border-radius: 6px; padding: 10px;
        border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0;
        max-height: 70vh; overflow-y: auto;
      }
      .boss-list-panel h3 {
        margin: 0 0 8px; color: #f6ad55; font-size: 13px;
        border-bottom: 1px solid rgba(246,173,85,0.2); padding-bottom: 5px;
      }

      .boss-card {
        background: #2d3748; border-radius: 6px; padding: 8px 10px;
        margin-bottom: 8px; cursor: pointer; transition: all 0.2s;
        border: 1px solid transparent;
      }
      .boss-card:hover { border-color: #f6ad55; }
      .boss-card.selected { border-color: #f6ad55; background: #3a4a5e; }
      .boss-card-name { font-size: 13px; font-weight: bold; color: #f6ad55; }
      .boss-card-info { font-size: 11px; color: #a0aec0; margin-top: 2px; }
      .boss-card-status { font-size: 11px; margin-top: 4px; }
      .boss-card-status .can-fight { color: #48bb78; }
      .boss-card-status .cannot-fight { color: #f56565; }

      .boss-type-normal { border-left: 3px solid #48bb78; }
      .boss-type-elite { border-left: 3px solid #9f7aea; }
      .boss-type-world { border-left: 3px solid #f56565; }

      .boss-detail-panel {
        flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
      }

      .boss-stats {
        background: #1a202c; border-radius: 6px; padding: 10px;
        border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0;
      }
      .boss-stats h3 {
        margin: 0 0 8px; color: #f6ad55; font-size: 13px;
        border-bottom: 1px solid rgba(246,173,85,0.2); padding-bottom: 5px;
      }
      .boss-stats-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px;
      }
      .boss-stat-item {
        font-size: 12px; display: flex; justify-content: space-between;
      }

      .boss-actions {
        display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
      }
      .boss-challenge-btn {
        padding: 8px 24px; border: none; border-radius: 6px;
        font-size: 14px; font-weight: bold; cursor: pointer;
        background: linear-gradient(135deg, #f6ad55, #ed8936);
        color: #1a202c; transition: all 0.3s;
      }
      .boss-challenge-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(246,173,85,0.4); }
      .boss-challenge-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
      .boss-back-btn {
        padding: 8px 16px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
        font-size: 12px; cursor: pointer; background: transparent; color: #e2e8f0;
      }

      .boss-battle-log {
        background: #16213e; flex: 1; min-height: 200px;
        border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
        padding: 10px; overflow-y: auto; max-height: 50vh;
      }
      .boss-battle-log h3 {
        margin: 0 0 8px; color: #f6ad55; font-size: 13px;
        border-bottom: 1px solid rgba(246,173,85,0.2); padding-bottom: 5px;
      }

      .boss-log-item { padding: 1px 2px; font-size: 12px; color: #e2e8f0; }
      .boss-log-round { color: #3b82f6; font-weight: bold; text-align: center; }
      .boss-log-player { color: #fbbf24; }
      .boss-log-monster { color: #f43f5e; }
      .boss-log-win { color: #22c55e; font-weight: bold; }
      .boss-log-lose { color: #ef4444; font-weight: bold; }
      .boss-log-crit { color: #f6ad55; font-weight: bold; }
      .boss-log-skill { color: #9f7aea; }
      .boss-log-reward { color: #22c55e; }

      .boss-hp-bar { margin: 8px 0; }
      .boss-hp-label { font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 2px; }
      .boss-hp-track { height: 12px; background: #2d3748; border: 1px solid #000; overflow: hidden; border-radius: 2px; }
      .boss-hp-fill { height: 100%; transition: width 0.3s; }
      .boss-hp-fill.hp { background: #ef4444; }

      .empty-hint { text-align: center; color: #a0aec0; font-size: 12px; padding: 20px 0; }
    </style>
  `,

  bossList: [],
  selectedBoss: null,
  battleLogs: [],
  isFighting: false,

  async load() {
    if (typeof WS !== 'undefined' && WS.ensureConnected) {
      await WS.ensureConnected(3000);
    }
    await this.refreshBossList();
    this.render();
  },

  async refreshBossList() {
    const result = await API.get('/boss/list');
    this.bossList = (result.code === 0 && result.data) ? result.data : [];
  },

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="boss-container">
        <div class="boss-header">
          <h2>Boss 挑战</h2>
          <div class="boss-info-bar">Boss 血量全局共享，多人同时攻击，仅击杀者得奖励；死亡后 30 秒刷新</div>
        </div>
        <div class="boss-body">
          <div class="boss-list-panel">
            <h3>Boss 列表</h3>
            ${this._renderBossList()}
          </div>
          <div class="boss-detail-panel">
            ${this._renderBossDetail()}
            <div class="boss-battle-log">
              <h3>战斗日志</h3>
              <div id="bossLogContent">${this._getLogHTML()}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderBossList() {
    if (!this.bossList.length) {
      return '<div class="empty-hint">暂无可挑战的 Boss<br><span style="font-size:11px;color:#718096;">请在 GM 后台添加 Boss</span></div>';
    }
    return this.bossList.map(b => {
      const selected = this.selectedBoss?.id === b.id ? ' selected' : '';
      const statusText = b.can_fight
        ? `<span class="can-fight">可挑战 · HP ${b.current_hp}/${b.max_hp}</span>`
        : b.respawn_remain > 0
          ? `<span class="cannot-fight">${b.respawn_remain} 秒后刷新</span>`
          : `<span class="cannot-fight">已死亡</span>`;
      return `
        <div class="boss-card boss-type-normal${selected}" onclick="BossPage.selectBoss(${b.id})">
          <div class="boss-card-name">${b.name}</div>
          <div class="boss-card-info">Lv.${b.level} | 满血: ${b.max_hp}</div>
          <div class="boss-card-status">${statusText}</div>
        </div>
      `;
    }).join('');
  },

  _renderBossDetail() {
    const b = this.selectedBoss;
    if (!b) {
      return '<div class="boss-stats"><div class="empty-hint">请从左侧选择一个 Boss</div></div>';
    }

    const stats = [
      ['等级', b.level], ['生命', b.max_hp || b.hp], ['物攻', b.phy_atk], ['魔攻', b.mag_atk],
      ['物防', b.phy_def], ['魔防', b.mag_def], ['命中', (b.hit_rate || 0) + '%'], ['闪避', (b.dodge_rate || 0) + '%'],
      ['暴击', (b.crit_rate || 0) + '%'], ['经验', b.exp], ['金币', b.gold], ['声望', b.reputation],
    ];

    const curHp = b.current_hp ?? b.hp ?? 0;
    const maxHp = b.max_hp ?? b.hp ?? 1;
    const hpPct = maxHp > 0 ? Math.min(100, (curHp / maxHp) * 100) : 0;
    const canFight = b.can_fight && !this.isFighting;

    return `
      <div class="boss-stats">
        <h3>${b.name} 详情</h3>
        <div class="boss-hp-bar">
          <div class="boss-hp-label"><span>Boss HP（全局共享）</span><span id="bossHpText">${curHp} / ${maxHp}</span></div>
          <div class="boss-hp-track"><div class="boss-hp-fill hp" id="bossHpBar" style="width:${hpPct}%"></div></div>
        </div>
        <div class="boss-stats-grid">
          ${stats.map(([k, v]) => `<div class="boss-stat-item"><span>${k}</span><span>${v}</span></div>`).join('')}
        </div>
        <div class="boss-actions" style="margin-top:10px;">
          <button class="boss-challenge-btn" id="bossChallengeBtn" ${canFight ? '' : 'disabled'}
            onclick="BossPage.onChallenge()">
            ${this.isFighting ? '战斗中...' : '发起挑战'}
          </button>
        </div>
      </div>
    `;
  },

  _getLogHTML() {
    if (!this.battleLogs.length) return '<div class="empty-hint">暂无战斗记录</div>';
    return this.battleLogs.map(ev => this._buildLogItem(ev)).join('');
  },

  _buildLogItem(ev) {
    let cls = 'boss-log-item';
    let content = ev.message || '';
    switch (ev.event) {
      case 'battle_start': cls += ' boss-log-round'; break;
      case 'round_start': cls += ' boss-log-round'; break;
      case 'player_phy_attack':
      case 'player_mag_attack': cls += ev.is_crit ? ' boss-log-crit' : ' boss-log-player'; break;
      case 'player_skill_attack': cls += ' boss-log-skill'; break;
      case 'monster_phy_attack':
      case 'monster_mag_attack': cls += ev.is_crit ? ' boss-log-crit' : ' boss-log-monster'; break;
      case 'battle_win': cls += ' boss-log-win'; break;
      case 'battle_lose':
      case 'battle_draw': cls += ' boss-log-lose'; break;
      case 'battle_reward':
        cls += ' boss-log-reward';
        content = this._buildRewardHTML(ev);
        break;
    }
    return `<div class="${cls}">${content}</div>`;
  },

  _buildRewardHTML(ev) {
    const lines = ['Boss 奖励结算'];
    if (ev.exp > 0) lines.push(`经验 +${ev.exp}`);
    if (ev.gold > 0) lines.push(`金币 +${ev.gold}`);
    if (ev.reputation > 0) lines.push(`声望 +${ev.reputation}`);
    if (ev.items?.length) ev.items.forEach(it => lines.push(`${it.name || '未知'} ×${it.count || 1}`));
    return lines.map((t, i) => `<div class="boss-log-item ${i === 0 ? 'boss-log-round' : 'boss-log-win'}">${t}</div>`).join('');
  },

  selectBoss(id) {
    this.selectedBoss = this.bossList.find(b => b.id === id) || null;
    this.battleLogs = [];
    this.render();
  },

  async onChallenge() {
    if (!this.selectedBoss || this.isFighting) return;
    this.isFighting = true;
    this.battleLogs = [];
    this.render();

    const result = await API.post('/boss/challenge', { boss_id: this.selectedBoss.id });
    if (result.code !== 0) {
      UI.showToast(result.msg || '挑战失败');
    }

    this.isFighting = false;
    await this.refreshBossList();
    if (this.selectedBoss) {
      this.selectedBoss = this.bossList.find(b => b.id === this.selectedBoss.id) || this.selectedBoss;
    }
    this.render();
    this._syncLogDOM();
  },

  handleBattleEvent(eventData) {
    this._handleSingle(eventData);
    this._syncLogDOM();
  },

  handleBattleEventBatch(events) {
    for (const ev of events) this._handleSingle(ev);
    this._syncLogDOM();
  },

  _handleSingle(ev) {
    if (!ev || ev.batch === true || !ev.event) return;
    this.battleLogs.push(ev);

    if (ev.monster_hp !== undefined) {
      const hpText = document.getElementById('bossHpText');
      const hpBar = document.getElementById('bossHpBar');
      if (hpText) hpText.textContent = `${ev.monster_hp} / ${ev.monster_max_hp || this.selectedBoss?.hp || 1}`;
      if (hpBar) hpBar.style.width = `${Math.min(100, (ev.monster_hp / (ev.monster_max_hp || 1)) * 100)}%`;
    }
  },

  _syncLogDOM() {
    const el = document.getElementById('bossLogContent');
    if (!el) return;
    el.innerHTML = this._getLogHTML();
    el.scrollTop = el.scrollHeight;
  },
};

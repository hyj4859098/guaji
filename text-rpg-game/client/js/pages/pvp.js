/**
 * PVP 竞技场页面
 * 三个 Tab：对手列表、排行榜、战斗记录
 */
const PvpPage = {
  style: `
    <style>
      .pvp-container { max-width: 960px; margin: 0 auto; padding: 10px 15px; }

      .pvp-header { text-align: center; margin-bottom: 12px; color: #e2e8f0; }
      .pvp-header h2 { color: #9f7aea; margin: 0 0 4px; font-size: 18px; }
      .pvp-header .pvp-info-bar { font-size: 12px; color: #a0aec0; }
      .pvp-my-info {
        display: flex; gap: 16px; justify-content: center; margin-top: 6px;
        font-size: 12px; color: #e2e8f0; flex-wrap: wrap;
      }
      .pvp-my-info span { background: #2d3748; padding: 3px 10px; border-radius: 4px; }

      .pvp-tabs {
        display: flex; gap: 4px; margin-bottom: 10px; justify-content: center;
      }
      .pvp-tab {
        padding: 6px 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
        background: transparent; color: #a0aec0; font-size: 12px; cursor: pointer; transition: all 0.2s;
      }
      .pvp-tab.active { background: #9f7aea; color: white; border-color: #9f7aea; }

      .pvp-body { display: flex; gap: 10px; align-items: flex-start; }
      .pvp-left {
        width: 340px; flex-shrink: 0;
        background: #1a202c; border-radius: 6px; padding: 10px;
        border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0;
        max-height: 65vh; overflow-y: auto;
      }
      .pvp-right {
        flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
      }

      .pvp-opponent-card {
        background: #2d3748; border-radius: 6px; padding: 8px 10px;
        margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;
        border: 1px solid transparent; transition: all 0.2s;
      }
      .pvp-opponent-card:hover { border-color: #9f7aea; }
      .pvp-opp-info { flex: 1; }
      .pvp-opp-name { font-size: 13px; font-weight: bold; color: #9f7aea; }
      .pvp-opp-stats { font-size: 11px; color: #a0aec0; margin-top: 2px; }
      .pvp-fight-btn {
        padding: 5px 14px; border: none; border-radius: 4px;
        background: #9f7aea; color: white; font-size: 12px; font-weight: bold;
        cursor: pointer; transition: all 0.2s; flex-shrink: 0;
      }
      .pvp-fight-btn:hover { background: #805ad5; }
      .pvp-fight-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .pvp-rank-table {
        width: 100%; border-collapse: collapse; font-size: 12px; color: #e2e8f0;
      }
      .pvp-rank-table th {
        text-align: left; padding: 6px 8px; color: #9f7aea;
        border-bottom: 1px solid rgba(159,122,234,0.3);
      }
      .pvp-rank-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .pvp-rank-1 td { color: #fbbf24; font-weight: bold; }
      .pvp-rank-2 td { color: #a0aec0; font-weight: bold; }
      .pvp-rank-3 td { color: #ed8936; font-weight: bold; }

      .pvp-record-item {
        background: #2d3748; border-radius: 4px; padding: 6px 10px;
        margin-bottom: 4px; font-size: 12px; color: #e2e8f0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .pvp-record-win { border-left: 3px solid #48bb78; }
      .pvp-record-lose { border-left: 3px solid #f56565; }

      .pvp-battle-log {
        background: #16213e; min-height: 200px; max-height: 50vh;
        border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
        padding: 10px; overflow-y: auto;
      }
      .pvp-battle-log h3 {
        margin: 0 0 8px; color: #9f7aea; font-size: 13px;
        border-bottom: 1px solid rgba(159,122,234,0.2); padding-bottom: 5px;
      }
      .pvp-log-item { padding: 1px 2px; font-size: 12px; color: #e2e8f0; }
      .pvp-log-round { color: #3b82f6; font-weight: bold; text-align: center; }
      .pvp-log-player { color: #fbbf24; }
      .pvp-log-monster { color: #f43f5e; }
      .pvp-log-win { color: #22c55e; font-weight: bold; }
      .pvp-log-lose { color: #ef4444; font-weight: bold; }
      .pvp-log-crit { color: #f6ad55; font-weight: bold; }

      .empty-hint { text-align: center; color: #a0aec0; font-size: 12px; padding: 20px 0; }
    </style>
  `,

  currentTab: 'opponents',
  opponents: [],
  ranking: [],
  records: [],
  myInfo: null,
  battleLogs: [],
  isFighting: false,

  async load() {
    if (typeof WS !== 'undefined' && WS.ensureConnected) {
      await WS.ensureConnected(3000);
    }
    await Promise.all([
      this.refreshOpponents(),
      this.refreshMyInfo(),
    ]);
    this.render();
  },

  async refreshOpponents() {
    const r = await API.get('/pvp/opponents');
    this.opponents = (r.code === 0 && r.data) ? r.data : [];
  },

  async refreshMyInfo() {
    const r = await API.get('/pvp/info');
    this.myInfo = (r.code === 0 && r.data) ? r.data : null;
  },

  async refreshRanking() {
    const r = await API.get('/pvp/ranking');
    this.ranking = (r.code === 0 && r.data) ? r.data : [];
  },

  async refreshRecords() {
    const r = await API.get('/pvp/records');
    this.records = (r.code === 0 && r.data) ? r.data : [];
  },

  render() {
    const app = document.getElementById('app');
    const info = this.myInfo || {};
    app.innerHTML = `
      ${this.style}
      <div class="pvp-container">
        <div class="pvp-header">
          <h2>竞技场</h2>
          <div class="pvp-info-bar">挑战其他玩家，获得金币与声望</div>
          <div class="pvp-my-info">
            <span>今日挑战: ${info.attacks_used || 0}/${info.attacks_max || 10}</span>
            <span>胜: ${info.wins || 0} / 负: ${info.losses || 0}</span>
            <span>积分: ${info.score || 1000}</span>
            ${info.cooldown_remain > 0 ? `<span style="color:#f56565;">冷却: ${info.cooldown_remain}s</span>` : ''}
          </div>
        </div>
        <div class="pvp-tabs">
          <button class="pvp-tab ${this.currentTab === 'opponents' ? 'active' : ''}" onclick="PvpPage.switchTab('opponents')">对手列表</button>
          <button class="pvp-tab ${this.currentTab === 'ranking' ? 'active' : ''}" onclick="PvpPage.switchTab('ranking')">排行榜</button>
          <button class="pvp-tab ${this.currentTab === 'records' ? 'active' : ''}" onclick="PvpPage.switchTab('records')">战斗记录</button>
        </div>
        <div class="pvp-body">
          <div class="pvp-left" id="pvpLeftPanel">
            ${this._renderTab()}
          </div>
          <div class="pvp-right">
            <div class="pvp-battle-log">
              <h3>战斗日志</h3>
              <div id="pvpLogContent">${this._getLogHTML()}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderTab() {
    switch (this.currentTab) {
      case 'opponents': return this._renderOpponents();
      case 'ranking': return this._renderRanking();
      case 'records': return this._renderRecords();
      default: return '';
    }
  },

  _renderOpponents() {
    if (!this.opponents.length) return '<div class="empty-hint">暂无可挑战的对手</div>';
    const canFight = this.myInfo?.can_fight && !this.isFighting;
    return this.opponents.map(o => `
      <div class="pvp-opponent-card">
        <div class="pvp-opp-info">
          <div class="pvp-opp-name">${o.name}</div>
          <div class="pvp-opp-stats">Lv.${o.level} | HP: ${o.hp} | 物攻: ${o.phy_atk} | 魔攻: ${o.mag_atk}</div>
        </div>
        <button class="pvp-fight-btn" ${canFight ? '' : 'disabled'}
          onclick="PvpPage.onChallenge('${o.uid}')">
          ${this.isFighting ? '...' : '挑战'}
        </button>
      </div>
    `).join('');
  },

  _renderRanking() {
    if (!this.ranking.length) return '<div class="empty-hint">暂无排行数据</div>';
    const rows = this.ranking.map((r, i) => {
      const cls = i === 0 ? 'pvp-rank-1' : i === 1 ? 'pvp-rank-2' : i === 2 ? 'pvp-rank-3' : '';
      return `<tr class="${cls}">
        <td>${i + 1}</td><td>${r.name}</td><td>Lv.${r.level}</td>
        <td>${r.wins || 0}</td><td>${r.losses || 0}</td><td>${r.score || 0}</td>
      </tr>`;
    }).join('');
    return `
      <table class="pvp-rank-table">
        <thead><tr><th>#</th><th>玩家</th><th>等级</th><th>胜</th><th>负</th><th>积分</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  _renderRecords() {
    if (!this.records.length) return '<div class="empty-hint">暂无战斗记录</div>';
    const myUid = String(State.uid || '');
    return this.records.map(r => {
      const isAttacker = r.attacker_uid === myUid;
      const won = r.winner_uid === myUid;
      const opponent = isAttacker ? r.defender_name : r.attacker_name;
      const action = isAttacker ? '挑战' : '被挑战';
      const resultText = won ? '胜利' : '失败';
      const cls = won ? 'pvp-record-win' : 'pvp-record-lose';
      const time = r.create_time ? new Date(r.create_time * 1000).toLocaleString() : '';
      return `
        <div class="pvp-record-item ${cls}">
          <span>${action} ${opponent} - <b style="color:${won ? '#48bb78' : '#f56565'}">${resultText}</b> (${r.rounds || 0}回合)</span>
          <span style="font-size:11px;color:#718096;">${time}</span>
        </div>
      `;
    }).join('');
  },

  async switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'ranking') await this.refreshRanking();
    if (tab === 'records') await this.refreshRecords();
    this.render();
  },

  async onChallenge(targetUid) {
    if (this.isFighting) return;
    this.isFighting = true;
    this.battleLogs = [];
    this.render();

    const result = await API.post('/pvp/challenge', { target_uid: targetUid });
    if (result.code !== 0) {
      UI.showToast(result.msg || '挑战失败');
    }

    this.isFighting = false;
    await Promise.all([this.refreshOpponents(), this.refreshMyInfo()]);
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
  },

  _getLogHTML() {
    if (!this.battleLogs.length) return '<div class="empty-hint">暂无战斗记录</div>';
    return this.battleLogs.map(ev => this._buildLogItem(ev)).join('');
  },

  _buildLogItem(ev) {
    let cls = 'pvp-log-item';
    let content = ev.message || '';
    switch (ev.event) {
      case 'pvp_battle_start': cls += ' pvp-log-round'; break;
      case 'round_start': cls += ' pvp-log-round'; break;
      case 'player_phy_attack':
      case 'player_mag_attack': cls += ev.is_crit ? ' pvp-log-crit' : ' pvp-log-player'; break;
      case 'monster_phy_attack':
      case 'monster_mag_attack': cls += ev.is_crit ? ' pvp-log-crit' : ' pvp-log-monster'; break;
      case 'pvp_battle_win': cls += ' pvp-log-win'; break;
      case 'pvp_battle_lose': cls += ' pvp-log-lose'; break;
      case 'pvp_battle_draw': cls += ' pvp-log-lose'; break;
      case 'pvp_reward':
        cls += ' pvp-log-win';
        const lines = ['竞技场奖励'];
        if (ev.gold > 0) lines.push(`金币 +${ev.gold}`);
        if (ev.reputation > 0) lines.push(`声望 +${ev.reputation}`);
        if (ev.score_change) lines.push(`积分 ${ev.score_change > 0 ? '+' : ''}${ev.score_change}`);
        content = lines.map(t => `<div class="pvp-log-item pvp-log-win">${t}</div>`).join('');
        break;
    }
    return `<div class="${cls}">${content}</div>`;
  },

  _syncLogDOM() {
    const el = document.getElementById('pvpLogContent');
    if (!el) return;
    el.innerHTML = this._getLogHTML();
    el.scrollTop = el.scrollHeight;
  },
};

/**
 * 战斗页面 - 清晰分层、易维护
 *
 * 结构说明：
 * 1. 样式 (style)
 * 2. 状态 (player, enemy, skills, bagItems, battleState)
 * 3. 自动喝药 (load/save/get config)
 * 4. UI 同步 (syncPlayerHpMp, syncMonsterHpMp, syncLogDOM)
 * 5. 渲染 (render 及各子模块)
 * 6. 战斗逻辑 (start/stop/handleEvent)
 */
const BattlePage = {
  // ==================== 样式 ====================
  style: `
    <style>
      body { background: #0a1929; }
      #app { background: #0a1929; }

      .battle-container {
        max-width: 960px; margin: 0 auto; padding: 10px 15px; box-sizing: border-box;
      }

      .battle-top {
        display: flex; justify-content: center; align-items: center; gap: 12px;
        flex-wrap: wrap; margin-bottom: 10px;
      }
      .battle-top .control-btn { margin: 0; }
      .auto-heal-settings {
        display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        margin-bottom: 10px; color: #e2e8f0;
      }
      .heal-row { display: flex; gap: 5px; align-items: center; }
      .heal-row label { font-size: 12px; color: #e2e8f0; width: 32px; }
      .percent-select, .potion-select {
        padding: 3px 5px; background: #2d3748; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px; color: #e2e8f0; font-size: 11px;
      }
      .potion-select { min-width: 85px; }

      .battle-body {
        display: flex; gap: 10px; align-items: stretch;
      }
      .battle-col-left, .battle-col-right {
        width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;
      }
      .battle-col-center {
        flex: 1; min-width: 0; display: flex; flex-direction: column;
      }

      .battle-module {
        background: #1a202c; border-radius: 6px; padding: 10px;
        color: #e2e8f0; overflow-y: auto;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .battle-module h3 {
        margin: 0 0 8px 0; color: #4299e1; font-size: 13px;
        border-bottom: 1px solid rgba(66,153,225,0.2); padding-bottom: 5px;
      }

      .player-info { }
      .enemy-info { }
      .skills, .monster-skills { }
      .bonus-info.drop-panel { }
      .battle-log {
        background: #16213e; flex: 1;
        border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
        padding: 10px; overflow-y: auto;
      }

      .status-bar { margin-bottom: 5px; }
      .status-bar-label { font-size: 12px; margin-bottom: 2px; display: flex; justify-content: space-between; }
      .status-bar-track { height: 10px; background: #2d3748; border: 1px solid #000; overflow: hidden; }
      .status-bar-fill { height: 100%; transition: width 0.2s ease; }
      .status-bar-fill.hp { background: #ef4444; }
      .status-bar-fill.mp { background: #4299e1; }

      .stats-list { margin-top: 6px; }
      .stat-item {
        font-size: 12px; display: flex; justify-content: space-between;
        padding: 0; background: none; border: none; margin: 0;
      }

      .battle-log-item { padding: 1px 2px; font-size: 12px; color: #e2e8f0; }
      .battle-log-round { color: #3b82f6; font-weight: bold; text-align: center; }
      .battle-log-player { color: #fbbf24; }
      .battle-log-monster { color: #f43f5e; }
      .battle-log-win { color: #22c55e; font-weight: bold; }
      .battle-log-lose { color: #ef4444; font-weight: bold; }
      .battle-log-draw { color: #f59e0b; font-weight: bold; }
      .battle-log-skill { color: #9f7aea; }
      .battle-log-crit { color: #f6ad55; font-weight: bold; }

      .skill-item {
        margin-bottom: 4px; padding: 4px 6px; background: #2d3748; border-radius: 4px;
        border: 1px solid #4299e1; display: flex; justify-content: space-between; align-items: center;
      }
      .skill-item-name { font-size: 12px; font-weight: bold; color: #4299e1; }
      .skill-item-prob { font-size: 11px; color: #a0aec0; }
      .drop-item { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
      .empty-hint { text-align: center; color: #a0aec0; font-size: 12px; }

      .control-btn {
        padding: 6px 14px; border: none; border-radius: 4px; font-size: 12px; font-weight: bold;
        cursor: pointer; transition: background 0.3s ease;
      }
      .auto-battle-btn { background: #48bb78; color: white; }
      .auto-battle-btn:hover { background: #38a169; }
      .exit-btn { background: #f56565; color: white; }
      .exit-btn:hover { background: #e53e3e; }

      .character-header { display: flex; align-items: center; margin-bottom: 8px; }
      .character-avatar {
        width: 36px; height: 36px; background: #2d3748; border-radius: 50%; margin-right: 8px;
        display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: bold;
      }
      .character-info { flex: 1; }
      .character-name { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
      .character-level { font-size: 11px; color: #a0aec0; }
      .pvp-countdown { font-size: 16px; font-weight: bold; color: #fbbf24; }
    </style>
  `,

  // ==================== 状态 ====================
  player: null,
  enemy: null,
  skills: [],
  bagItems: [],
  isAutoBattling: false,
  currentBattleEnemyId: null,
  battleLogs: [],
  exitBattleTimer: null,

  isBossMode() {
    return !!State.getCurrentBossId();
  },

  isPvpMode() {
    return State.currentBattleMode === 'pvp' && !!State.currentPvpTargetUid;
  },

  // ==================== 自动喝药 ====================
  getAutoHealStorageKey() {
    return `auto_heal_${State.uid || 0}`;
  },

  loadAutoHealSettings() {
    try {
      const raw = localStorage.getItem(this.getAutoHealStorageKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        hp_enabled: data.hp_enabled !== false,
        hp_threshold: Math.min(90, Math.max(10, parseInt(data.hp_threshold, 10) || 50)),
        hp_potion_bag_id: data.hp_potion_bag_id ? parseInt(data.hp_potion_bag_id, 10) : null,
        mp_enabled: data.mp_enabled !== false,
        mp_threshold: Math.min(90, Math.max(10, parseInt(data.mp_threshold, 10) || 50)),
        mp_potion_bag_id: data.mp_potion_bag_id ? parseInt(data.mp_potion_bag_id, 10) : null
      };
    } catch (e) {
      return null;
    }
  },

  saveAutoHealSettings() {
    const data = {
      hp_enabled: document.getElementById('autoHealHp')?.checked ?? true,
      hp_threshold: parseInt(document.getElementById('hpThreshold')?.value || '50', 10),
      hp_potion_bag_id: document.getElementById('hpPotion')?.value || null,
      mp_enabled: document.getElementById('autoHealMp')?.checked ?? true,
      mp_threshold: parseInt(document.getElementById('mpThreshold')?.value || '50', 10),
      mp_potion_bag_id: document.getElementById('mpPotion')?.value || null
    };
    try {
      localStorage.setItem(this.getAutoHealStorageKey(), JSON.stringify(data));
    } catch (e) {}
  },

  getThresholdOptions(selected) {
    const s = selected != null ? parseInt(selected, 10) : 50;
    return [90, 80, 70, 60, 50, 40, 30, 20, 10]
      .map(p => `<option value="${p}"${p === s ? ' selected' : ''}>${p}%</option>`)
      .join('');
  },

  /** 唯一入口：生成药水下拉选项 HTML（render 与 updateBagPotions 共用） */
  buildPotionOptions(type, items, saved) {
    const isHp = type === 'hp';
    const potions = items.filter(i => (isHp ? (i.hp_restore || 0) : (i.mp_restore || 0)) > 0);
    const savedId = isHp ? saved?.hp_potion_bag_id : saved?.mp_potion_bag_id;
    const options = potions.map(i => {
      const vid = i.original_id || i.id;
      const sel = savedId != null && String(vid) === String(savedId) ? ' selected' : '';
      return `<option value="${vid}"${sel}>${i.name || '未知'} ×${i.count || 1}</option>`;
    });
    return '<option value="">不选择</option>' + options.join('');
  },

  getAutoHealConfig() {
    const hpEnabled = document.getElementById('autoHealHp')?.checked ?? true;
    const mpEnabled = document.getElementById('autoHealMp')?.checked ?? true;
    const hpThreshold = parseInt(document.getElementById('hpThreshold')?.value || '50', 10);
    const mpThreshold = parseInt(document.getElementById('mpThreshold')?.value || '50', 10);
    const hpPotionId = document.getElementById('hpPotion')?.value;
    const mpPotionId = document.getElementById('mpPotion')?.value;
    return {
      hp_enabled: hpEnabled && !!hpPotionId,
      hp_threshold: hpThreshold,
      hp_potion_bag_id: hpPotionId ? parseInt(hpPotionId, 10) : undefined,
      mp_enabled: mpEnabled && !!mpPotionId,
      mp_threshold: mpThreshold,
      mp_potion_bag_id: mpPotionId ? parseInt(mpPotionId, 10) : undefined
    };
  },

  // ==================== UI 同步 ====================
  syncMonsterHpMp(hp, maxHp, mp, maxMp) {
    const h = hp !== undefined ? hp : (this.enemy?.hp ?? 0);
    const mH = maxHp !== undefined ? maxHp : (this.enemy?.hp || 1);
    const p = mp !== undefined ? mp : (this.enemy?.mp ?? 0);
    const mM = maxMp !== undefined ? maxMp : (this.enemy?.mp || 1);
    const hpText = document.getElementById('monsterHpText');
    const mpText = document.getElementById('monsterMpText');
    const hpBar = document.getElementById('monsterHpBar');
    const mpBar = document.getElementById('monsterMpBar');
    if (hpText) hpText.textContent = `${h} / ${mH}`;
    if (mpText) mpText.textContent = `${p} / ${mM}`;
    if (hpBar) hpBar.style.width = `${Math.min(100, (h / mH) * 100)}%`;
    if (mpBar) mpBar.style.width = `${Math.min(100, (p / mM) * 100)}%`;
  },

  syncPlayerHpMp(hp, maxHp, mp, maxMp) {
    const h = hp !== undefined ? hp : (this.player?.hp ?? 0);
    const mH = maxHp !== undefined ? maxHp : (this.player?.max_hp || 1);
    const p = mp !== undefined ? mp : (this.player?.mp ?? 0);
    const mM = maxMp !== undefined ? maxMp : (this.player?.max_mp || 1);
    const hpText = document.getElementById('playerHpText');
    const mpText = document.getElementById('playerMpText');
    const hpBar = document.getElementById('playerHpBar');
    const mpBar = document.getElementById('playerMpBar');
    if (hpText) hpText.textContent = `${h} / ${mH}`;
    if (mpText) mpText.textContent = `${p} / ${mM}`;
    if (hpBar) hpBar.style.width = `${Math.min(100, (h / mH) * 100)}%`;
    if (mpBar) mpBar.style.width = `${Math.min(100, (p / mM) * 100)}%`;
    if (this.player) {
      this.player.hp = h;
      this.player.mp = p;
    }
  },

  /** 统一设置战斗按钮启用/禁用（与导航栏同步：战斗中禁用，未战斗启用） */
  setBattleButtonsEnabled(enabled) {
    ['.start-battle-btn', '.auto-battle-btn'].forEach(sel => {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.6';
      }
    });
    if (typeof setNavDisabledByBattle === 'function') setNavDisabledByBattle(!enabled);
  },

  updatePlayerInfo(data) {
    if (!data) return;
    this.player = data;
    const nameEl = document.querySelector('.player-info .character-name');
    const levelEl = document.querySelector('.player-info .character-level');
    if (nameEl) nameEl.textContent = data.name || '默认角色';
    if (levelEl) levelEl.textContent = `Lv.${data.level || 1}`;
    this.syncPlayerHpMp(data.hp, data.max_hp || data.hp, data.mp, data.max_mp || data.mp);
  },

  updateBagPotions(bagPayload) {
    const payload = BagService.parseBagPayload(bagPayload);
    this.bagItems = payload.items.filter(i => (i.hp_restore || 0) > 0 || (i.mp_restore || 0) > 0);
    const saved = this.loadAutoHealSettings();
    const hpSelect = document.getElementById('hpPotion');
    const mpSelect = document.getElementById('mpPotion');
    if (hpSelect) {
      hpSelect.innerHTML = this.buildPotionOptions('hp', this.bagItems, saved);
      const prefer = saved?.hp_potion_bag_id;
      if (prefer && [...hpSelect.options].some(o => o.value === String(prefer))) {
        hpSelect.value = String(prefer);
      }
    }
    if (mpSelect) {
      mpSelect.innerHTML = this.buildPotionOptions('mp', this.bagItems, saved);
      const prefer = saved?.mp_potion_bag_id;
      if (prefer && [...mpSelect.options].some(o => o.value === String(prefer))) {
        mpSelect.value = String(prefer);
      }
    }
  },

  // ==================== 日志与奖励 ====================
  buildLogItemHTML(eventData) {
    let className = 'battle-log-item';
    let content = eventData.message || '';
    switch (eventData.event) {
      case 'battle_start': className += ' battle-log-start'; break;
      case 'round_start': className += ' battle-log-round'; break;
      case 'player_phy_attack':
      case 'player_mag_attack': className += eventData.is_crit ? ' battle-log-crit' : ' battle-log-player'; break;
      case 'player_skill_attack': className += ' battle-log-skill'; break;
      case 'monster_phy_attack':
      case 'monster_mag_attack':
      case 'monster_skill_attack': className += eventData.is_crit ? ' battle-log-crit' : ' battle-log-monster'; break;
      case 'battle_win': className += ' battle-log-win'; break;
      case 'battle_lose': className += ' battle-log-lose'; break;
      case 'battle_draw': className += ' battle-log-draw'; break;
      case 'auto_heal': break;
      case 'battle_reward':
        className += ' battle-log-win';
        content = this.buildRewardHTML({ exp: eventData.exp, gold: eventData.gold, reputation: eventData.reputation, items: eventData.items || [] });
        break;
    }
    return `<div class="${className}">${content}</div>`;
  },

  getLogHTML(events) {
    if (!events?.length) return '<div class="empty-hint">暂无战斗记录</div>';
    return events.map(ev => this.buildLogItemHTML(ev)).join('');
  },

  syncLogDOM() {
    const log = document.getElementById('battleLogContent');
    if (!log) return;
    log.innerHTML = this.getLogHTML(this.battleLogs || []);
    log.scrollTop = log.scrollHeight;
  },

  /** 奖励结算：与战斗日志同风格，单行描述句 */
  buildRewardHTML(reward) {
    if (!reward) return '<div class="battle-log-item battle-log-win">无奖励</div>';
    const lines = ['战斗奖励结算'];
    const b = reward.boost || {};
    const boostTag = (val) => val > 1 ? ` (×${val})` : '';
    if (reward.exp > 0) lines.push(`你获得了 经验 +${reward.exp}${boostTag(b.exp)}`);
    if (reward.gold > 0) lines.push(`你获得了 金币 +${reward.gold}${boostTag(b.gold)}`);
    if (reward.reputation > 0) lines.push(`你获得了 声望 +${reward.reputation}${boostTag(b.reputation)}`);
    if (reward.items?.length) {
      reward.items.forEach(it => {
        lines.push(`你获得了 ${it.name || '未知'} ×${it.count || 1}`);
      });
    }
    if (lines.length === 1) return '<div class="battle-log-item battle-log-round">战斗奖励结算</div><div class="battle-log-item battle-log-win">无额外奖励</div>';
    return lines.map((text, i) => {
      const cls = i === 0 ? 'battle-log-round' : 'battle-log-win';
      return `<div class="battle-log-item ${cls}">${text}</div>`;
    }).join('');
  },

  // ==================== 渲染子模块 ====================
  _renderButtons() {
    if (this.isPvpMode()) return '<div class="battle-top"><span class="pvp-countdown" id="pvpCountdown">战斗即将开始 3...</span></div>';
    const showAuto = !this.isBossMode();
    return `
      <div class="battle-top">
        <button class="control-btn start-battle-btn" onclick="BattlePage.onStartBattle()">开始战斗</button>
        ${showAuto ? '<button class="control-btn auto-battle-btn" onclick="BattlePage.onStartAutoBattle()">自动战斗</button>' : ''}
        <button class="control-btn exit-btn" onclick="BattlePage.onStopBattle()">停止战斗</button>
      </div>
    `;
  },

  _renderAutoHeal(saved) {
    return `
      <div class="auto-heal-settings">
        <div class="heal-row">
          <input type="checkbox" id="autoHealHp" ${saved?.hp_enabled !== false ? 'checked' : ''}>
          <label>补血</label>
          <select class="percent-select" id="hpThreshold">${this.getThresholdOptions(saved?.hp_threshold)}</select>
          <select class="potion-select" id="hpPotion">${this.buildPotionOptions('hp', this.bagItems, saved)}</select>
        </div>
        <div class="heal-row">
          <input type="checkbox" id="autoHealMp" ${saved?.mp_enabled !== false ? 'checked' : ''}>
          <label>补蓝</label>
          <select class="percent-select" id="mpThreshold">${this.getThresholdOptions(saved?.mp_threshold)}</select>
          <select class="potion-select" id="mpPotion">${this.buildPotionOptions('mp', this.bagItems, saved)}</select>
        </div>
      </div>
    `;
  },

  _renderPlayerInfo() {
    const p = this.player;
    const hpPct = Math.min(100, ((p?.hp || 0) / (p?.max_hp || 1)) * 100);
    const mpPct = Math.min(100, ((p?.mp || 0) / (p?.max_mp || 1)) * 100);
    const elemStats = [p?.elem_metal, p?.elem_wood, p?.elem_water, p?.elem_fire, p?.elem_earth].some(v => v > 0);
    const stats = [
      ['物理攻击', p?.phy_atk], ['魔法攻击', p?.mag_atk], ['物理防御', p?.phy_def], ['魔法防御', p?.mag_def],
      ['命中', (p?.hit_rate || 0) + '%'], ['闪避', (p?.dodge_rate || 0) + '%'], ['暴击', (p?.crit_rate || 0) + '%'],
      ...(elemStats ? [['金', p?.elem_metal || 0], ['木', p?.elem_wood || 0], ['水', p?.elem_water || 0], ['火', p?.elem_fire || 0], ['土', p?.elem_earth || 0]] : [])
    ];
    return `
      <div class="player-info battle-module">
        <h3>人物信息</h3>
        <div class="character-header">
          <div class="character-avatar">${p?.name?.charAt(0) || '玩'}</div>
          <div class="character-info">
            <div class="character-name">${p?.name || '默认角色'}</div>
            <div class="character-level">Lv.${p?.level || 1}</div>
          </div>
        </div>
        <div class="status-bar">
          <div class="status-bar-label"><span>HP</span><span id="playerHpText">${p?.hp ?? 0} / ${p?.max_hp ?? 0}</span></div>
          <div class="status-bar-track"><div class="status-bar-fill hp" id="playerHpBar" style="width:${hpPct}%"></div></div>
        </div>
        <div class="status-bar">
          <div class="status-bar-label"><span>MP</span><span id="playerMpText">${p?.mp ?? 0} / ${p?.max_mp ?? 0}</span></div>
          <div class="status-bar-track"><div class="status-bar-fill mp" id="playerMpBar" style="width:${mpPct}%"></div></div>
        </div>
        <div class="stats-list">${stats.map(([k, v]) => `<div class="stat-item"><span>${k}</span><span>${v ?? 0}</span></div>`).join('')}</div>
      </div>
    `;
  },

  _renderSkills() {
    if (!this.skills.length) {
      return `<div class="skills battle-module"><h3>技能</h3><div class="empty-hint">暂无已装备技能</div></div>`;
    }
    const vipExpire = this.player?.vip_expire_time || 0;
    const isVip = vipExpire > 0 && vipExpire > Math.floor(Date.now() / 1000);
    const vipSkillBonus = isVip ? 20 : 0;
    const phyBonus = (this.player?.phy_skill_prob || 0) + vipSkillBonus;
    const magBonus = (this.player?.mag_skill_prob || 0) + vipSkillBonus;
    const items = this.skills.map(s => {
      const bonus = s.type === 0 ? phyBonus : magBonus;
      const totalProb = s.probability + bonus;
      return `<div class="skill-item"><span class="skill-item-name">${s.name}</span><span class="skill-item-prob">概率: ${totalProb}%</span></div>`;
    }).join('');
    return `<div class="skills battle-module"><h3>技能</h3><div class="skills-list">${items}</div></div>`;
  },

  _renderBattleLog() {
    return `
      <div class="battle-log">
        <h3 style="margin:0 0 8px 0;color:#4299e1;font-size:13px;border-bottom:1px solid rgba(66,153,225,0.2);padding-bottom:5px;">战斗日志</h3>
        <div id="battleLogContent">${this.getLogHTML(this.battleLogs || [])}</div>
      </div>
    `;
  },

  _renderEnemyInfo() {
    const e = this.enemy;
    const mHp = e?.hp ?? 0;
    const maxHp = e?.max_hp ?? e?.hp ?? 1;
    const mMp = e?.mp ?? 0;
    const maxMp = e?.max_mp ?? e?.mp ?? 1;
    const hpPct = maxHp > 0 ? Math.min(100, (mHp / maxHp) * 100) : 0;
    const mpPct = maxMp > 0 ? Math.min(100, (mMp / maxMp) * 100) : 0;
    const baseStats = [
      ['物理攻击', e?.phy_atk], ['魔法攻击', e?.mag_atk], ['物理防御', e?.phy_def], ['魔法防御', e?.mag_def],
      ['命中', (e?.hit_rate || 0) + '%'], ['闪避', (e?.dodge_rate || 0) + '%'], ['暴击', (e?.crit_rate || 0) + '%'],
    ];
    const stats = this.isPvpMode() ? baseStats : [...baseStats, ['经验', e?.exp], ['金币', e?.gold], ['声望', e?.reputation]];
    const title = this.isPvpMode() ? '对手信息' : (this.isBossMode() ? 'Boss 信息' : '怪物信息');
    return `
      <div class="enemy-info battle-module">
        <h3>${title}</h3>
        <div class="character-header">
          <div class="character-avatar">${e?.name?.charAt(0) || '怪'}</div>
          <div class="character-info">
            <div class="character-name">${e?.name || '未知怪物'}</div>
            <div class="character-level">Lv.${e?.level || 1}</div>
          </div>
        </div>
        <div class="status-bar">
          <div class="status-bar-label"><span>HP</span><span id="monsterHpText">${mHp} / ${maxHp}</span></div>
          <div class="status-bar-track"><div class="status-bar-fill hp" id="monsterHpBar" style="width:${hpPct}%"></div></div>
        </div>
        <div class="status-bar">
          <div class="status-bar-label"><span>MP</span><span id="monsterMpText">${mMp} / ${maxMp}</span></div>
          <div class="status-bar-track"><div class="status-bar-fill mp" id="monsterMpBar" style="width:${mpPct}%"></div></div>
        </div>
        <div class="stats-list">${stats.map(([k, v]) => `<div class="stat-item"><span>${k}</span><span>${v ?? 0}</span></div>`).join('')}</div>
      </div>
    `;
  },

  _renderElementCompare() {
    const p = this.player;
    const e = this.enemy;
    const elems = ['metal', 'wood', 'water', 'fire', 'earth'];
    const labels = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
    const pVals = elems.map(k => p?.[`elem_${k}`] || 0);
    const eVals = elems.map(k => e?.[`elem_${k}`] || 0);
    const header = elems.map(k => `<th style="padding:2px 8px;color:#fbbf24;">${labels[k]}</th>`).join('');
    const pRow = pVals.map(v => `<td style="padding:2px 8px;text-align:center;">${v}</td>`).join('');
    const eRow = eVals.map(v => `<td style="padding:2px 8px;text-align:center;">${v}</td>`).join('');
    return `
      <div class="battle-module" style="margin-top:8px;padding:8px 12px;">
        <table style="width:100%;font-size:12px;color:#e2e8f0;border-collapse:collapse;">
          <tr><th style="text-align:left;padding:2px 8px;color:#a0aec0;">五行</th>${header}</tr>
          <tr style="background:rgba(66,153,225,0.1);"><td style="padding:2px 8px;color:#63b3ed;font-weight:bold;">${p?.name || '你'}</td>${pRow}</tr>
          <tr style="background:rgba(245,101,101,0.1);"><td style="padding:2px 8px;color:#fc8181;font-weight:bold;">${e?.name || '怪物'}</td>${eRow}</tr>
        </table>
      </div>`;
  },

  _renderDrops() {
    if (this.isPvpMode()) return '';
    const drops = this.enemy?.drops;
    const content = drops?.length
      ? drops.map(d => `<div class="drop-item stat-item"><span>${d.item_name || '未知'}</span><span>×${d.quantity ?? 1} ${d.probability != null ? d.probability + '%' : ''}</span></div>`).join('')
      : '<div class="empty-hint">暂无掉落信息</div>';
    return `<div class="bonus-info drop-panel battle-module"><h3>掉落信息</h3><div class="stats-list" id="dropInfo">${content}</div></div>`;
  },

  _renderEnemySkills() {
    if (this.isPvpMode()) {
      const skills = this.enemy?.skills || [];
      const title = '对手技能';
      if (!skills.length) return `<div class="monster-skills battle-module"><h3>${title}</h3><div class="empty-hint">暂无已装备技能</div></div>`;
      const items = skills.map(s => `<div class="skill-item"><span class="skill-item-name">${s.name || '未知'}</span><span class="skill-item-prob">概率: ${s.probability ?? 0}%</span></div>`).join('');
      return `<div class="monster-skills battle-module"><h3>${title}</h3><div class="skills-list">${items}</div></div>`;
    }
    return `<div class="monster-skills battle-module"><h3>怪物技能</h3><div class="empty-hint">暂无技能信息</div></div>`;
  },

  render() {
    const saved = this.loadAutoHealSettings();
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="battle-container">
        ${this._renderButtons()}
        ${!this.isPvpMode() ? this._renderAutoHeal(saved) : ''}
        <div class="battle-body">
          <div class="battle-col-left">
            ${this._renderPlayerInfo()}
            ${this._renderSkills()}
          </div>
          <div class="battle-col-center">
            ${this._renderBattleLog()}
            ${this._renderElementCompare()}
          </div>
          <div class="battle-col-right">
            ${this._renderEnemyInfo()}
            ${this._renderEnemySkills()}
            ${this._renderDrops()}
          </div>
        </div>
      </div>
    `;
    this._bindAutoHealSave();
  },

  _bindAutoHealSave() {
    const save = () => this.saveAutoHealSettings();
    ['autoHealHp', 'autoHealMp', 'hpThreshold', 'hpPotion', 'mpThreshold', 'mpPotion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', save);
    });
  },

  // ==================== 加载 ====================
  async load() {
    this.battleLogs = [];
    if (typeof WS !== 'undefined' && WS.ensureConnected) {
      const ok = await WS.ensureConnected(3000);
      if (!ok) console.warn('[battle] WebSocket 未能在 3 秒内连接，奖励可能无法实时显示');
    }
    const bagResult = await BagService.fetchList();
    const bagPayload = (bagResult.code === 0 && bagResult.data) ? bagResult.data : { items: [] };
    this.bagItems = bagPayload.items.filter(i => (i.hp_restore || 0) > 0 || (i.mp_restore || 0) > 0);
    const playerResult = await API.get('/player/list');
    if (playerResult.code === 0 && playerResult.data?.length) this.player = playerResult.data[0];
    const equippedResult = await API.get('/skill/equipped');
    if (equippedResult.code === 0 && equippedResult.data) {
      const { physical = [], magic = [] } = equippedResult.data;
      this.skills = [...physical, ...magic].filter(s => s?.name != null);
    } else {
      this.skills = [];
    }
    const bossId = State.getCurrentBossId();
    const enemyId = State.getCurrentEnemyId();
    if (this.isPvpMode()) {
      const targetUid = State.currentPvpTargetUid;
      const info = State.currentPvpTargetInfo;
      this.enemy = info ? { name: info.name, level: info.level, hp: 0, max_hp: 0, mp: 0 } : { name: '对手', level: 1, hp: 0, max_hp: 0, mp: 0 };
      if (targetUid) {
        try {
          const oppRes = await API.get(`/pvp/opponent?uid=${encodeURIComponent(targetUid)}`);
          if (oppRes.code === 0 && oppRes.data) this.enemy = oppRes.data;
        } catch (e) { console.warn('[battle] 获取对手信息失败', e); }
      }
    } else if (bossId) {
      const bossResult = await API.get(`/boss/get?id=${bossId}`);
      if (bossResult.code === 0) this.enemy = bossResult.data;
    } else if (enemyId) {
      const enemyResult = await API.get(`/monster/get?id=${enemyId}`);
      if (enemyResult.code === 0) this.enemy = enemyResult.data;
    }
    if (!this.isBossMode() && !this.isPvpMode()) await this._updateBattleStatus();
    this.render();
    if (this.isPvpMode()) this._startPvpCountdown();
  },

  // ==================== 战斗逻辑 ====================

  async startBattle(enemyId) {
    if (!enemyId) return;
    if (typeof WS !== 'undefined' && WS.ensureConnected && !WS.isConnected()) {
      await WS.ensureConnected(2000);
    }
    this.battleLogs = [];
    this.setBattleButtonsEnabled(false);
    const log = document.getElementById('battleLogContent');
    if (log) log.innerHTML = '<div class="empty-hint">战斗开始...</div>';

    const autoHeal = this.getAutoHealConfig();
    const result = await API.post('/battle/start', { enemy_id: enemyId, auto_heal: autoHeal });

    this.setBattleButtonsEnabled(true);
    if (result.code !== 0) {
      UI.showToast(result.msg || '战斗失败');
    }
  },

  async startBossBattle(bossId) {
    if (!bossId) return;
    if (typeof WS !== 'undefined' && WS.ensureConnected && !WS.isConnected()) {
      await WS.ensureConnected(2000);
    }
    this.battleLogs = [];
    this.setBattleButtonsEnabled(false);
    const log = document.getElementById('battleLogContent');
    if (log) log.innerHTML = '<div class="empty-hint">Boss 战斗开始...</div>';

    const autoHeal = this.getAutoHealConfig();
    const result = await API.post('/boss/challenge', { boss_id: bossId, auto_heal: autoHeal });

    this.setBattleButtonsEnabled(true);
    if (result.code !== 0) {
      UI.showToast(result.msg || 'Boss 挑战失败');
    }
  },

  async startAutoBattle(enemyId) {
    if (!enemyId) return;
    if (typeof WS !== 'undefined' && WS.ensureConnected && !WS.isConnected()) {
      await WS.ensureConnected(2000);
    }
    this.isAutoBattling = true;
    this.currentBattleEnemyId = enemyId;
    this.battleLogs = [];
    this.setBattleButtonsEnabled(false);
    const log = document.getElementById('battleLogContent');
    if (log) log.innerHTML = '<div class="empty-hint">自动战斗开始...</div>';

    const autoHeal = this.getAutoHealConfig();
    const result = await API.post('/battle/auto', { enemy_id: enemyId, auto_heal: autoHeal });

    if (result.code !== 0) {
      this.isAutoBattling = false;
      this.setBattleButtonsEnabled(true);
      UI.showToast(result.msg || '自动战斗启动失败');
    }
  },

  async stopBattle() {
    const api = this.isBossMode() ? '/boss/stop' : '/battle/stop';
    const result = await API.post(api, {});
    if (result.code === 0) UI.showToast('战斗已停止');
  },

  resetBattleState(forceReset = false) {
    if (this.isAutoBattling && !forceReset) return;
    this.isAutoBattling = false;
    this.currentBattleEnemyId = null;
    this.setBattleButtonsEnabled(true);
  },

  _scheduleExitBattle(delayMs) {
    if (this.exitBattleTimer) return;
    this.exitBattleTimer = setTimeout(() => {
      this.exitBattleTimer = null;
      if (State.currentPage !== 'battle') return;
      if (this.isPvpMode()) {
        const redirect = State._pvpRedirect || 'boss-list';
        State._pvpRedirect = null;
        navigateTo(redirect === 'map' ? 'map' : 'boss-list');
      } else if (this.isBossMode()) {
        navigateTo('boss-list');
      } else {
        navigateTo('enemy-list');
      }
    }, delayMs);
  },

  _startPvpCountdown() {
    let n = 3;
    const el = document.getElementById('pvpCountdown');
    if (!el) return;
    const t = setInterval(() => {
      n--;
      if (n > 0) el.textContent = `战斗即将开始 ${n}...`;
      else {
        clearInterval(t);
        el.textContent = '战斗中';
        el.style.opacity = '0.5';
      }
    }, 1000);
  },

  onLeave() {
    if (this.exitBattleTimer) {
      clearTimeout(this.exitBattleTimer);
      this.exitBattleTimer = null;
    }
  },

  async _updateBattleStatus() {
    try {
      const result = await API.get('/battle/status');
      if (result.code !== 0 || !result.data) return;

      const { state, config, isFighting } = result.data;

      if (state === 'offline_battle' && config) {
        this.isAutoBattling = true;
        this.currentBattleEnemyId = config.enemy_id;
        this.setBattleButtonsEnabled(false);
        const log = document.getElementById('battleLogContent');
        if (log) log.innerHTML = '<div class="empty-hint">正在恢复离线战斗...</div>';

        if (config.enemy_id) {
          State.setCurrentEnemyId(config.enemy_id);
          const enemyResult = await API.get(`/monster/get?id=${config.enemy_id}`);
          if (enemyResult.code === 0) this.enemy = enemyResult.data;
        }

        const resumeResult = await API.post('/battle/resume', {});
        if (resumeResult.code === 0 && resumeResult.data) {
          if (resumeResult.data.died) {
            this.isAutoBattling = false;
            this.setBattleButtonsEnabled(true);
          }
        }
      } else {
        this.setBattleButtonsEnabled(!isFighting);
        if (isFighting) {
          this.isAutoBattling = true;
          this.setBattleButtonsEnabled(false);
        }
      }
    } catch (e) {
      console.error('Failed to update battle status:', e);
    }
  },

  onStartBattle() {
    const bossId = State.getCurrentBossId();
    const enemyId = State.getCurrentEnemyId();
    if (bossId) {
      this.startBossBattle(bossId);
    } else if (enemyId) {
      this.startBattle(enemyId);
    } else {
      UI.showToast('请先选择敌人或 Boss');
    }
  },

  onStartAutoBattle() {
    if (this.isBossMode()) {
      UI.showToast('Boss 不支持自动战斗');
      return;
    }
    const enemyId = State.getCurrentEnemyId();
    enemyId ? this.startAutoBattle(enemyId) : UI.showToast('请先选择一个敌人');
  },

  onStopBattle() {
    this.setBattleButtonsEnabled(true);
    this.stopBattle();
  },

  handleBattleEvent(eventData) {
    this._handleSingleEvent(eventData);
    this.syncLogDOM();
  },

  handleBattleEventBatch(events) {
    for (const ev of events) this._handleSingleEvent(ev);
    this.syncLogDOM();
  },

  _handleSingleEvent(eventData) {
    if (!eventData || eventData.batch === true || !eventData.event) return;

    if (eventData.event === 'battle_start') {
      this.setBattleButtonsEnabled(false);
      // 自动战斗：新一场开始，清空上一场日志（服务端已间隔 2 秒，奖励已展示）
      if (this.battleLogs.length > 0) {
        this.battleLogs = [eventData];
        this.syncLogDOM();
        return;
      }
    }
    if (eventData.event === 'battle_end') {
      this.resetBattleState(true);
      if (eventData.result === 'stopped') UI.showToast('战斗已手动停止');
      if (this.isBossMode() && (eventData.result === 'win' || eventData.result === 'lose')) {
        this._scheduleExitBattle(3000);
      }
    }
    if (this.isBossMode() && (eventData.event === 'battle_win' || eventData.event === 'battle_lose')) {
      this._scheduleExitBattle(3000);
    }
    if (this.isPvpMode() && (eventData.event === 'battle_win' || eventData.event === 'battle_lose' || eventData.event === 'battle_draw')) {
      this.setBattleButtonsEnabled(true);
      this._scheduleExitBattle(3000);
    }
    this.battleLogs.push(eventData);
    if (eventData.player_hp !== undefined || eventData.player_mp !== undefined) {
      this.syncPlayerHpMp(eventData.player_hp, eventData.player_max_hp, eventData.player_mp, eventData.player_max_mp);
    }
    if (eventData.monster_hp !== undefined || eventData.monster_max_hp !== undefined) {
      this.syncMonsterHpMp(eventData.monster_hp, eventData.monster_max_hp, eventData.monster_mp, eventData.monster_max_mp);
    }
  }
};

// 兼容旧代码中的 disableBattleButtons / enableBattleButtons（main.js 的 updateBattleStatus 可能引用）
BattlePage.disableBattleButtons = () => BattlePage.setBattleButtonsEnabled(false);
BattlePage.enableBattleButtons = () => BattlePage.setBattleButtonsEnabled(true);

// 战斗奖励诊断（控制台可用）
window.diagnoseBattleReward = function() {
  const bp = Pages?.battle;
  const lastReward = bp?.battleLogs?.filter(e => e.event === 'battle_reward').pop();
  console.table({ '当前页面': State?.currentPage, 'Pages.battle': !!bp, '最近 battle_reward': lastReward });
  return lastReward;
};

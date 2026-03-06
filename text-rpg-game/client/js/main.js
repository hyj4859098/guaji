const Pages = {
  role: RolePage,
  bag: BagPage,
  equip: EquipPage,
  map: MapPage,
  'enemy-list': EnemyListPage,
  'boss-list': BossListPage,
  battle: BattlePage,
  skill: SkillPage,
  enhance: EnhancePage,
  boost: BoostPage,
  trade: TradePage,
  shop: ShopPage,
  auction: AuctionPage,
  rank: RankPage
};

// 统一刷新：所有数据变更通过 RefreshBus.emit，此处集中注册订阅
function setupRefreshBus() {
  RefreshBus.on('player', (data) => {
    if (Pages.role) Pages.role.render();
    if (Pages.equip) Pages.equip.render();
    if (State.currentPage === 'battle' && Pages.battle) {
      Pages.battle.player = data;
      // 战斗页：只更新玩家信息，不触发全量 render，避免重建按钮导致禁用状态丢失
      if (Pages.battle.updatePlayerInfo) {
        Pages.battle.updatePlayerInfo(data);
      } else {
        Pages.battle.render();
      }
    }
    if (State.currentPage === 'shop' && Pages.shop && Pages.shop.refreshBalance) {
      Pages.shop.refreshBalance();
    }
    if (State.currentPage === 'auction' && Pages.auction && Pages.auction.refreshBalance) {
      Pages.auction.refreshBalance();
    }
    const playerName = document.getElementById('playerName');
    const playerLevel = document.getElementById('playerLevel');
    if (playerName) playerName.textContent = data?.name || '未命名';
    if (playerLevel) playerLevel.textContent = `Lv.${data?.level || 1}`;
  });
  let _enhanceTimer = null;
  RefreshBus.on('bag', (data) => {
    const payload = BagService.parseBagPayload(data);
    if (Pages.bag) {
      Pages.bag.items = payload.items;
      Pages.bag.equipment_count = payload.equipment_count;
      Pages.bag.equipment_capacity = payload.equipment_capacity;
      Pages.bag.filterItems();
      Pages.bag.render();
    }
    if (typeof BagComponent !== 'undefined' && BagComponent.bags && Object.keys(BagComponent.bags).length) {
      BagComponent.allItems = payload.items;
      Object.keys(BagComponent.bags).forEach(bagId => BagComponent.updateBagItems(bagId));
    }
    if (State.currentPage === 'battle' && Pages.battle && Pages.battle.updateBagPotions) {
      Pages.battle.updateBagPotions(payload);
    }
    if (State.currentPage === 'enhance' && Pages.enhance && Pages.enhance.load) {
      clearTimeout(_enhanceTimer);
      _enhanceTimer = setTimeout(() => Pages.enhance.load(payload), 200);
    }
  });
  RefreshBus.on('equip', (data) => {
    if (Pages.equip) {
      Pages.equip.equips = data;
      Pages.equip.render();
    }
  });
}
setupRefreshBus();

function renderLayout() {
  // 渲染顶部导航栏
  renderTopNav();
  
  // 渲染聊天栏
  renderChatBar();
}

function renderTopNav() {
  const topNav = document.createElement('div');
  topNav.className = 'top-nav';
  topNav.innerHTML = `
    <h1>文字回合制挂机游戏</h1>
    <div class="nav-buttons">
      <button class="nav-btn ${State.currentPage === 'role' ? 'active' : ''}" onclick="navigateTo('role')">角色</button>
      <button class="nav-btn ${State.currentPage === 'map' ? 'active' : ''}" onclick="navigateTo('map')">地图</button>
      <button class="nav-btn ${State.currentPage === 'skill' ? 'active' : ''}" onclick="navigateTo('skill')">技能</button>
      <button class="nav-btn ${State.currentPage === 'enhance' ? 'active' : ''}" onclick="navigateTo('enhance')">强化</button>
      <button class="nav-btn ${State.currentPage === 'trade' ? 'active' : ''}" onclick="navigateTo('trade')">交易</button>
      <button class="nav-btn ${State.currentPage === 'shop' ? 'active' : ''}" onclick="navigateTo('shop')">商店</button>
      <button class="nav-btn ${State.currentPage === 'auction' ? 'active' : ''}" onclick="navigateTo('auction')">拍卖</button>
      <button class="nav-btn ${State.currentPage === 'rank' ? 'active' : ''}" onclick="navigateTo('rank')">排行</button>
      <button class="nav-btn ${State.currentPage === 'boost' ? 'active' : ''}" onclick="navigateTo('boost')">多倍/VIP</button>
    </div>
    <div class="role-info-preview">
      <span id="playerName">${State.player?.name || '未登录'}</span>
      <span id="playerLevel">Lv.${State.player?.level || 1}</span>
      <button class="nav-btn logout-btn" onclick="logout()">登出</button>
    </div>
  `;
  document.body.appendChild(topNav);
}

function renderChatBar() {
  const chatBar = document.createElement('div');
  chatBar.className = 'chat-bar';
  chatBar.innerHTML = `
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input">
      <input type="text" placeholder="输入消息...按回车发送" id="chatInput" onkeydown="if(event.key==='Enter')sendChatMessage()">
      <button onclick="sendChatMessage()">发送</button>
    </div>
  `;
  document.body.appendChild(chatBar);
}

let navDisabledByBattle = false;

/** 战斗页专用：战斗进行中时禁用导航栏，战斗结束或手动停止时启用。由 battle.js 调用 */
window.setNavDisabledByBattle = function(disabled) {
  navDisabledByBattle = !!disabled;
  if (State.currentPage !== 'battle') return;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.classList.contains('logout-btn')) return;
    btn.disabled = navDisabledByBattle;
  });
};

async function navigateTo(pageKey) {
  const prevPage = Pages[State.currentPage];
  if (prevPage && prevPage.onLeave) prevPage.onLeave();
  if (prevPage === Pages.battle) navDisabledByBattle = false;
  State.setCurrentPage(pageKey);
  const navButtons = document.querySelectorAll('.nav-btn');
  const shouldDisableNav = pageKey === 'battle' && navDisabledByBattle;
  navButtons.forEach(btn => {
    btn.classList.remove('active');
    if (!btn.classList.contains('logout-btn')) btn.disabled = shouldDisableNav;
    if (!shouldDisableNav && btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${pageKey}'`)) {
      btn.classList.add('active');
    }
  });
  await loadPage(pageKey);
}

async function loadPage(pageKey) {
  const page = Pages[pageKey];
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';

  if (page && page.load) {
    await page.load();
  }
  if (pageKey === 'role') {
    renderRolePage();
  }
}

function renderRolePage() {
  const app = document.getElementById('app');
  if (!app) return;
  
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-container';
  mainContainer.innerHTML = `
    <div class="role-info" id="roleInfo">
      <!-- 角色信息将由RolePage.render()填充 -->
    </div>
    <div class="equipment" id="equipment">
      <h2>装备栏</h2>
      <div class="equip-slots" id="equipSlots">
        <!-- 装备槽将通过JS动态填充 -->
      </div>
    </div>
    <div class="backpack" id="backpack">
      <h2>背包</h2>
      <div class="bag-grid" id="bagGrid">
        <!-- 背包物品将通过JS动态填充 -->
      </div>
    </div>
  `;
  
  app.appendChild(mainContainer);
  
  // 触发角色页面渲染
  if (Pages.role) {
    Pages.role.render();
  }
  if (Pages.equip) {
    Pages.equip.render();
  }
  if (Pages.bag) {
    Pages.bag.render();
  }
}

function sendChatMessage() {
  const chatInput = document.getElementById('chatInput');
  const text = chatInput.value.trim();
  if (!text) return;
  const name = State.player?.name || '未知';
  WS.send({ type: 'chat', data: { text, name } });
  chatInput.value = '';
}

function appendChatMessage(data) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const isMe = String(data.uid) === String(State.uid);
  const time = new Date(data.time);
  const timeStr = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
  const msg = document.createElement('div');
  msg.className = 'chat-msg' + (isMe ? ' chat-msg-me' : '');
  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-time';
  timeSpan.textContent = timeStr;
  const nameSpan = document.createElement('span');
  nameSpan.className = 'chat-name';
  nameSpan.textContent = data.name;
  const textSpan = document.createElement('span');
  textSpan.className = 'chat-text';
  textSpan.textContent = data.text;
  msg.append(timeSpan, nameSpan, textSpan);
  box.appendChild(msg);
  if (box.children.length > 100) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

async function init() {
  if (!State.token) {
    UI.showModal(`
      <h1 class="auth-title">欢迎来到文字回合制挂机游戏</h1>
      <p class="auth-subtitle">开启你的冒险之旅</p>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login" onclick="showLogin()">登录</button>
        <button class="auth-tab" data-tab="register" onclick="showRegister()">注册</button>
      </div>
      <div id="authForm"></div>
    `, { type: 'auth' });
    showLogin();
    return;
  }

  // 检查是否有角色数据
  UI.showLoading();
  const result = await API.get('/player/list');
  UI.hideLoading();

  if (result.code === 0 && result.data && result.data.length > 0) {
    State.setPlayer(result.data[0]);
    if (typeof WS !== 'undefined' && WS.connect) {
      await WS.connect();
      await WS.ensureConnected(10000);
    }
    renderLayout();
    // 初始化所有页面数据
    if (Pages.role) await Pages.role.load();
    if (Pages.bag) await Pages.bag.load();
    if (Pages.equip) await Pages.equip.load();

    if (result.data[0].auto_battle_config) {
      await navigateTo('battle');
    } else {
      await loadPage(State.currentPage);
    }
  } else if (result.code === 0 && result.data && result.data.length === 0) {
    UI.showModal(`
      <h1 class="auth-title">创建角色</h1>
      <p class="auth-subtitle">为你的冒险取一个名字</p>
      <div id="authForm">
        <input type="text" id="playerName" placeholder="请输入角色名称" class="auth-input">
        <button onclick="createPlayer()" class="auth-btn auth-btn-primary">创建角色</button>
        <button onclick="logout()" class="auth-btn auth-btn-secondary">切换账号 / 退出登录</button>
      </div>
    `, { type: 'createPlayer' });
  } else {
    State.clear();
    UI.showModal(`
      <h1 class="auth-title">欢迎来到文字回合制挂机游戏</h1>
      <p class="auth-subtitle">开启你的冒险之旅</p>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login" onclick="showLogin()">登录</button>
        <button class="auth-tab" data-tab="register" onclick="showRegister()">注册</button>
      </div>
      <div id="authForm"></div>
    `, { type: 'auth' });
    showLogin();
  }
}

WS.on('kick', (data) => {
  const reason = data?.reason || '账号在其他地方登录，30秒内无法再次登录';
  State.clear();
  if (WS.ws) {
    WS.ws.onclose = null;
    WS.ws.onerror = null;
    try { WS.ws.close(); } catch (e) {}
    WS.ws = null;
  }
  // 使用原生 alert 提示框，确保在所有设备上都能明显显示
  alert(reason);
  window.location.reload();
});
WS.on('player', (data) => RefreshBus.emit('player', data));
WS.on('bag', (data) => RefreshBus.emit('bag', data));
WS.on('equip', (data) => RefreshBus.emit('equip', data));
WS.on('trade', (data) => {
  if (Pages.trade && Pages.trade.handleTradeEvent) Pages.trade.handleTradeEvent(data);
});
WS.on('chat', (data) => appendChatMessage(data));
WS.on('title_login', (data) => {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const titles = Array.isArray(data.titles) ? data.titles : [];
  const name = String(data.name || '玩家');
  const tagText = titles.map(t => `【${String(t)}】`).join('');
  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-system chat-msg-title-login';
  const time = new Date();
  const timeStr = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-time';
  timeSpan.textContent = timeStr;
  const sysTag = document.createElement('span');
  sysTag.className = 'chat-sys-tag';
  sysTag.textContent = '系统';
  const textSpan = document.createElement('span');
  textSpan.className = 'chat-text';
  textSpan.textContent = `${tagText} ${name} 已上线！`;
  msg.append(timeSpan, sysTag, textSpan);
  box.appendChild(msg);
  if (box.children.length > 100) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
});
// 战斗事件唯一入口：支持批量（按回合）和单条事件
WS.on('battle', (data) => {
  if (!Pages.battle) return;
  if (data.batch && Array.isArray(data.events)) {
    Pages.battle.handleBattleEventBatch(data.events);
  } else {
    Pages.battle.handleBattleEvent(data);
  }
});
WS.on('boss_battle', (data) => {
  if (State.currentPage === 'battle' && Pages.battle) {
    if (data.batch && Array.isArray(data.events)) {
      Pages.battle.handleBattleEventBatch(data.events);
    } else {
      Pages.battle.handleBattleEvent(data);
    }
  }
});
WS.on('pvp_battle', (data) => {
  if (State.currentPage === 'battle' && Pages.battle) {
    if (data.batch && Array.isArray(data.events)) {
      Pages.battle.handleBattleEventBatch(data.events);
    } else {
      Pages.battle.handleBattleEvent(data);
    }
  }
});
WS.on('pvp_challenged', (data) => {
  State.setCurrentPvpTargetUid(data.challenger_uid);
  State.setCurrentPvpTargetInfo({ name: data.challenger_name, level: data.challenger_level, uid: data.challenger_uid });
  State.isPvpChallenger = false;
  State.currentBattleMode = 'pvp';
  State.setCurrentBossId(0);
  State.setCurrentEnemyId(0);
  if (data.map_id) State.setCurrentMapId(data.map_id);
  navigateTo('battle');
});
WS.on('pvp_result', (data) => {
  if (data.map_id != null && data.ban_until != null) {
    State.setMapBanUntil(data.map_id, data.ban_until);
  }
  State._pvpRedirect = data.redirect || 'boss-list';
});
function updateAuthSubmitBtn(mode) {
  const btn = document.getElementById('authSubmitBtn');
  if (!btn) return;
  if (mode === 'register') {
    btn.textContent = '注册';
    btn.className = 'auth-btn auth-btn-success';
    btn.onclick = register;
  } else {
    btn.textContent = '登录';
    btn.className = 'auth-btn auth-btn-primary';
    btn.onclick = login;
  }
}

window.showLogin = function() {
  const form = document.getElementById('authForm');
  if (!form) return;
  if (!form.querySelector('#username')) {
    form.innerHTML = `
      <input type="text" id="username" placeholder="用户名" class="auth-input">
      <input type="password" id="password" placeholder="密码" class="auth-input">
      <button id="authSubmitBtn" class="auth-btn auth-btn-primary">登录</button>
    `;
    document.getElementById('authSubmitBtn').onclick = login;
  } else {
    updateAuthSubmitBtn('login');
  }
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');
  if (loginTab) loginTab.classList.add('active');
  if (registerTab) registerTab.classList.remove('active');
};

window.showRegister = function() {
  const form = document.getElementById('authForm');
  if (!form) return;
  if (!form.querySelector('#username')) {
    form.innerHTML = `
      <input type="text" id="username" placeholder="用户名" class="auth-input">
      <input type="password" id="password" placeholder="密码" class="auth-input">
      <label class="auth-agree">
        <input type="checkbox" id="agreeTerms">
        <span>我已阅读并同意 <a href="javascript:void(0)" onclick="showTerms(event)">用户协议</a> 和 <a href="javascript:void(0)" onclick="showPrivacy(event)">隐私政策</a></span>
      </label>
      <button id="authSubmitBtn" class="auth-btn auth-btn-success">注册</button>
    `;
    document.getElementById('authSubmitBtn').onclick = register;
  } else {
    updateAuthSubmitBtn('register');
  }
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');
  if (loginTab) loginTab.classList.remove('active');
  if (registerTab) registerTab.classList.add('active');
};

window.login = async function() {
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const username = usernameEl?.value?.trim();
  const password = passwordEl?.value;

  if (!username || !password) {
    UI.showToast('请输入用户名和密码');
    return;
  }

  UI.showLoading();
  const result = await API.post('/user/login', { username, password });
  UI.hideLoading();

  if (result.code === 0) {
    State.setToken(result.data.token);
    State.setUid(result.data.uid);
    UI.hideModal();
    init();
  } else {
    UI.showToast(result.msg || '登录失败');
  }
};

window.register = async function() {
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const agreeEl = document.getElementById('agreeTerms');
  const username = usernameEl?.value?.trim();
  const password = passwordEl?.value;

  if (!username || !password) {
    UI.showToast('请输入用户名和密码');
    return;
  }
  if (agreeEl && !agreeEl.checked) {
    UI.showToast('请先阅读并同意用户协议和隐私政策');
    return;
  }

  UI.showLoading();
  const result = await API.post('/user/register', { username, password });
  UI.hideLoading();

  if (result.code === 0) {
    UI.showToast('注册成功，请登录');
    const u = document.getElementById('username');
    if (u) u.value = username;
    showLogin();
  } else {
    UI.showToast(result.msg || '注册失败');
  }
};

window.showTerms = function(e) {
  if (e) e.preventDefault();
  UI.showModal(`
    <h2 class="auth-title">用户协议</h2>
    <div class="legal-content">
      <p><strong>生效日期：</strong>2025年1月1日</p>
      <h3>1. 服务说明</h3>
      <p>本游戏为文字回合制挂机游戏（以下简称"本游戏"），由开发团队提供运营和技术支持。注册并使用本游戏即表示您同意本协议所有条款。</p>
      <h3>2. 账号注册与使用</h3>
      <p>用户应提供真实、准确的注册信息。每位用户对其账号下的所有行为负责。禁止使用外挂、脚本、漏洞利用等破坏游戏公平性的行为。</p>
      <h3>3. 虚拟物品与货币</h3>
      <p>游戏内的虚拟货币、道具、装备等均为游戏数据，不具有法定货币价值。严禁通过非官方渠道进行虚拟物品的现金交易。</p>
      <h3>4. 用户行为规范</h3>
      <p>用户不得在游戏内（含聊天）发布违法、色情、暴力、人身攻击等不良信息。违反者将被禁言或封号处理。</p>
      <h3>5. 服务变更与终止</h3>
      <p>开发团队有权对游戏进行更新、维护、调整或终止服务，并将提前通过公告告知用户。</p>
      <h3>6. 免责声明</h3>
      <p>因不可抗力（如服务器故障、网络中断等）导致的数据丢失或服务中断，开发团队不承担赔偿责任。</p>
      <h3>7. 协议修订</h3>
      <p>本协议可能随时更新，更新后的协议将在游戏内公告。继续使用本游戏即视为同意更新后的协议。</p>
    </div>
    <button class="auth-btn auth-btn-primary" onclick="UI.hideModal();showRegister()">返回注册</button>
  `, { type: 'legal' });
};

window.showPrivacy = function(e) {
  if (e) e.preventDefault();
  UI.showModal(`
    <h2 class="auth-title">隐私政策</h2>
    <div class="legal-content">
      <p><strong>生效日期：</strong>2025年1月1日</p>
      <h3>1. 信息收集</h3>
      <p>我们收集的信息包括：注册信息（用户名、密码哈希）、登录 IP 地址、游戏行为数据（角色、装备、战斗记录等）。</p>
      <h3>2. 信息使用</h3>
      <p>收集的信息仅用于：提供游戏服务、维护账号安全、改善游戏体验、防止作弊行为。</p>
      <h3>3. 信息存储与保护</h3>
      <p>密码采用 bcrypt 加密存储，不以明文保存。我们采取合理的技术措施保护用户数据安全，但无法保证绝对安全。</p>
      <h3>4. 信息共享</h3>
      <p>我们不会将用户个人信息出售或出租给第三方。除非法律要求或用户授权，我们不会向第三方披露用户信息。</p>
      <h3>5. Cookie 与本地存储</h3>
      <p>本游戏使用 localStorage 存储登录凭证（Token）。不使用第三方追踪 Cookie。</p>
      <h3>6. 用户权利</h3>
      <p>用户有权：查看自己的游戏数据、要求删除账号及相关数据、撤回对本隐私政策的同意（将导致账号注销）。</p>
      <h3>7. 未成年人保护</h3>
      <p>本游戏不面向 16 岁以下未成年人。如发现未成年人注册，我们有权冻结相关账号。</p>
      <h3>8. 政策更新</h3>
      <p>本隐私政策可能随时更新，更新后将在游戏内公告。</p>
    </div>
    <button class="auth-btn auth-btn-primary" onclick="UI.hideModal();showRegister()">返回注册</button>
  `, { type: 'legal' });
};

function logout() {
  State.clear();
  window.location.reload();
}

/** 401 时重置到登录态：清除界面、断开 WS、显示登录框 */
function resetToLogin() {
  document.querySelectorAll('.top-nav, .chat-bar').forEach(el => el.remove());
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
  if (typeof WS !== 'undefined' && WS.ws) {
    WS.ws.onclose = null;
    WS.ws.onerror = null;
    try { WS.ws.close(); } catch (e) {}
    WS.ws = null;
  }
  UI.hideLoading();
  UI.showModal(`
    <h1 class="auth-title">登录已过期</h1>
    <p class="auth-subtitle">请重新登录</p>
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login" onclick="showLogin()">登录</button>
      <button class="auth-tab" data-tab="register" onclick="showRegister()">注册</button>
    </div>
    <div id="authForm"></div>
  `, { type: 'auth' });
  showLogin();
}

window.createPlayer = async function() {
  const nameEl = document.getElementById('playerName');
  const name = nameEl?.value?.trim();
  
  if (!name) {
    UI.showToast('请输入角色名称');
    return;
  }

  UI.showLoading();
  const result = await API.post('/player/add', { name });
  UI.hideLoading();

  if (result.code === 0) {
    UI.showToast('角色创建成功');
    UI.hideModal();
    init();
  } else {
    UI.showToast(result.msg || '角色创建失败');
  }
};

init();
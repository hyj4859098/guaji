const Pages = {
  role: RolePage,
  bag: BagPage,
  equip: EquipPage,
  map: MapPage,
  'enemy-list': EnemyListPage,
  'boss-list': BossListPage,
  battle: BattlePage,
  mail: MailPage,
  skill: SkillPage,
  enhance: EnhancePage,
  boost: BoostPage,
  trade: TradePage,
  shop: ShopPage,
  boss: BossPage,
  pvp: PvpPage
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
    const playerName = document.getElementById('playerName');
    const playerLevel = document.getElementById('playerLevel');
    if (playerName) playerName.textContent = data?.name || '未命名';
    if (playerLevel) playerLevel.textContent = `Lv.${data?.level || 1}`;
  });
  let _enhanceTimer = null;
  RefreshBus.on('bag', (data) => {
    if (Pages.bag) {
      Pages.bag.items = data;
      Pages.bag.filterItems();
      Pages.bag.render();
    }
    if (typeof BagComponent !== 'undefined' && BagComponent.bags && Object.keys(BagComponent.bags).length) {
      BagComponent.allItems = data;
      Object.keys(BagComponent.bags).forEach(bagId => BagComponent.updateBagItems(bagId));
    }
    if (State.currentPage === 'battle' && Pages.battle && Pages.battle.updateBagPotions) {
      Pages.battle.updateBagPotions(data);
    }
    if (State.currentPage === 'enhance' && Pages.enhance && Pages.enhance.load) {
      clearTimeout(_enhanceTimer);
      _enhanceTimer = setTimeout(() => Pages.enhance.load(data), 200);
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
      <button class="nav-btn ${State.currentPage === 'mail' ? 'active' : ''}" onclick="navigateTo('mail')">邮件</button>
      <button class="nav-btn ${State.currentPage === 'skill' ? 'active' : ''}" onclick="navigateTo('skill')">技能</button>
      <button class="nav-btn ${State.currentPage === 'enhance' ? 'active' : ''}" onclick="navigateTo('enhance')">强化</button>
      <button class="nav-btn ${State.currentPage === 'trade' ? 'active' : ''}" onclick="navigateTo('trade')">交易</button>
      <button class="nav-btn ${State.currentPage === 'shop' ? 'active' : ''}" onclick="navigateTo('shop')">商店</button>
      <button class="nav-btn ${State.currentPage === 'auction' ? 'active' : ''}" onclick="navigateTo('auction')">拍卖</button>
      <button class="nav-btn ${State.currentPage === 'rank' ? 'active' : ''}" onclick="navigateTo('rank')">排行</button>
      <button class="nav-btn ${State.currentPage === 'pvp' ? 'active' : ''}" onclick="navigateTo('pvp')">竞技场</button>
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

async function navigateTo(pageKey) {
  const prevPage = Pages[State.currentPage];
  if (prevPage && prevPage.onLeave) prevPage.onLeave();
  State.setCurrentPage(pageKey);
  // 更新导航按钮状态
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${pageKey}'`)) {
      btn.classList.add('active');
    }
  });
  await loadPage(pageKey);
}

async function loadPage(pageKey) {
  const page = Pages[pageKey];
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
  
  if (pageKey === 'role') {
    renderRolePage();
    return;
  }
  
  if (page && page.load) {
    await page.load();
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
  msg.innerHTML = `<span class="chat-time">${timeStr}</span><span class="chat-name">${data.name}</span><span class="chat-text">${data.text.replace(/</g,'&lt;')}</span>`;
  box.appendChild(msg);
  if (box.children.length > 100) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

async function init() {
  if (!State.token) {
    UI.showModal(`
      <h2 style="margin-bottom: 16px;">欢迎来到文字回合制挂机游戏</h2>
      <div style="margin-bottom: 16px;">
        <button onclick="showLogin()" class="btn btn-primary" style="width: 100%; margin-bottom: 8px;">登录</button>
        <button onclick="showRegister()" class="btn btn-success" style="width: 100%;">注册</button>
      </div>
      <div id="authForm"></div>
    `);
    return;
  }

  // 检查是否有角色数据
  UI.showLoading();
  const result = await API.get('/player/list');
  UI.hideLoading();

  if (result.code === 0 && result.data && result.data.length > 0) {
    State.setPlayer(result.data[0]);
    if (typeof WS !== 'undefined' && WS.connect) WS.connect();
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
    // 已登录但无角色：显示创建角色界面，并提供切换账号入口
    UI.showModal(`
      <h2 style="margin-bottom: 16px;">创建角色</h2>
      <input type="text" id="playerName" placeholder="请输入角色名称" class="input" style="width: 100%; margin-bottom: 16px;">
      <button onclick="createPlayer()" class="btn btn-primary" style="width: 100%; margin-bottom: 8px;">创建角色</button>
      <button onclick="logout()" class="btn btn-info" style="width: 100%;">切换账号 / 退出登录</button>
    `);
  } else {
    // token 无效或接口异常：清除登录状态并显示登录界面
    State.clear();
    UI.showModal(`
      <h2 style="margin-bottom: 16px;">欢迎来到文字回合制挂机游戏</h2>
      <div style="margin-bottom: 16px;">
        <button onclick="showLogin()" class="btn btn-primary" style="width: 100%; margin-bottom: 8px;">登录</button>
        <button onclick="showRegister()" class="btn btn-success" style="width: 100%;">注册</button>
      </div>
      <div id="authForm"></div>
    `);
  }
}

WS.on('player', (data) => RefreshBus.emit('player', data));
WS.on('bag', (data) => RefreshBus.emit('bag', data));
WS.on('equip', (data) => RefreshBus.emit('equip', data));
WS.on('trade', (data) => {
  if (Pages.trade && Pages.trade.handleTradeEvent) Pages.trade.handleTradeEvent(data);
});
WS.on('chat', (data) => appendChatMessage(data));
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
  } else if (Pages.boss) {
    if (data.batch && Array.isArray(data.events)) {
      Pages.boss.handleBattleEventBatch(data.events);
    } else {
      Pages.boss.handleBattleEvent(data);
    }
  }
});
WS.on('pvp_battle', (data) => {
  if (!Pages.pvp) return;
  if (data.batch && Array.isArray(data.events)) {
    Pages.pvp.handleBattleEventBatch(data.events);
  } else {
    Pages.pvp.handleBattleEvent(data);
  }
});
WS.on('pvp_notify', (data) => {
  if (data?.message) UI.showToast(data.message);
});

window.showLogin = function() {
  document.getElementById('authForm').innerHTML = `
    <input type="text" id="username" placeholder="用户名" class="input" style="width: 100%; margin-bottom: 8px;">
    <input type="password" id="password" placeholder="密码" class="input" style="width: 100%; margin-bottom: 16px;">
    <button onclick="login()" class="btn btn-primary" style="width: 100%;">登录</button>
  `;
};

window.showRegister = function() {
  document.getElementById('authForm').innerHTML = `
    <input type="text" id="username" placeholder="用户名" class="input" style="width: 100%; margin-bottom: 8px;">
    <input type="password" id="password" placeholder="密码" class="input" style="width: 100%; margin-bottom: 16px;">
    <button onclick="register()" class="btn btn-success" style="width: 100%;">注册</button>
  `;
};

window.login = async function() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

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
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    UI.showToast('请输入用户名和密码');
    return;
  }

  UI.showLoading();
  const result = await API.post('/user/register', { username, password });
  UI.hideLoading();

  if (result.code === 0) {
    UI.showToast('注册成功，请登录');
    document.getElementById('username').value = username;
    showLogin();
  } else {
    UI.showToast(result.msg || '注册失败');
  }
};

function logout() {
  State.clear();
  window.location.reload();
}

window.createPlayer = async function() {
  const name = document.getElementById('playerName').value;
  
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
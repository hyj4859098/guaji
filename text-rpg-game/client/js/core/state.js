// 从 localStorage 读取 uid，支持数字和字符串（老用户可能是 _id 字符串）
function getStoredUid() {
  const u = localStorage.getItem('uid');
  if (u === null || u === '') return 0;
  return /^\d+$/.test(u) ? parseInt(u, 10) : u;
}

const State = {
  token: localStorage.getItem('token') || '',
  uid: getStoredUid(),
  player: null,
  bag: null,
  currentPage: 'role',
  currentMapId: parseInt(localStorage.getItem('currentMapId') || '0'),
  currentEnemyId: parseInt(localStorage.getItem('currentEnemyId') || '0'),
  currentBossId: parseInt(localStorage.getItem('currentBossId') || '0'),

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  },

  setUid(uid) {
    this.uid = uid;
    localStorage.setItem('uid', String(uid));
  },

  setPlayer(player) {
    this.player = player;
  },

  setBag(bag) {
    this.bag = bag;
  },

  getBag() {
    const b = this.bag;
    if (!b) return [];
    return Array.isArray(b) ? b : (b.items ?? []);
  },

  setCurrentPage(page) {
    this.currentPage = page;
  },

  setCurrentMapId(mapId) {
    this.currentMapId = mapId;
    localStorage.setItem('currentMapId', mapId);
  },

  getCurrentMapId() {
    return this.currentMapId || parseInt(localStorage.getItem('currentMapId')) || null;
  },

  setCurrentEnemyId(enemyId) {
    this.currentEnemyId = enemyId;
    localStorage.setItem('currentEnemyId', enemyId);
  },

  getCurrentEnemyId() {
    const fromState = this.currentEnemyId;
    const fromStorage = localStorage.getItem('currentEnemyId');
    const parsed = fromStorage != null && fromStorage !== '' ? parseInt(fromStorage, 10) : null;
    const id = (fromState != null && fromState !== 0) ? fromState : (parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : null);
    return id;
  },

  setCurrentBossId(bossId) {
    this.currentBossId = bossId;
    localStorage.setItem('currentBossId', bossId);
  },

  getCurrentBossId() {
    const fromState = this.currentBossId;
    const fromStorage = localStorage.getItem('currentBossId');
    const parsed = fromStorage != null && fromStorage !== '' ? parseInt(fromStorage, 10) : null;
    return (fromState != null && fromState !== 0) ? fromState : (parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : null);
  },

  clear() {
    this.token = '';
    this.uid = 0;
    this.player = null;
    this.bag = null;
    this.currentMapId = 0;
    this.currentEnemyId = 0;
    this.currentBossId = 0;
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('currentMapId');
    localStorage.removeItem('currentEnemyId');
    localStorage.removeItem('currentBossId');
  }
};

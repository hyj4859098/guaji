import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, escapeHtml } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const ELEM_NAMES = ['金', '木', '水', '火', '土'];
const ELEM_KEYS = ['elem_metal', 'elem_wood', 'elem_water', 'elem_fire', 'elem_earth'];

function buildFormHtml(b) {
  const v = (key, def = '') => b ? (b[key] ?? def) : def;
  const isEdit = !!b;
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  return [
    row(
      isEdit ? '' : inp('ID(可选)', 'boss-id-input', '', 'number', 'placeholder="自动" min="1"'),
      inp('名称', 'boss-name', v('name', ''), 'text', 'placeholder="名称"'),
      inp('等级', 'boss-level', v('level', ''), 'number', 'placeholder="等级" min="1"'),
      inp('HP', 'boss-hp', v('hp', ''), 'number', 'placeholder="生命" min="1"'),
      inp('MP', 'boss-mp', v('mp', 0), 'number', 'placeholder="魔法" min="0"'),
      inp('地图ID', 'boss-map-id', v('map_id', 1), 'number', 'min="1"')
    ),
    row(
      inp('物攻', 'boss-phy-atk', v('phy_atk', 0)),
      inp('物防', 'boss-phy-def', v('phy_def', 0)),
      inp('魔攻', 'boss-mag-atk', v('mag_atk', 0)),
      inp('魔防', 'boss-mag-def', v('mag_def', 0))
    ),
    row(
      inp('命中', 'boss-hit-rate', v('hit_rate', 0)),
      inp('闪避', 'boss-dodge-rate', v('dodge_rate', 0)),
      inp('暴击', 'boss-crit-rate', v('crit_rate', 0))
    ),
    row(
      inp('经验', 'boss-exp', v('exp', 0)),
      inp('金币', 'boss-gold', v('gold', 0)),
      inp('声望', 'boss-reputation', v('reputation', 0))
    ),
    row(
      `<span style="font-weight:bold;color:#b7791f;margin-right:4px;">五行:</span>`,
      ...ELEM_KEYS.map((k, i) => inp(ELEM_NAMES[i], `boss-${k.replace('elem_', 'elem-')}`, v(k, 0)))
    ),
    row(inp('描述', 'boss-description', v('description', ''), 'text', 'placeholder="描述" style="width:300px"'))
  ].join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  const int = id => parseInt($(`boss-${id}`)?.value) || 0;
  return {
    name: $('boss-name')?.value || '',
    level: int('level'),
    hp: int('hp'),
    mp: int('mp'),
    phy_atk: int('phy-atk'),
    phy_def: int('phy-def'),
    mag_atk: int('mag-atk'),
    mag_def: int('mag-def'),
    hit_rate: int('hit-rate'),
    dodge_rate: int('dodge-rate'),
    crit_rate: int('crit-rate'),
    exp: int('exp'),
    gold: int('gold'),
    reputation: int('reputation'),
    map_id: int('map-id'),
    elem_metal: int('elem-metal'),
    elem_wood: int('elem-wood'),
    elem_water: int('elem-water'),
    elem_fire: int('elem-fire'),
    elem_earth: int('elem-earth'),
    description: $('boss-description')?.value || ''
  };
}

export async function loadBossList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/boss`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('boss-list');
    if (!el) return;
    el.innerHTML = `
      <div class="gm-search"><input type="text" placeholder="搜索Boss..." oninput="window._gmFilterTable(this,'boss-table')"></div>
      <table class="gm-table" id="boss-table">
        <thead><tr>
          <th>ID</th><th>名称</th><th>等级</th><th>HP</th><th>MP</th><th>当前HP</th><th>状态</th>
          <th>物攻/物防</th><th>魔攻/魔防</th>
          <th>命中</th><th>闪避</th><th>暴击</th>
          <th>经验</th><th>金币</th><th>地图</th>
          <th>五行</th><th>操作</th>
        </tr></thead>
        <tbody>${result.data.map(b => `<tr>
          <td>${b.id}</td><td>${escapeHtml(b.name)}</td><td>${b.level}</td><td>${b.hp}</td><td>${b.mp ?? 0}</td>
          <td>${b.current_hp ?? b.hp}</td>
          <td>${b.can_fight ? '<span style="color:green">可挑战</span>' : (b.respawn_remain > 0 ? `${b.respawn_remain}s后刷新` : '死亡')}</td>
          <td>${b.phy_atk ?? 0}/${b.phy_def ?? 0}</td>
          <td>${b.mag_atk ?? 0}/${b.mag_def ?? 0}</td>
          <td>${b.hit_rate ?? 0}</td><td>${b.dodge_rate ?? 0}</td><td>${b.crit_rate ?? 0}</td>
          <td>${b.exp ?? 0}</td><td>${b.gold ?? 0}</td><td>${b.map_id ?? ''}</td>
          <td>${(b.elem_metal??0)}/${(b.elem_wood??0)}/${(b.elem_water??0)}/${(b.elem_fire??0)}/${(b.elem_earth??0)}</td>
          <td>
            <button class="btn btn-info" onclick="editBoss(${b.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteBoss(${b.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;

  } catch {
    showToast('加载Boss列表失败', 'error');
  }
}

export function addBoss() {
  showFormModal('新增Boss', buildFormHtml(null), saveBoss);
}

export async function saveBoss() {
  const data = collectFormData();
  if (!data.name || !data.level || !data.hp) { showToast('请填写必要字段', 'error'); return; }

  const idInput = document.getElementById('boss-id-input');
  const id = idInput?.value?.trim() ? parseInt(idInput.value) : undefined;
  if (id !== undefined && (isNaN(id) || id < 1)) { showToast('ID 须为正整数', 'error'); return; }
  if (id !== undefined) data.id = id;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/boss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('Boss新增成功'); hideFormModal(); loadBossList(); }
    else showToast(result.msg || '新增失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function editBoss(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/boss/${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const boss = result.data;
    showFormModal('编辑Boss', `<input type="hidden" id="boss-id" value="${boss.id}">${buildFormHtml(boss)}`, updateBoss);
  } catch { showToast('网络错误', 'error'); }
}

export async function updateBoss() {
  const id = parseInt(document.getElementById('boss-id')?.value);
  const data = collectFormData();
  if (!data.name || !data.level || !data.hp) { showToast('请填写必要字段', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/boss/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('Boss更新成功'); hideFormModal(); loadBossList(); }
    else showToast(result.msg || '更新失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function deleteBoss(id) {
  if (!confirm('确定要删除这个Boss吗？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/boss/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) { showToast('Boss删除成功'); loadBossList(); }
    else showToast(result.msg || '删除失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export default {
  loadBossList, addBoss, saveBoss,
  editBoss, updateBoss, deleteBoss
};

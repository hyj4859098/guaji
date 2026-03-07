import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, escapeHtml } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const ELEM_NAMES = ['金', '木', '水', '火', '土'];
const ELEM_KEYS = ['elem_metal', 'elem_wood', 'elem_water', 'elem_fire', 'elem_earth'];

function buildFormHtml(m) {
  const v = (key, def = '') => m ? (m[key] ?? def) : def;
  const isEdit = !!m;
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  return [
    row(
      isEdit ? '' : inp('ID(可选)', 'monster-id-input', '', 'number', 'placeholder="自动" min="1"'),
      inp('名称', 'monster-name', v('name', ''), 'text', 'placeholder="名称"'),
      inp('等级', 'monster-level', v('level', ''), 'number', 'placeholder="等级" min="1"'),
      inp('HP', 'monster-hp', v('hp', ''), 'number', 'placeholder="生命" min="1"'),
      inp('MP', 'monster-mp', v('mp', 0), 'number', 'placeholder="魔法" min="0"'),
      inp('地图ID', 'monster-map-id', v('map_id', 1), 'number', 'min="1"')
    ),
    row(
      inp('物攻', 'monster-phy-atk', v('phy_atk', 0)),
      inp('物防', 'monster-phy-def', v('phy_def', 0)),
      inp('魔攻', 'monster-mag-atk', v('mag_atk', 0)),
      inp('魔防', 'monster-mag-def', v('mag_def', 0))
    ),
    row(
      inp('命中', 'monster-hit-rate', v('hit_rate', 0)),
      inp('闪避', 'monster-dodge-rate', v('dodge_rate', 0)),
      inp('暴击', 'monster-crit-rate', v('crit_rate', 0))
    ),
    row(
      inp('经验', 'monster-exp', v('exp', 0)),
      inp('金币', 'monster-gold', v('gold', 0)),
      inp('声望', 'monster-reputation', v('reputation', 0))
    ),
    row(
      `<span style="font-weight:bold;color:#b7791f;margin-right:4px;">五行:</span>`,
      ...ELEM_KEYS.map((k, i) => inp(ELEM_NAMES[i], `monster-${k.replace('elem_', 'elem-')}`, v(k, 0)))
    ),
    row(inp('描述', 'monster-description', v('description', ''), 'text', 'placeholder="描述" style="width:300px"'))
  ].join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  const int = id => parseInt($(`monster-${id}`)?.value) || 0;
  return {
    name: $('monster-name')?.value || '',
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
    description: $('monster-description')?.value || ''
  };
}

export async function loadMonsterList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/monster`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('monster-list');
    if (!el) return;
    el.innerHTML = `
      <div class="gm-search"><input type="text" placeholder="搜索怪物..." oninput="window._gmFilterTable(this,'monster-table')"></div>
      <table class="gm-table" id="monster-table">
        <thead><tr>
          <th>ID</th><th>名称</th><th>等级</th><th>HP</th><th>MP</th>
          <th>物攻/物防</th><th>魔攻/魔防</th>
          <th>命中</th><th>闪避</th><th>暴击</th>
          <th>经验</th><th>金币</th><th>地图</th>
          <th>五行(金/木/水/火/土)</th><th>操作</th>
        </tr></thead>
        <tbody>${result.data.map(m => `<tr>
          <td>${m.id}</td><td>${escapeHtml(m.name)}</td><td>${m.level}</td><td>${m.hp}</td><td>${m.mp ?? 0}</td>
          <td>${m.phy_atk ?? 0}/${m.phy_def ?? 0}</td>
          <td>${m.mag_atk ?? 0}/${m.mag_def ?? 0}</td>
          <td>${m.hit_rate ?? 0}</td><td>${m.dodge_rate ?? 0}</td><td>${m.crit_rate ?? 0}</td>
          <td>${m.exp ?? 0}</td><td>${m.gold ?? 0}</td><td>${m.map_id ?? ''}</td>
          <td>${(m.elem_metal??0)}/${(m.elem_wood??0)}/${(m.elem_water??0)}/${(m.elem_fire??0)}/${(m.elem_earth??0)}</td>
          <td>
            <button class="btn btn-info" onclick="editMonster(${m.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteMonster(${m.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;

  } catch {
    showToast('加载怪物列表失败', 'error');
  }
}

export function addMonster() {
  showFormModal('新增怪物', buildFormHtml(null), saveMonster);
}

export async function saveMonster() {
  const data = collectFormData();
  if (!data.name || !data.level || !data.hp) { showToast('请填写必要字段', 'error'); return; }

  const idInput = document.getElementById('monster-id-input');
  const id = idInput?.value?.trim() ? parseInt(idInput.value) : undefined;
  if (id !== undefined && (isNaN(id) || id < 1)) { showToast('ID 须为正整数', 'error'); return; }
  if (id !== undefined) data.id = id;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/monster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('怪物新增成功'); hideFormModal(); loadMonsterList(); }
    else showToast(result.msg || '新增失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function editMonster(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/monster/${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const monster = result.data;
    showFormModal('编辑怪物', `<input type="hidden" id="monster-id" value="${monster.id}">${buildFormHtml(monster)}`, updateMonster);
  } catch { showToast('网络错误', 'error'); }
}

export async function updateMonster() {
  const id = parseInt(document.getElementById('monster-id')?.value);
  const data = collectFormData();
  if (!data.name || !data.level || !data.hp) { showToast('请填写必要字段', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/monster/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('怪物更新成功'); hideFormModal(); loadMonsterList(); }
    else showToast(result.msg || '更新失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function deleteMonster(id) {
  if (!confirm('确定要删除这个怪物吗？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/monster/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) { showToast('怪物删除成功'); loadMonsterList(); }
    else showToast(result.msg || '删除失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export default {
  loadMonsterList, addMonster, saveMonster,
  editMonster, updateMonster, deleteMonster
};

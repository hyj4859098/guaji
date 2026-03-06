import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, EQUIP_POS_NAMES } from './core.js';

const API = getApiBaseUrl();

function authHeaders(json) {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function formHtml(d) {
  const isEdit = !!d;
  const v = (k, def = 0) => (d && d[k] != null) ? d[k] : def;
  return `
    <div class="gm-form-row">
      <label>物品ID: <input type="number" id="equip-item-id" value="${v('item_id', '')}" ${isEdit ? 'disabled' : ''} min="1"></label>
      ${isEdit ? `<label>部位: <span>${EQUIP_POS_NAMES[v('pos', 1)] || v('pos', 1)}</span>（在物品管理中修改）</label>` : ''}
      <label>基础等级: <input type="number" id="equip-base-level" value="${v('base_level', 1)}" min="1"></label>
    </div>
    <div class="gm-form-row">
      <label>HP: <input type="number" id="equip-base-hp" value="${v('base_hp')}" min="0"></label>
      <label>MP: <input type="number" id="equip-base-mp" value="${v('base_mp')}" min="0"></label>
    </div>
    <div class="gm-form-row">
      <label>物攻: <input type="number" id="equip-base-phy-atk" value="${v('base_phy_atk')}" min="0"></label>
      <label>物防: <input type="number" id="equip-base-phy-def" value="${v('base_phy_def')}" min="0"></label>
      <label>魔攻: <input type="number" id="equip-base-mag-atk" value="${v('base_mag_atk')}" min="0"></label>
      <label>魔防: <input type="number" id="equip-base-mag-def" value="${v('base_mag_def')}" min="0"></label>
    </div>
    <div class="gm-form-row">
      <label>命中率: <input type="number" id="equip-base-hit-rate" value="${v('base_hit_rate')}" min="0"></label>
      <label>闪避率: <input type="number" id="equip-base-dodge-rate" value="${v('base_dodge_rate')}" min="0"></label>
      <label>暴击率: <input type="number" id="equip-base-crit-rate" value="${v('base_crit_rate')}" min="0"></label>
    </div>`;
}

function readForm() {
  const int = id => parseInt(document.getElementById(id)?.value) || 0;
  return {
    item_id: int('equip-item-id'),
    base_level: int('equip-base-level') || 1,
    base_hp: int('equip-base-hp'),
    base_mp: int('equip-base-mp'),
    base_phy_atk: int('equip-base-phy-atk'),
    base_phy_def: int('equip-base-phy-def'),
    base_mag_atk: int('equip-base-mag-atk'),
    base_mag_def: int('equip-base-mag-def'),
    base_hit_rate: int('equip-base-hit-rate'),
    base_dodge_rate: int('equip-base-dodge-rate'),
    base_crit_rate: int('equip-base-crit-rate'),
  };
}

export async function loadEquipList() {
  try {
    const r = await fetch(`${API}/admin/equip_base`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }
    const el = document.getElementById('equip-list');
    if (!el) return;
    const list = result.data || [];
    el.innerHTML = `
      <div class="gm-search"><input type="text" id="equip-search" placeholder="搜索装备..." oninput="filterEquipTable()"></div>
      <table class="gm-table">
        <thead><tr>
          <th>物品ID</th><th>部位</th><th>等级</th><th>HP</th><th>MP</th>
          <th>物攻</th><th>物防</th><th>魔攻</th><th>魔防</th>
          <th>命中</th><th>闪避</th><th>暴击</th><th>操作</th>
        </tr></thead>
        <tbody>${list.map(e => {
          return `<tr>
            <td>${e.item_id}</td><td>${EQUIP_POS_NAMES[e.pos] || e.pos}</td><td>${e.base_level ?? 1}</td>
            <td>${e.base_hp ?? 0}</td><td>${e.base_mp ?? 0}</td>
            <td>${e.base_phy_atk ?? 0}</td><td>${e.base_phy_def ?? 0}</td>
            <td>${e.base_mag_atk ?? 0}</td><td>${e.base_mag_def ?? 0}</td>
            <td>${e.base_hit_rate ?? 0}</td><td>${e.base_dodge_rate ?? 0}</td><td>${e.base_crit_rate ?? 0}</td>
            <td>
              <button class="btn btn-info" onclick="editEquip(${e.item_id})">编辑</button>
              <button class="btn btn-danger" onclick="deleteEquip(${e.item_id})">删除</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } catch {
    showToast('加载装备列表失败', 'error');
  }
}

function filterEquipTable() {
  const kw = (document.getElementById('equip-search')?.value || '').toLowerCase();
  document.querySelectorAll('#equip-list .gm-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(kw) ? '' : 'none';
  });
}

export async function editEquip(id) {
  try {
    const r = await fetch(`${API}/admin/equip_base/${id}`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const d = result.data;
    showFormModal('编辑装备', formHtml(d), () => updateEquip(d.item_id));
  } catch { showToast('网络错误', 'error'); }
}

export async function updateEquip(id) {
  const data = readForm();
  delete data.item_id;
  try {
    const r = await fetch(`${API}/admin/equip_base/${id}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('装备更新成功'); hideFormModal(); loadEquipList(); }
    else showToast(result.msg || '失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function deleteEquip(id) {
  if (!confirm('确定要删除这个装备配置吗？')) return;
  try {
    const r = await fetch(`${API}/admin/equip_base/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await r.json();
    if (result.code === 0) { showToast('装备删除成功'); loadEquipList(); }
    else showToast(result.msg || '失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

window.filterEquipTable = filterEquipTable;

export default { loadEquipList, editEquip, updateEquip, deleteEquip };

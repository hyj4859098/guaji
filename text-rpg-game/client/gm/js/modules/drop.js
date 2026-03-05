import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal } from './core.js';

const API = getApiBaseUrl();
let dropType = 'monster'; // 'monster' | 'boss'

function authHeaders(json) {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function formHtml(d, type) {
  const t = type || dropType;
  const v = (k, def = '') => (d && d[k] != null) ? d[k] : def;
  const idLabel = t === 'boss' ? 'BossID' : '怪物ID';
  const idKey = t === 'boss' ? 'boss_id' : 'monster_id';
  return `
    <div class="gm-form-row">
      <label>${idLabel}: <input type="number" id="drop-entity-id" value="${v(idKey)}" min="1"></label>
      <label>物品ID: <input type="number" id="drop-item-id" value="${v('item_id')}" min="1"></label>
      <label>数量: <input type="number" id="drop-quantity" value="${v('quantity', 1)}" min="1"></label>
      <label>概率(0-100，支持小数如0.1、0.01): <input type="number" id="drop-probability" value="${v('probability', 0)}" min="0" max="100" step="0.01"></label>
    </div>`;
}

function readForm() {
  const int = id => parseInt(document.getElementById(id)?.value) || 0;
  const float = id => parseFloat(document.getElementById(id)?.value) || 0;
  const entityId = int('drop-entity-id');
  const data = {
    item_id: int('drop-item-id'),
    quantity: int('drop-quantity') || 1,
    probability: float('drop-probability'),
  };
  if (dropType === 'boss') data.boss_id = entityId;
  else data.monster_id = entityId;
  return data;
}

export async function loadDropList() {
  try {
    const type = document.getElementById('drop-type-select')?.value || 'monster';
    dropType = type;
    const isBoss = type === 'boss';
    const apiPath = isBoss ? 'boss_drop' : 'monster_drop';
    const filterKey = isBoss ? 'boss_id' : 'monster_id';
    const filterId = document.getElementById('drop-entity-filter')?.value?.trim();
    const url = filterId ? `${API}/admin/${apiPath}?${filterKey}=${filterId}` : `${API}/admin/${apiPath}`;
    const r = await fetch(url, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }
    const el = document.getElementById('drop-list');
    if (!el) return;
    const list = result.data || [];
    const colName = isBoss ? 'BossID' : '怪物ID';
    const colKey = isBoss ? 'boss_id' : 'monster_id';
    const nameKey = isBoss ? 'boss_name' : 'monster_name';
    el.innerHTML = `
      <div class="gm-search">
        <select id="drop-type-select" onchange="loadDropList()" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;margin-right:8px;">
          <option value="monster" ${!isBoss ? 'selected' : ''}>怪物掉落</option>
          <option value="boss" ${isBoss ? 'selected' : ''}>Boss掉落</option>
        </select>
        <input type="text" id="drop-search" placeholder="搜索掉落..." oninput="filterDropTable()">
        <input type="number" id="drop-entity-filter" placeholder="${colName}筛选" min="1" value="${filterId || ''}" style="margin-left:8px;width:120px">
        <button class="btn btn-info" onclick="loadDropList()" style="margin-left:4px">筛选</button>
      </div>
      <table class="gm-table">
        <thead><tr><th>ID</th><th>${colName}</th><th>物品</th><th>数量</th><th>概率</th><th>操作</th></tr></thead>
        <tbody>${list.map(d => `<tr>
          <td>${d.id}</td><td>${d[colKey]} ${d[nameKey] ? `(${d[nameKey]})` : ''}</td><td>${d.item_id} ${d.item_name ? `(${d.item_name})` : ''}</td>
          <td>${d.quantity ?? 1}</td><td>${d.probability ?? 0}%</td>
          <td>
            <button class="btn btn-info" onclick="editDrop(${d.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteDrop(${d.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch (e) {
    showToast('加载掉落列表失败', 'error');
  }
}

function filterDropTable() {
  const kw = (document.getElementById('drop-search')?.value || '').toLowerCase();
  document.querySelectorAll('#drop-list .gm-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(kw) ? '' : 'none';
  });
}

export function addDrop() {
  showFormModal(dropType === 'boss' ? '新增Boss掉落' : '新增怪物掉落', formHtml(null), saveDrop);
}

export async function saveDrop() {
  const data = readForm();
  const entityId = dropType === 'boss' ? data.boss_id : data.monster_id;
  if (!entityId) { showToast(`请填写有效的${dropType === 'boss' ? 'Boss' : '怪物'}ID`, 'error'); return; }
  if (!data.item_id) { showToast('请填写有效的物品ID', 'error'); return; }
  try {
    const apiPath = dropType === 'boss' ? 'boss_drop' : 'monster_drop';
    const r = await fetch(`${API}/admin/${apiPath}`, {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('掉落新增成功'); hideFormModal(); loadDropList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function editDrop(id) {
  try {
    const apiPath = dropType === 'boss' ? 'boss_drop' : 'monster_drop';
    const r = await fetch(`${API}/admin/${apiPath}/${id}`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast('获取失败', 'error'); return; }
    const d = result.data;
    showFormModal(dropType === 'boss' ? '编辑Boss掉落' : '编辑怪物掉落', formHtml(d), () => updateDrop(d.id));
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function updateDrop(id) {
  const data = readForm();
  try {
    const apiPath = dropType === 'boss' ? 'boss_drop' : 'monster_drop';
    const r = await fetch(`${API}/admin/${apiPath}/${id}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('掉落更新成功'); hideFormModal(); loadDropList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function deleteDrop(id) {
  if (!confirm('确定要删除这条掉落配置吗？')) return;
  try {
    const apiPath = dropType === 'boss' ? 'boss_drop' : 'monster_drop';
    const r = await fetch(`${API}/admin/${apiPath}/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await r.json();
    if (result.code === 0) { showToast('掉落删除成功'); loadDropList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

window.filterDropTable = filterDropTable;

export default { loadDropList, addDrop, saveDrop, editDrop, updateDrop, deleteDrop };

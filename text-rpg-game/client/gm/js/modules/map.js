import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal } from './core.js';

const API = getApiBaseUrl();

function authHeaders(json) {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function formHtml(d) {
  const isEdit = !!d;
  const v = (k, def = '') => (d && d[k] != null) ? d[k] : def;
  return `
    <div class="gm-form-row">
      <label>ID${isEdit ? '' : '（可选）'}: <input type="number" id="map-id" value="${v('id', '')}" ${isEdit ? 'disabled' : ''} min="1"></label>
      <label>名称: <input type="text" id="map-name" value="${v('name')}" placeholder="地图名称"></label>
    </div>
    <div class="gm-form-row">
      <label>最低等级: <input type="number" id="map-level-min" value="${v('level_min', 1)}" min="1"></label>
      <label>最高等级: <input type="number" id="map-level-max" value="${v('level_max', 99)}" min="1"></label>
    </div>
    <div class="gm-form-row">
      <label>描述: <input type="text" id="map-description" value="${v('description')}" placeholder="描述" style="width:300px"></label>
    </div>`;
}

function readForm(includeId) {
  const name = document.getElementById('map-name')?.value?.trim() || '';
  const description = document.getElementById('map-description')?.value?.trim() || '';
  const level_min = parseInt(document.getElementById('map-level-min')?.value) || 1;
  const level_max = parseInt(document.getElementById('map-level-max')?.value) || 99;
  const data = { name, description, level_min, level_max };
  if (includeId) {
    const idVal = document.getElementById('map-id')?.value?.trim();
    if (idVal) data.id = parseInt(idVal);
  }
  return data;
}

export async function loadMapList() {
  try {
    const r = await fetch(`${API}/admin/map`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }
    const el = document.getElementById('map-list');
    if (!el) return;
    const list = result.data || [];
    el.innerHTML = `
      <div class="gm-search"><input type="text" id="map-search" placeholder="搜索地图..." oninput="filterMapTable()"></div>
      <table class="gm-table">
        <thead><tr><th>ID</th><th>名称</th><th>等级范围</th><th>描述</th><th>操作</th></tr></thead>
        <tbody>${list.map(m => `<tr>
          <td>${m.id}</td><td>${m.name}</td><td>${m.level_min ?? 1} - ${m.level_max ?? 99}</td>
          <td>${m.description || ''}</td>
          <td>
            <button class="btn btn-info" onclick="editMap(${m.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteMap(${m.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch (e) {
    showToast('加载地图列表失败', 'error');
  }
}

function filterMapTable() {
  const kw = (document.getElementById('map-search')?.value || '').toLowerCase();
  document.querySelectorAll('#map-list .gm-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(kw) ? '' : 'none';
  });
}

export function addMap() {
  showFormModal('新增地图', formHtml(null), saveMap);
}

export async function saveMap() {
  const data = readForm(true);
  if (!data.name) { showToast('请填写名称', 'error'); return; }
  try {
    const r = await fetch(`${API}/admin/map`, {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('地图新增成功'); hideFormModal(); loadMapList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function editMap(id) {
  try {
    const r = await fetch(`${API}/admin/map/${id}`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const d = result.data;
    showFormModal('编辑地图', formHtml(d), () => updateMap(d.id));
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function updateMap(id) {
  const data = readForm(false);
  if (!data.name) { showToast('请填写名称', 'error'); return; }
  try {
    const r = await fetch(`${API}/admin/map/${id}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('地图更新成功'); hideFormModal(); loadMapList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function deleteMap(id) {
  if (!confirm('确定要删除这个地图吗？')) return;
  try {
    const r = await fetch(`${API}/admin/map/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await r.json();
    if (result.code === 0) { showToast('地图删除成功'); loadMapList(); }
    else showToast(result.msg || '失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

window.filterMapTable = filterMapTable;

export default { loadMapList, addMap, saveMap, editMap, updateMap, deleteMap };

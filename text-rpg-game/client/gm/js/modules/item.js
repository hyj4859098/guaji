import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const TYPE_MAP = { 1: '消耗品', 2: '装备', 3: '材料', 4: '道具/技能书' };

function buildFormHtml(item) {
  const v = (key, def = '') => item ? (item[key] ?? def) : def;
  const isEdit = !!item;
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  const typeSelect = `<label>类型: <select id="item-type">
    <option value="1" ${v('type', 1) == 1 ? 'selected' : ''}>消耗品</option>
    <option value="2" ${v('type', 1) == 2 ? 'selected' : ''}>装备</option>
    <option value="3" ${v('type', 1) == 3 ? 'selected' : ''}>材料</option>
    <option value="4" ${v('type', 1) == 4 ? 'selected' : ''}>道具/技能书</option>
  </select></label>`;

  return [
    row(
      isEdit ? '' : inp('ID(可选)', 'item-id-input', '', 'number', 'placeholder="留空自动" min="1"'),
      inp('名称', 'item-name', v('name', ''), 'text', 'placeholder="物品名称"'),
      typeSelect
    ),
    row(
      inp('部位', 'item-pos', v('pos', 0)),
      inp('回血', 'item-hp-restore', v('hp_restore', 0)),
      inp('回蓝', 'item-mp-restore', v('mp_restore', 0))
    ),
    row(
      inp('描述', 'item-description', v('description', ''), 'text', 'placeholder="描述" style="width:300px"')
    )
  ].join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  return {
    name: $('item-name')?.value?.trim() || '',
    type: parseInt($('item-type')?.value) || 1,
    pos: parseInt($('item-pos')?.value) || 0,
    hp_restore: parseInt($('item-hp-restore')?.value) || 0,
    mp_restore: parseInt($('item-mp-restore')?.value) || 0,
    description: $('item-description')?.value?.trim() || ''
  };
}

export async function loadItemList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/item`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('item-list');
    if (!el) return;
    el.innerHTML = `
      <div class="gm-search"><input type="text" placeholder="搜索物品..." oninput="window._gmFilterTable(this,'item-table')"></div>
      <table class="gm-table" id="item-table">
        <thead><tr>
          <th>ID</th><th>名称</th><th>类型</th><th>部位</th>
          <th>回血</th><th>回蓝</th><th>描述</th><th>操作</th>
        </tr></thead>
        <tbody>${result.data.map(it => `<tr>
          <td>${it.id}</td><td>${it.name}</td>
          <td>${TYPE_MAP[it.type] ?? it.type}</td>
          <td>${it.pos ?? 0}</td>
          <td>${it.hp_restore ?? 0}</td>
          <td>${it.mp_restore ?? 0}</td>
          <td>${it.description || ''}</td>
          <td>
            <button class="btn btn-info" onclick="editItem(${it.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteItem(${it.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;

    window._gmFilterTable = window._gmFilterTable || function (input, tableId) {
      const kw = input.value.toLowerCase();
      document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(kw) ? '' : 'none';
      });
    };
  } catch (e) {
    showToast('加载物品列表失败', 'error');
  }
}

export function addItem() {
  showFormModal('新增物品', buildFormHtml(null), saveItem);
}

export async function saveItem() {
  const data = collectFormData();
  if (!data.name) { showToast('请填写名称', 'error'); return; }

  const idInput = document.getElementById('item-id-input');
  const id = idInput?.value?.trim() ? parseInt(idInput.value) : undefined;
  if (id !== undefined && (isNaN(id) || id < 1)) { showToast('ID 须为正整数', 'error'); return; }
  if (id !== undefined) data.id = id;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('物品新增成功'); hideFormModal(); loadItemList(); }
    else showToast(result.msg || '新增失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function editItem(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/item/${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const item = result.data;
    showFormModal('编辑物品', `<input type="hidden" id="item-id" value="${item.id}">${buildFormHtml(item)}`, updateItem);
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function updateItem() {
  const id = parseInt(document.getElementById('item-id')?.value);
  const data = collectFormData();
  if (!data.name) { showToast('请填写名称', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/item/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('物品更新成功'); hideFormModal(); loadItemList(); }
    else showToast(result.msg || '更新失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function deleteItem(id) {
  if (!confirm('确定要删除这个物品吗？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/item/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) { showToast('物品删除成功'); loadItemList(); }
    else showToast(result.msg || '删除失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export default {
  loadItemList, addItem, saveItem,
  editItem, updateItem, deleteItem
};

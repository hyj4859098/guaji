import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const SHOP_TYPE_MAP = { gold: '金币商店', reputation: '声望商店', points: '积分商店' };
const CATEGORY_MAP = { consumable: '消耗品', material: '材料/道具' };

let cachedItems = [];

async function loadItemOptions() {
  if (cachedItems.length) return cachedItems;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/item`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) cachedItems = result.data || [];
  } catch (e) { /* ignore */ }
  return cachedItems;
}

function buildFormHtml(shopItem) {
  const v = (key, def = '') => shopItem ? (shopItem[key] ?? def) : def;
  const isEdit = !!shopItem;
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;

  const shopTypeSelect = `<label>商店类型: <select id="shop-shop-type">
    ${Object.entries(SHOP_TYPE_MAP).map(([k, l]) =>
      `<option value="${k}" ${v('shop_type', 'gold') === k ? 'selected' : ''}>${l}</option>`
    ).join('')}
  </select></label>`;

  const categorySelect = `<label>分类: <select id="shop-category">
    ${Object.entries(CATEGORY_MAP).map(([k, l]) =>
      `<option value="${k}" ${v('category', 'consumable') === k ? 'selected' : ''}>${l}</option>`
    ).join('')}
  </select></label>`;

  const itemSelect = `<label>物品: <select id="shop-item-id">
    <option value="">加载中...</option>
  </select></label>`;

  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  const enabledCheck = `<label>上架: <input type="checkbox" id="shop-enabled" ${v('enabled', true) ? 'checked' : ''}></label>`;

  return [
    row(shopTypeSelect, itemSelect),
    row(
      inp('价格', 'shop-price', v('price', 0)),
      categorySelect,
      inp('排序', 'shop-sort-order', v('sort_order', 0)),
      enabledCheck
    ),
  ].join('');
}

async function populateItemSelect(selectedItemId) {
  const items = await loadItemOptions();
  const sel = document.getElementById('shop-item-id');
  if (!sel) return;
  const nonEquip = items.filter(i => i.type !== 2);
  sel.innerHTML = nonEquip.map(i =>
    `<option value="${i.id}" ${i.id === selectedItemId ? 'selected' : ''}>[${i.id}] ${i.name}</option>`
  ).join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  return {
    shop_type: $('shop-shop-type')?.value || 'gold',
    item_id: parseInt($('shop-item-id')?.value) || 0,
    price: parseInt($('shop-price')?.value) || 0,
    category: $('shop-category')?.value || 'consumable',
    sort_order: parseInt($('shop-sort-order')?.value) || 0,
    enabled: $('shop-enabled')?.checked ?? true,
  };
}

export async function loadShopList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/shop`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('shop-list');
    if (!el) return;
    el.innerHTML = `
      <div class="gm-search"><input type="text" placeholder="搜索商品..." oninput="window._gmFilterTable(this,'shop-table')"></div>
      <table class="gm-table" id="shop-table">
        <thead><tr>
          <th>ID</th><th>商店</th><th>物品ID</th><th>物品名称</th>
          <th>价格</th><th>分类</th><th>排序</th><th>状态</th><th>操作</th>
        </tr></thead>
        <tbody>${result.data.map(si => `<tr>
          <td>${si.id}</td>
          <td>${SHOP_TYPE_MAP[si.shop_type] || si.shop_type}</td>
          <td>${si.item_id}</td>
          <td>${si.item_name || ''}</td>
          <td class="num">${si.price}</td>
          <td>${CATEGORY_MAP[si.category] || si.category}</td>
          <td class="num">${si.sort_order ?? 0}</td>
          <td>${si.enabled ? '✅ 上架' : '❌ 下架'}</td>
          <td>
            <button class="btn btn-info" onclick="editShopItem(${si.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteShopItem(${si.id})">删除</button>
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
    showToast('加载商店列表失败', 'error');
  }
}

export function addShopItem() {
  showFormModal('新增商店商品', buildFormHtml(null), saveShopItem);
  populateItemSelect(null);
}

export async function saveShopItem() {
  const data = collectFormData();
  if (!data.item_id) { showToast('请选择物品', 'error'); return; }
  if (data.price <= 0) { showToast('价格须大于0', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/shop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('新增成功'); hideFormModal(); loadShopList(); }
    else showToast(result.msg || '新增失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function editShopItem(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/shop/${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const si = result.data;
    showFormModal('编辑商店商品', `<input type="hidden" id="shop-edit-id" value="${si.id}">${buildFormHtml(si)}`, updateShopItem);
    populateItemSelect(si.item_id);
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function updateShopItem() {
  const id = parseInt(document.getElementById('shop-edit-id')?.value);
  const data = collectFormData();
  if (!data.item_id) { showToast('请选择物品', 'error'); return; }
  if (data.price <= 0) { showToast('价格须大于0', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/shop/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('更新成功'); hideFormModal(); loadShopList(); }
    else showToast(result.msg || '更新失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function deleteShopItem(id) {
  if (!confirm('确定要删除这个商店商品吗？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/shop/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) { showToast('删除成功'); loadShopList(); }
    else showToast(result.msg || '删除失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export default {
  loadShopList, addShopItem, saveShopItem,
  editShopItem, updateShopItem, deleteShopItem
};

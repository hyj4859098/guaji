import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, escapeHtml } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const EFFECT_TYPE_MAP = {
  restore: '恢复药水',
  vip: 'VIP卡',
  boost: '多倍卡',
  learn_skill: '技能书',
  expand_bag: '扩容袋',
  add_stat: '永久属性果实',
};

const ATTR_MAP = {
  max_hp: '生命上限',
  max_mp: '魔法上限',
  phy_atk: '物理攻击',
  mag_atk: '魔法攻击',
  phy_def: '物理防御',
  mag_def: '魔法防御',
};

function authHeaders(json) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function buildFormHtml(eff, items) {
  const v = (key, def = '') => (eff && eff[key] != null ? eff[key] : def);
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  const itemOptions = (items || []).map(i => `<option value="${i.id}" ${i.id === v('item_id') ? 'selected' : ''}>[${i.id}] ${i.name}</option>`).join('');
  const itemSelect = `<label>物品: <select id="ie-item-id"><option value="">请选择物品</option>${itemOptions}</select></label>`;

  const effectOptions = Object.entries(EFFECT_TYPE_MAP).map(([k, l]) => `<option value="${k}" ${v('effect_type') === k ? 'selected' : ''}>${l}</option>`).join('');
  const effectSelect = `<label>效果类型: <select id="ie-effect-type">${effectOptions}</select></label>`;

  const attrOptions = Object.entries(ATTR_MAP).map(([k, l]) => `<option value="${k}" ${v('attr') === k ? 'selected' : ''}>${l}</option>`).join('');
  const attrSelect = `<label>属性: <select id="ie-attr">${attrOptions}</select></label>`;

  const expandRow = row(
    inp('单次增加容量', 'ie-expand-value', v('value', 50)),
    inp('容量上限', 'ie-expand-max', v('max', 500))
  );
  const addStatRow = row(
    attrSelect,
    inp('增加值', 'ie-stat-value', v('value', 1)),
    `<label>同时恢复当前值: <input type="checkbox" id="ie-also-add" ${v('also_add_current') ? 'checked' : ''}></label>`
  );

  return [
    row(itemSelect, effectSelect),
    `<div id="ie-expand-params" class="ie-params" style="display:${v('effect_type') === 'expand_bag' ? '' : 'none'}">${expandRow}</div>`,
    `<div id="ie-addstat-params" class="ie-params" style="display:${v('effect_type') === 'add_stat' ? '' : 'none'}">${addStatRow}</div>`,
  ].join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  const effectType = $('ie-effect-type')?.value || 'restore';
  const data = {
    item_id: parseInt($('ie-item-id')?.value) || 0,
    effect_type: effectType,
  };
  if (effectType === 'expand_bag') {
    data.value = parseInt($('ie-expand-value')?.value) || 50;
    data.max = parseInt($('ie-expand-max')?.value) || 500;
  } else if (effectType === 'add_stat') {
    data.attr = $('ie-attr')?.value || 'max_hp';
    data.value = parseInt($('ie-stat-value')?.value) || 1;
    data.also_add_current = $('ie-also-add')?.checked ?? false;
  }
  return data;
}

function bindEffectTypeChange() {
  const sel = document.getElementById('ie-effect-type');
  const expandDiv = document.getElementById('ie-expand-params');
  const addStatDiv = document.getElementById('ie-addstat-params');
  if (!sel) return;
  sel.onchange = () => {
    const t = sel.value;
    if (expandDiv) expandDiv.style.display = t === 'expand_bag' ? '' : 'none';
    if (addStatDiv) addStatDiv.style.display = t === 'add_stat' ? '' : 'none';
  };
}

export async function loadItemEffectList() {
  try {
    const itemId = document.getElementById('ie-filter-item')?.value?.trim();
    const url = itemId ? `${API_BASE_URL}/admin/item_effect?item_id=${itemId}` : `${API_BASE_URL}/admin/item_effect`;
    const r = await fetch(url, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) {
      showToast(result.msg || '加载失败', 'error');
      return;
    }
    const el = document.getElementById('item-effect-list');
    if (!el) return;
    const list = result.data || [];
    el.innerHTML = `
      <div class="gm-search">
        <input type="number" id="ie-filter-item" placeholder="物品ID筛选" value="${itemId || ''}" style="width:120px">
        <button class="btn btn-info" onclick="loadItemEffectList()" style="margin-left:4px">筛选</button>
        <input type="text" placeholder="搜索..." oninput="window._gmFilterTable(this,'item-effect-table')" style="margin-left:8px;width:180px">
      </div>
      <table class="gm-table" id="item-effect-table">
        <thead><tr>
          <th>ID</th><th>物品ID</th><th>物品名称</th><th>效果类型</th><th>参数</th><th>操作</th>
        </tr></thead>
        <tbody>${list.map(d => {
          let paramStr = '';
          if (d.effect_type === 'expand_bag') paramStr = `value=${d.value ?? 50}, max=${d.max ?? 500}`;
          else if (d.effect_type === 'add_stat') paramStr = `${ATTR_MAP[d.attr] || d.attr}+${d.value ?? 1}${d.also_add_current ? '(含当前)' : ''}`;
          return `<tr>
            <td>${d.id}</td><td>${d.item_id}</td><td>${escapeHtml(d.item_name || '-')}</td>
            <td>${EFFECT_TYPE_MAP[d.effect_type] || d.effect_type}</td><td>${paramStr}</td>
            <td>
              <button class="btn btn-info" onclick="editItemEffect(${d.id})">编辑</button>
              <button class="btn btn-danger" onclick="deleteItemEffect(${d.id})">删除</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } catch {
    showToast('加载道具效果列表失败', 'error');
  }
}

export async function editItemEffect(id) {
  try {
    const [effRes, itemsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/item_effect/${id}`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/admin/item`, { headers: authHeaders() }),
    ]);
    const effResult = await effRes.json();
    const itemsResult = await itemsRes.json();
    if (effResult.code !== 0) {
      showToast(effResult.msg || '获取失败', 'error');
      return;
    }
    const eff = effResult.data;
    const items = itemsResult.code === 0 ? (itemsResult.data || []) : [];
    showFormModal('编辑道具效果', `<input type="hidden" id="ie-id" value="${eff.id}">${buildFormHtml(eff, items)}`, () => updateItemEffect(eff.id));
    bindEffectTypeChange();
  } catch {
    showToast('网络错误', 'error');
  }
}

export async function updateItemEffect(id) {
  const data = collectFormData();
  try {
    const r = await fetch(`${API_BASE_URL}/admin/item_effect/${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (result.code === 0) {
      showToast('更新成功');
      hideFormModal();
      loadItemEffectList();
    } else {
      showToast(result.msg || '更新失败', 'error');
    }
  } catch {
    showToast('网络错误', 'error');
  }
}

export async function deleteItemEffect(id) {
  if (!confirm('确定要删除这条道具效果配置吗？')) return;
  try {
    const r = await fetch(`${API_BASE_URL}/admin/item_effect/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await r.json();
    if (result.code === 0) {
      showToast('删除成功');
      loadItemEffectList();
    } else {
      showToast(result.msg || '删除失败', 'error');
    }
  } catch {
    showToast('网络错误', 'error');
  }
}

export default {
  loadItemEffectList,
  editItemEffect,
  updateItemEffect,
  deleteItemEffect,
};

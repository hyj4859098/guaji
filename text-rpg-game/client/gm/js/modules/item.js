import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, posOptions, EQUIP_POS_NAMES, escapeHtml } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const TYPE_MAP = { 1: '消耗品', 2: '装备', 3: '材料', 4: '道具/技能书', 5: '多倍卡', 6: 'VIP卡' };
const EFFECT_TYPE_OPTIONS = [
  { v: '', l: '无' },
  { v: 'learn_skill', l: '技能书' },
  { v: 'expand_bag', l: '扩容袋' },
  { v: 'add_stat', l: '永久属性果实' },
];
const ATTR_OPTIONS = [
  { v: 'max_hp', l: '生命上限' },
  { v: 'max_mp', l: '魔法上限' },
  { v: 'phy_atk', l: '物理攻击' },
  { v: 'mag_atk', l: '魔法攻击' },
  { v: 'phy_def', l: '物理防御' },
  { v: 'mag_def', l: '魔法防御' },
];

function buildFormHtml(item) {
  const v = (key, def = '') => item ? (item[key] ?? def) : def;
  const isEdit = !!item;
  const t = parseInt(v('type', 1));
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  const typeSelect = `<label>类型: <select id="item-type">
    <option value="1" ${t === 1 ? 'selected' : ''}>消耗品</option>
    <option value="2" ${t === 2 ? 'selected' : ''}>装备</option>
    <option value="3" ${t === 3 ? 'selected' : ''}>材料</option>
    <option value="4" ${t === 4 ? 'selected' : ''}>道具/技能书</option>
    <option value="5" ${t === 5 ? 'selected' : ''}>多倍卡</option>
    <option value="6" ${t === 6 ? 'selected' : ''}>VIP卡</option>
  </select></label>`;

  const effectSelect = `<label>使用效果: <select id="item-effect-type">
    ${EFFECT_TYPE_OPTIONS.map(o => `<option value="${o.v}" ${v('effect_type') === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
  </select></label>`;

  const attrSelect = `<label>属性: <select id="item-effect-attr">
    ${ATTR_OPTIONS.map(o => `<option value="${o.v}" ${v('effect_attr') === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
  </select></label>`;

  const expandRow = row(inp('单次增加容量', 'item-effect-expand-value', v('effect_value', 50)), inp('容量上限', 'item-effect-expand-max', v('effect_max', 500)));
  const addStatRow = row(
    attrSelect,
    inp('增加值', 'item-effect-stat-value', v('effect_value', 1)),
    `<label>同时恢复当前值: <input type="checkbox" id="item-effect-also-add" ${v('effect_also_add_current') ? 'checked' : ''}></label>`
  );

  const skillRow = `<div class="gm-form-row" style="margin-top:8px;padding:8px;background:#f9f9f9;border-radius:4px;">
    <strong>同时创建技能（可选）</strong>
    ${row(
      inp('技能名称', 'item-skill-name', v('skill_name', ''), 'text', 'placeholder="留空则需在技能管理单独创建"'),
      `<label>类型: <select id="item-skill-type"><option value="0" ${v('skill_type', 1) == 0 ? 'selected' : ''}>物理</option><option value="1" ${v('skill_type', 1) == 1 ? 'selected' : ''}>魔法</option></select></label>`,
      inp('伤害', 'item-skill-damage', v('skill_damage', 20)),
      inp('消耗MP', 'item-skill-cost', v('skill_cost', 10)),
      inp('概率%', 'item-skill-probability', v('skill_probability', 90))
    )}
  </div>`;
  const learnSkillRow = `<div id="item-learnskill-params" style="display:${v('effect_type') === 'learn_skill' ? '' : 'none'}">${skillRow}</div>`;

  return [
    row(
      isEdit ? '' : inp('ID(可选)', 'item-id-input', '', 'number', 'placeholder="留空自动" min="1"'),
      inp('名称', 'item-name', v('name', ''), 'text', 'placeholder="物品名称"'),
      typeSelect
    ),
    row(
      inp('回血', 'item-hp-restore', v('hp_restore', 0)),
      inp('回蓝', 'item-mp-restore', v('mp_restore', 0))
    ),
    `<div id="item-equip-row" class="item-effect-row" style="display:${t === 2 ? '' : 'none'}">
      <div class="gm-form-row" style="margin-bottom:8px;"><strong>装备属性</strong></div>
      ${row(`<label>部位: <select id="item-pos">${posOptions(v('pos', 1))}</select></label>`, inp('基础等级', 'item-base-level', v('base_level', 1)))}
      ${row(inp('HP', 'item-base-hp', v('base_hp', 0)), inp('MP', 'item-base-mp', v('base_mp', 0)))}
      ${row(inp('物攻', 'item-base-phy-atk', v('base_phy_atk', 0)), inp('物防', 'item-base-phy-def', v('base_phy_def', 0)), inp('魔攻', 'item-base-mag-atk', v('base_mag_atk', 0)), inp('魔防', 'item-base-mag-def', v('base_mag_def', 0)))}
      ${row(inp('命中率', 'item-base-hit-rate', v('base_hit_rate', 0)), inp('闪避率', 'item-base-dodge-rate', v('base_dodge_rate', 0)), inp('暴击率', 'item-base-crit-rate', v('base_crit_rate', 0)))}
    </div>`,
    row(inp('描述', 'item-description', v('description', ''), 'text', 'placeholder="描述" style="width:300px"')),
    `<div id="item-vip-row" class="item-effect-row" style="display:${t === 6 ? '' : 'none'}">${row(inp('VIP天数', 'item-vip-days', v('vip_days', 30)))}</div>`,
    `<div id="item-type4-row" class="item-effect-row" style="display:${t === 4 ? '' : 'none'}">
      ${row(effectSelect)}
      <div id="item-expand-params" style="display:${v('effect_type') === 'expand_bag' ? '' : 'none'}">${expandRow}</div>
      <div id="item-addstat-params" style="display:${v('effect_type') === 'add_stat' ? '' : 'none'}">${addStatRow}</div>
      ${learnSkillRow}
    </div>`,
  ].join('');
}

function bindItemFormTypeChange() {
  const typeSel = document.getElementById('item-type');
  const vipRow = document.getElementById('item-vip-row');
  const type4Row = document.getElementById('item-type4-row');
  const equipRow = document.getElementById('item-equip-row');
  const effectSel = document.getElementById('item-effect-type');
  const expandDiv = document.getElementById('item-expand-params');
  const addStatDiv = document.getElementById('item-addstat-params');
  if (!typeSel) return;
  const update = () => {
    const t = parseInt(typeSel.value);
    if (vipRow) vipRow.style.display = t === 6 ? '' : 'none';
    if (type4Row) type4Row.style.display = t === 4 ? '' : 'none';
    if (equipRow) equipRow.style.display = t === 2 ? '' : 'none';
  };
  typeSel.onchange = update;
  const learnSkillDiv = document.getElementById('item-learnskill-params');
  if (effectSel) {
    effectSel.onchange = () => {
      const e = effectSel.value;
      if (expandDiv) expandDiv.style.display = e === 'expand_bag' ? '' : 'none';
      if (addStatDiv) addStatDiv.style.display = e === 'add_stat' ? '' : 'none';
      if (learnSkillDiv) learnSkillDiv.style.display = e === 'learn_skill' ? '' : 'none';
    };
  }
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  const type = parseInt($('item-type')?.value) || 1;
  const posEl = $('item-pos');
  const int = id => parseInt($(id)?.value) || 0;
  const data = {
    name: $('item-name')?.value?.trim() || '',
    type,
    pos: type === 2 && posEl ? (parseInt(posEl.value) || 1) : 0,
    hp_restore: parseInt($('item-hp-restore')?.value) || 0,
    mp_restore: parseInt($('item-mp-restore')?.value) || 0,
    description: $('item-description')?.value?.trim() || '',
  };
  if (type === 6) data.vip_days = parseInt($('item-vip-days')?.value) || 30;
  if (type === 4) {
    data.effect_type = $('item-effect-type')?.value || '';
    if (data.effect_type === 'expand_bag') {
      data.effect_value = parseInt($('item-effect-expand-value')?.value) || 50;
      data.effect_max = parseInt($('item-effect-expand-max')?.value) || 500;
    } else if (data.effect_type === 'add_stat') {
      data.effect_attr = $('item-effect-attr')?.value || 'max_hp';
      data.effect_value = parseInt($('item-effect-stat-value')?.value) || 1;
      data.effect_also_add_current = $('item-effect-also-add')?.checked ?? false;
    } else if (data.effect_type === 'learn_skill') {
      const sn = $('item-skill-name')?.value?.trim();
      if (sn) {
        data.skill_name = sn;
        data.skill_type = parseInt($('item-skill-type')?.value) ?? 1;
        data.skill_damage = parseInt($('item-skill-damage')?.value) ?? 20;
        data.skill_cost = parseInt($('item-skill-cost')?.value) ?? 10;
        data.skill_probability = parseInt($('item-skill-probability')?.value) ?? 90;
      }
    }
  }
  if (type === 2) {
    data.base_level = int('item-base-level') || 1;
    data.base_hp = int('item-base-hp');
    data.base_mp = int('item-base-mp');
    data.base_phy_atk = int('item-base-phy-atk');
    data.base_phy_def = int('item-base-phy-def');
    data.base_mag_atk = int('item-base-mag-atk');
    data.base_mag_def = int('item-base-mag-def');
    data.base_hit_rate = int('item-base-hit-rate');
    data.base_dodge_rate = int('item-base-dodge-rate');
    data.base_crit_rate = int('item-base-crit-rate');
  }
  return data;
}

const PAGE_SIZE = 20;
const TYPE_OPTIONS = [
  { v: '', l: '全部分类' },
  { v: '1', l: '消耗品' },
  { v: '2', l: '装备' },
  { v: '3', l: '材料' },
  { v: '4', l: '道具/技能书' },
  { v: '5', l: '多倍卡' },
  { v: '6', l: 'VIP卡' },
];

export async function loadItemList(page = 1) {
  try {
    const typeSel = document.getElementById('item-type-filter');
    const type = typeSel?.value || '';
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (type) params.set('type', type);
    const res = await fetch(`${API_BASE_URL}/admin/item?${params}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('item-list');
    if (!el) return;
    const payload = result.data;
    const list = Array.isArray(payload) ? payload : (payload?.data || []);
    const total = payload?.total ?? list.length;
    const currentPage = payload?.page ?? 1;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    el.innerHTML = `
      <div class="gm-search" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;">
        <select id="item-type-filter" onchange="loadItemList(1)" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;">
          ${TYPE_OPTIONS.map(o => `<option value="${o.v}" ${type === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
        </select>
        <input type="text" placeholder="搜索当前页..." oninput="window._gmFilterTable(this,'item-table')" style="flex:1;min-width:120px;">
      </div>
      <table class="gm-table" id="item-table">
        <thead><tr>
          <th>ID</th><th>名称</th><th>类型</th><th>部位</th>
          <th>回血</th><th>回蓝</th><th>描述</th><th>操作</th>
        </tr></thead>
        <tbody>${list.map(it => `<tr>
          <td>${it.id}</td><td>${escapeHtml(it.name)}</td>
          <td>${TYPE_MAP[it.type] ?? it.type}</td>
          <td>${it.type === 2 && it.pos ? (EQUIP_POS_NAMES[it.pos] ?? it.pos) : '-'}</td>
          <td>${it.hp_restore ?? 0}</td>
          <td>${it.mp_restore ?? 0}</td>
          <td>${escapeHtml(it.description || '')}</td>
          <td>
            <button class="btn btn-info" onclick="editItem(${it.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteItem(${it.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="gm-pagination" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>共 ${total} 条</span>
        <button class="btn btn-info" onclick="loadItemList(1)" ${currentPage <= 1 ? 'disabled' : ''}>首页</button>
        <button class="btn btn-info" onclick="loadItemList(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
        <span>第 ${currentPage} / ${totalPages} 页</span>
        <button class="btn btn-info" onclick="loadItemList(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
        <button class="btn btn-info" onclick="loadItemList(${totalPages})" ${currentPage >= totalPages ? 'disabled' : ''}>末页</button>
      </div>`;

  } catch {
    showToast('加载物品列表失败', 'error');
  }
}

export function addItem() {
  showFormModal('新增物品', buildFormHtml(null), saveItem);
  setTimeout(() => bindItemFormTypeChange(), 0);
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
  } catch { showToast('网络错误', 'error'); }
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
    setTimeout(() => bindItemFormTypeChange(), 0);
  } catch { showToast('网络错误', 'error'); }
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
  } catch { showToast('网络错误', 'error'); }
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
  } catch { showToast('网络错误', 'error'); }
}

export default {
  loadItemList, addItem, saveItem,
  editItem, updateItem, deleteItem
};

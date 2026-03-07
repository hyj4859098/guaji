import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal, escapeHtml } from './core.js';
const API_BASE_URL = getApiBaseUrl();

const TYPE_MAP = { 0: '物理攻击', 1: '魔法攻击' };

function buildFormHtml(s) {
  const v = (key, def = '') => s ? (s[key] ?? def) : def;
  const row = (...cells) => `<div class="gm-form-row">${cells.join('')}</div>`;
  const inp = (label, id, val, type = 'number', extra = '') =>
    `<label>${label}: <input type="${type}" id="${id}" value="${val}" ${type === 'number' ? 'min="0"' : ''} ${extra}></label>`;

  const typeSelect = `<label>类型: <select id="skill-type">
    <option value="0" ${v('type', 0) == 0 ? 'selected' : ''}>物理攻击</option>
    <option value="1" ${v('type', 0) == 1 ? 'selected' : ''}>魔法攻击</option>
  </select></label>`;

  return [
    row(
      inp('名称', 'skill-name', v('name', ''), 'text', 'placeholder="技能名称"'),
      typeSelect
    ),
    row(
      inp('伤害值', 'skill-damage', v('damage', 0)),
      inp('消耗MP', 'skill-cost', v('cost', s?.mp_cost ?? 0)),
      inp('释放概率(%)', 'skill-probability', v('probability', 100), 'number', 'min="0" max="100"')
    ),
    row(
      inp('技能书ID', 'skill-book-id', v('book_id', 0), 'number', 'placeholder="0表示无"')
    )
  ].join('');
}

function collectFormData() {
  const $ = id => document.getElementById(id);
  const int = id => parseInt($(`skill-${id}`)?.value) || 0;
  return {
    name: $('skill-name')?.value || '',
    type: int('type'),
    damage: int('damage'),
    cost: int('cost'),
    probability: int('probability') || 100,
    book_id: int('book-id')
  };
}

export async function loadSkillList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/skill`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }

    const el = document.getElementById('skill-list');
    if (!el) return;
    el.innerHTML = `
      <div class="gm-search"><input type="text" placeholder="搜索技能..." oninput="window._gmFilterTable(this,'skill-table')"></div>
      <table class="gm-table" id="skill-table">
        <thead><tr>
          <th>ID</th><th>名称</th><th>类型</th><th>伤害</th>
          <th>MP消耗</th><th>概率</th><th>技能书ID</th><th>操作</th>
        </tr></thead>
        <tbody>${result.data.map(s => `<tr>
          <td>${s.id}</td><td>${escapeHtml(s.name)}</td>
          <td>${TYPE_MAP[s.type] ?? s.type}</td>
          <td>${s.damage ?? 0}</td>
          <td>${s.cost ?? s.mp_cost ?? 0}</td>
          <td>${s.probability ?? 100}%</td>
          <td>${s.book_id ?? 0}</td>
          <td>
            <button class="btn btn-info" onclick="editSkill(${s.id})">编辑</button>
            <button class="btn btn-danger" onclick="deleteSkill(${s.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;

  } catch {
    showToast('加载技能列表失败', 'error');
  }
}

export async function editSkill(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/skill/${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code !== 0) { showToast(result.msg || '获取失败', 'error'); return; }
    const skill = result.data;
    showFormModal('编辑技能', `<input type="hidden" id="skill-id" value="${skill.id}">${buildFormHtml(skill)}`, updateSkill);
  } catch { showToast('网络错误', 'error'); }
}

export async function updateSkill() {
  const id = parseInt(document.getElementById('skill-id')?.value);
  const data = collectFormData();
  if (!data.name) { showToast('请填写名称', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/skill/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.code === 0) { showToast('技能更新成功'); hideFormModal(); loadSkillList(); }
    else showToast(result.msg || '更新失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function deleteSkill(id) {
  if (!confirm('确定要删除这个技能吗？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/skill/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();
    if (result.code === 0) { showToast('技能删除成功'); loadSkillList(); }
    else showToast(result.msg || '删除失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export default {
  loadSkillList,
  editSkill, updateSkill, deleteSkill
};

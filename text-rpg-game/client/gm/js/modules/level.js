import { getToken, getApiBaseUrl, showToast, showFormModal, hideFormModal } from './core.js';

const API = getApiBaseUrl();

function authHeaders(json) {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function formHtml(d) {
  const v = (k, def = '') => (d && d[k] != null) ? d[k] : def;
  return `
    <div class="gm-form-row">
      <label>等级: <input type="number" id="level-level" value="${v('level')}" min="1"></label>
      <label>所需经验: <input type="number" id="level-exp" value="${v('exp')}" min="0"></label>
    </div>`;
}

function readForm() {
  return {
    level: parseInt(document.getElementById('level-level')?.value) || 0,
    exp: parseInt(document.getElementById('level-exp')?.value) || 0,
  };
}

export async function loadLevelList() {
  try {
    const r = await fetch(`${API}/admin/level`, { headers: authHeaders() });
    const result = await r.json();
    if (result.code !== 0) { showToast(result.msg || '加载失败', 'error'); return; }
    const el = document.getElementById('level-list');
    if (!el) return;
    const list = result.data || [];
    el.innerHTML = `
      <div class="gm-search"><input type="text" id="level-search" placeholder="搜索等级..." oninput="window._gmFilterTable(this,'level-table')"></div>
      <table class="gm-table" id="level-table">
        <thead><tr><th>等级</th><th>所需经验</th><th>操作</th></tr></thead>
        <tbody>${list.map(l => {
          const id = l.id;
          return id != null ? `<tr>
            <td>${l.level}</td><td>${l.exp}</td>
            <td>
              <button class="btn btn-info" onclick="editLevel('${id}', ${l.level}, ${l.exp})">编辑</button>
              <button class="btn btn-danger" onclick="deleteLevel('${id}')">删除</button>
            </td>
          </tr>` : `<tr><td>${l.level}</td><td>${l.exp}</td><td><span style="color:#999">无ID</span></td></tr>`;
        }).join('')}</tbody>
      </table>`;
  } catch {
    showToast('加载等级经验列表失败', 'error');
  }
}


export function addLevelExp() {
  showFormModal('新增等级经验', formHtml(null), saveLevelExp);
}

export async function saveLevelExp() {
  const data = readForm();
  if (data.level < 1) { showToast('请填写有效的等级', 'error'); return; }
  if (data.exp < 0) { showToast('请填写有效的经验值', 'error'); return; }
  try {
    const r = await fetch(`${API}/admin/level`, {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('等级经验新增成功'); hideFormModal(); loadLevelList(); }
    else showToast(result.msg || '失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export function editLevel(id, level, exp) {
  showFormModal('编辑等级经验', formHtml({ level, exp }), () => updateLevelExp(id));
}

export async function updateLevelExp(id) {
  const data = readForm();
  if (data.level < 1) { showToast('请填写有效的等级', 'error'); return; }
  if (data.exp < 0) { showToast('请填写有效的经验值', 'error'); return; }
  try {
    const r = await fetch(`${API}/admin/level/${id}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify(data)
    });
    const result = await r.json();
    if (result.code === 0) { showToast('等级经验更新成功'); hideFormModal(); loadLevelList(); }
    else showToast(result.msg || '失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export async function deleteLevel(id) {
  if (!confirm('确定要删除这条等级经验吗？')) return;
  try {
    const r = await fetch(`${API}/admin/level/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await r.json();
    if (result.code === 0) { showToast('等级经验删除成功'); loadLevelList(); }
    else showToast(result.msg || '失败', 'error');
  } catch { showToast('网络错误', 'error'); }
}

export default { loadLevelList, addLevelExp, saveLevelExp, editLevel, updateLevelExp, deleteLevel };

/**
 * GM 工具核心模块：API 配置、Token、提示、登出、Token 验证
 */

/** 装备部位（唯一数据源，与 item.pos / equip_base.pos 一致） */
export const EQUIP_POS_NAMES = { 1: '武器', 2: '衣服', 3: '腰带', 4: '裤子', 5: '鞋子', 6: '戒指', 7: '项链', 8: '坐骑' };

export function posOptions(selected) {
  return Object.entries(EQUIP_POS_NAMES)
    .map(([v, n]) => `<option value="${v}" ${String(selected) === String(v) ? 'selected' : ''}>${n}</option>`)
    .join('');
}
// 使用相对路径，本地和服务器均可访问
export const API_BASE_URL = (typeof window !== 'undefined' && window.location?.origin) ? `${window.location.origin}/api` : '/api';

export function getToken() {
  return localStorage.getItem('gm_token');
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

export function logout() {
  localStorage.removeItem('gm_token');
  window.location.href = 'login.html';
  showToast('已退出登录');
}

export function showFormModal(title, bodyHtml, onSave) {
  const overlay = document.getElementById('gm-modal-overlay');
  const box = document.getElementById('gm-modal-box');
  box.innerHTML = `<h4>${title}</h4>${bodyHtml}<div class="gm-form-actions"><button class="btn btn-primary" id="gm-modal-save">保存</button><button class="btn btn-danger" onclick="hideFormModal()">取消</button></div>`;
  overlay.classList.remove('hidden');
  box.classList.remove('hidden');
  box.querySelector('#gm-modal-save').addEventListener('click', () => { if (onSave) onSave(); });
}

export function hideFormModal() {
  document.getElementById('gm-modal-overlay')?.classList.add('hidden');
  document.getElementById('gm-modal-box')?.classList.add('hidden');
}

/** HTML 特殊字符转义，防止 XSS */
export function escapeHtml(str) {
  if (typeof str !== 'string' && str != null) str = String(str);
  if (!str) return '';
  return str.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
}

/**
 * 验证 Token，成功返回 true，失败则跳转登录页
 */
export async function verifyToken() {
  const token = getToken();
  if (!token || token === 'null' || token === 'undefined') {
    window.location.href = 'login.html';
    return false;
  }
  try {
    const r = await fetch(`${API_BASE_URL}/admin/monster`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await r.json();
    if (result.code === 0) return true;
    localStorage.removeItem('gm_token');
    window.location.href = 'login.html';
    return false;
  } catch {
    localStorage.removeItem('gm_token');
    window.location.href = 'login.html';
    return false;
  }
}

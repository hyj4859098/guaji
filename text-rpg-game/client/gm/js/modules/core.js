/**
 * GM 工具核心模块：API 配置、Token、提示、登出、Token 验证
 */
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
  } catch (e) {
    localStorage.removeItem('gm_token');
    window.location.href = 'login.html';
    return false;
  }
}

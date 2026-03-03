/**
 * GM 工具：缓存管理、玩家查询
 */
import { getToken, getApiBaseUrl, showToast } from './core.js';

const API_BASE_URL = getApiBaseUrl();

export async function clearCache(type) {
  try {
    const r = await fetch(`${API_BASE_URL}/admin/clear-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ type })
    });
    const result = await r.json();
    if (result.code === 0) showToast('缓存清除成功');
    else showToast(result.msg || '清除失败', 'error');
  } catch (e) {
    showToast('网络错误', 'error');
  }
}

export async function loadItemSelect() {
  try {
    const r = await fetch(`${API_BASE_URL}/admin/player/items`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await r.json();
    const sel = document.getElementById('give-item');
    if (!sel || result.code !== 0) return;
    sel.innerHTML = '<option value="">请选择物品</option>' +
      result.data.map(i => `<option value="${i.id}">${i.name} (id=${i.id}, type=${i.type})</option>`).join('');
  } catch (e) { /* ignore */ }
}

export async function giveItemToPlayer() {
  const uid = document.getElementById('give-uid')?.value;
  const itemId = document.getElementById('give-item')?.value;
  const count = document.getElementById('give-count')?.value || 1;
  if (!uid || !itemId) { showToast('请填写UID和选择物品', 'error'); return; }
  try {
    const r = await fetch(`${API_BASE_URL}/admin/player/give-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ uid: Number(uid), item_id: Number(itemId), count: Number(count) })
    });
    const result = await r.json();
    if (result.code === 0) showToast(`发放成功: ${result.data.item_name} ×${result.data.count}`);
    else showToast(result.msg || '发放失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function giveGoldToPlayer() {
  const uid = document.getElementById('gold-uid')?.value;
  const amount = document.getElementById('gold-amount')?.value;
  if (!uid || !amount) { showToast('请填写UID和金额', 'error'); return; }
  try {
    const r = await fetch(`${API_BASE_URL}/admin/player/give-gold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ uid: Number(uid), amount: Number(amount) })
    });
    const result = await r.json();
    if (result.code === 0) showToast(`发放成功: +${result.data.amount} 金币，当前: ${result.data.gold}`);
    else showToast(result.msg || '发放失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function setPlayerVip() {
  const uid = document.getElementById('vip-uid')?.value;
  const days = document.getElementById('vip-days')?.value || 0;
  if (!uid) { showToast('请填写UID', 'error'); return; }
  try {
    const r = await fetch(`${API_BASE_URL}/admin/player/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ uid: Number(uid), vip_level: Number(days) > 0 ? 1 : 0, duration_hours: Number(days) * 24 })
    });
    const result = await r.json();
    if (result.code === 0) {
      const expire = result.data.vip_expire_time;
      const info = expire > 0 ? new Date(expire * 1000).toLocaleDateString() + ' 到期' : '已取消';
      showToast(`VIP设置成功: ${info}`);
    } else showToast(result.msg || '设置失败', 'error');
  } catch (e) { showToast('网络错误', 'error'); }
}

export async function getPlayerInfo() {
  const uid = document.getElementById('player-uid')?.value;
  if (!uid) {
    showToast('请输入玩家UID', 'error');
    return;
  }
  try {
    const r = await fetch(`${API_BASE_URL}/admin/player/${uid}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await r.json();
    if (result.code === 0) {
      const el = document.getElementById('player-info');
      if (el) el.innerHTML = `
        <h4>玩家信息</h4>
        <div style="border: 1px solid #ddd; padding: 10px;">
          <p>ID: ${result.data.id}</p>
          <p>名称: ${result.data.name}</p>
          <p>等级: ${result.data.level}</p>
          <p>经验: ${result.data.exp}</p>
          <p>金币: ${result.data.gold}</p>
          <p>生命值: ${result.data.hp}/${result.data.max_hp}</p>
        </div>
      `;
    } else {
      showToast(result.msg || '查询失败', 'error');
    }
  } catch (e) {
    showToast('网络错误', 'error');
  }
}

const UI = {
  showToast(message, type) {
    if (!type) type = this._detectMsgType(message);
    const box = document.getElementById('chatMessages');
    if (box) {
      this.appendSystemMessage(message, type);
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 1000;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  _detectMsgType(msg) {
    if (/成功/.test(msg)) return 'success';
    if (/失败|错误|异常|不足|已达/.test(msg)) return 'error';
    if (/交易|邀请/.test(msg)) return 'trade';
    return 'info';
  },

  appendSystemMessage(message, type = 'info') {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg-system chat-msg-${type}`;
    msg.innerHTML = `<span class="chat-time">${timeStr}</span><span class="chat-sys-tag">系统</span><span class="chat-text">${message.replace(/</g,'&lt;')}</span>`;
    box.appendChild(msg);
    if (box.children.length > 200) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  },

  showLoading() {
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.className = 'loading';
    loading.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
    `;
    loading.innerHTML = '<div style="color: white;">加载中...</div>';
    document.body.appendChild(loading);
  },

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.remove();
    }
  },

  showModal(content, options = {}) {
    const modal = document.createElement('div');
    modal.id = 'modal';
    const useAuthBg = options.type === 'auth' || options.type === 'createPlayer';
    modal.className = useAuthBg ? 'modal-auth' : '';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    if (!useAuthBg) modal.style.background = 'rgba(0, 0, 0, 0.65)';
    const isAuth = options.type === 'auth';
    const isCreatePlayer = options.type === 'createPlayer';
    const useAuthPanel = isAuth || isCreatePlayer;
    let innerClass = 'modal-inner';
    if (isAuth) innerClass += ' auth-panel';
    if (isCreatePlayer) innerClass += ' auth-panel create-player';
    const innerStyle = useAuthPanel ? '' : 'background: #16213e; padding: 24px; border-radius: 8px; max-width: 500px;';
    modal.innerHTML = `
      <div class="${innerClass}" style="${innerStyle}">
        ${content}
      </div>
    `;
    document.body.appendChild(modal);
  },

  hideModal() {
    const modal = document.getElementById('modal');
    if (modal) {
      modal.remove();
    }
  },

  /** 被踢下线时显示弹窗，用户点击确定后刷新 */
  showKickAlert(message, onConfirm) {
    const modal = document.createElement('div');
    modal.id = 'kick-alert';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    `;
    const escaped = String(message || '账号在其他地方登录').replace(/</g, '&lt;');
    modal.innerHTML = `
      <div style="background: #1e293b; padding: 24px; border-radius: 8px; max-width: 360px; text-align: center;">
        <p style="color: #f87171; font-size: 18px; margin: 0 0 20px;">${escaped}</p>
        <button class="auth-btn auth-btn-primary" id="kick-alert-ok" style="padding: 10px 24px;">确定</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#kick-alert-ok').onclick = () => {
      modal.remove();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
};

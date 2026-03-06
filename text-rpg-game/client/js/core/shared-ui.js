/**
 * 公共 UI 组件：Pagination, Popup, TabSwitcher
 * 各页面统一使用，避免重复实现。
 */
const SharedUI = {
  /**
   * 渲染分页器 HTML
   * @param {object} opts - { currentPage, totalPages, total, onPage }
   *   onPage: 点击回调函数名，如 "AuctionPage.goPage"
   * @returns {string} HTML
   */
  renderPager({ currentPage, totalPages, total, onPage }) {
    if (totalPages <= 1) return '';
    const buttons = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      let p = currentPage - 2 + i;
      if (p < 1) p = i + 1;
      if (p > totalPages) p = totalPages - (4 - i);
      if (p < 1) p = 1;
      return `<button class="pager-btn ${p === currentPage ? 'active' : ''}" onclick="${onPage}(${p})">${p}</button>`;
    }).join('');

    return `
      <div class="pager">
        ${currentPage > 1 ? `<button class="pager-btn" onclick="${onPage}(${currentPage - 1})">上一页</button>` : ''}
        ${buttons}
        ${currentPage < totalPages ? `<button class="pager-btn" onclick="${onPage}(${currentPage + 1})">下一页</button>` : ''}
      </div>
      <div class="pager-info">共 ${total} 件 · 第 ${currentPage}/${totalPages} 页</div>
    `;
  },

  /**
   * 渲染 Tab 切换器 HTML
   * @param {object} opts - { tabs, currentKey, onSwitch }
   *   tabs: [{ key, label }]
   *   onSwitch: 切换回调，如 "ShopPage.switchShopType"
   * @returns {string} HTML
   */
  renderTabs({ tabs, currentKey, onSwitch }) {
    return `<div class="tab-pills">${
      tabs.map(t => `<span class="tab-pill ${currentKey === t.key ? 'active' : ''}" onclick="${onSwitch}(${typeof t.key === 'string' ? "'" + t.key + "'" : t.key})">${t.label}</span>`).join('')
    }</div>`;
  },

  /**
   * 显示确认弹窗（overlay + popup）
   * @param {object} opts - { title, bodyHtml, onOk, okText, cancelText }
   * @returns {{ overlay: HTMLElement, popup: HTMLElement, remove: Function }}
   */
  showPopup({ title, bodyHtml, onOk, okText = '确定', cancelText = '取消' }) {
    SharedUI.removePopups();
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay shared-popup-overlay';
    overlay.onclick = () => SharedUI.removePopups();
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'popup-panel shared-popup-panel';
    popup.onclick = (e) => e.stopPropagation();
    popup.innerHTML = `
      <div class="popup-title">${title}</div>
      ${bodyHtml}
      <div class="popup-btns">
        ${onOk ? `<button class="btn btn-ok" id="shared-popup-ok">${okText}</button>` : ''}
        <button class="btn btn-cancel" id="shared-popup-cancel">${cancelText}</button>
      </div>
    `;
    document.body.appendChild(popup);

    const remove = () => SharedUI.removePopups();
    popup.querySelector('#shared-popup-cancel')?.addEventListener('click', remove);
    if (onOk) {
      popup.querySelector('#shared-popup-ok')?.addEventListener('click', () => onOk(remove));
    }

    return { overlay, popup, remove };
  },

  removePopups() {
    document.querySelectorAll('.shared-popup-overlay, .shared-popup-panel').forEach(el => el.remove());
  },
};

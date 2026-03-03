/**
 * RefreshBus - 统一数据刷新总线
 *
 * 所有数据变更（API 响应、WebSocket 推送）统一通过 RefreshBus.emit() 通知，
 * 各页面通过 RefreshBus.on() 订阅，实现：
 * - 单一入口，无重复刷新逻辑
 * - 新增功能只需订阅对应事件
 * - 各页面自行判断是否渲染（如 battle 仅在当前页时渲染）
 *
 * 使用方式：
 * 1. 数据变更时：RefreshBus.emit('player', data)
 * 2. 页面订阅：在 main.js setupRefreshBus() 中注册 RefreshBus.on('player', handler)
 *
 * 新增数据类型/页面时：
 * - 在 setupRefreshBus() 中增加 RefreshBus.on('xxx', handler)
 * - 任何 API/WS 变更时调用 RefreshBus.emit('xxx', data)
 * - 无需在各业务模块中重复写刷新逻辑
 */
const RefreshBus = {
  _handlers: {}, // { 'player': [fn1, fn2], 'bag': [fn1] }

  /**
   * 订阅数据变更
   * @param {string} type - 数据类型：'player' | 'bag' | 'equip' | 'skill' | ...
   * @param {function} handler - 回调 (data) => void
   */
  on(type, handler) {
    if (!this._handlers[type]) this._handlers[type] = [];
    this._handlers[type].push(handler);
  },

  /**
   * 发布数据变更（统一入口）
   * @param {string} type - 数据类型
   * @param {any} data - 新数据
   */
  emit(type, data) {
    // 先更新 State（如有）
    if (type === 'player' && data && typeof State !== 'undefined') {
      State.setPlayer(data);
    }
    if (type === 'bag' && data && typeof State !== 'undefined' && State.setBag) {
      State.setBag(data);
    }

    const handlers = this._handlers[type];
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(data);
        } catch (e) {
          console.error('[RefreshBus] handler error:', e);
        }
      });
    }
  }
};

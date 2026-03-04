const WS = {
  ws: null,
  handlers: {},
  _connecting: false,
  reconnectTimer: null,
  reconnectBackoff: 0,
  _heartbeatTimer: null,
  RECONNECT_BASE_MS: 3000,
  RECONNECT_MAX_MS: 30000,
  CLIENT_HEARTBEAT_MS: 25000,

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  },

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(this.RECONNECT_BASE_MS * Math.pow(2, this.reconnectBackoff), this.RECONNECT_MAX_MS);
    this.reconnectBackoff = Math.min(this.reconnectBackoff + 1, 10);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  },

  connect() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const wsHost = location.hostname;
    const wsPort = location.port === '3000' ? '3001' : (location.port || '3001');
    const url = `ws://${wsHost}:${wsPort}?token=${token}`;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this._connecting) return;
    this._connecting = true;
    // 创建新连接前清理旧连接，避免僵尸引用和重复回调
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connecting = false;
      this.reconnectBackoff = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = setInterval(() => this.send({ type: 'heartbeat' }), this.CLIENT_HEARTBEAT_MS);
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        if (type === 'heartbeat') {
          this.send({ type: 'heartbeat' });
          return;
        }

        const fns = this.handlers[type];
        if (fns) {
          fns.forEach(fn => {
            try { fn(data); } catch (e) { console.error('[WS handler error]', e); }
          });
        }
      } catch (error) {
        console.error('WS Error:', error);
      }
    };

    this.ws.onclose = () => {
      this._connecting = false;
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
      console.log('WebSocket disconnected');
      if (localStorage.getItem('token')) this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this._connecting = false;
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
      console.error('WS Error:', error);
      if (localStorage.getItem('token')) this.scheduleReconnect();
    };
  },

  ensureConnected(maxWaitMs = 3000) {
    if (this.isConnected()) return Promise.resolve(true);
    if (!localStorage.getItem('token')) return Promise.resolve(false);
    this.connect();
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (this.isConnected()) return resolve(true);
        if (Date.now() - start > maxWaitMs) return resolve(false);
        setTimeout(check, 100);
      };
      setTimeout(check, 100);
    });
  },

  on(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
  },

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
};

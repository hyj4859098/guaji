const WS = {
  ws: null,
  handlers: {},
  _connecting: false,
  reconnectTimer: null,
  reconnectBackoff: 0,
  _heartbeatTimer: null,
  _clientConfig: null,
  _serverReady: false,
  RECONNECT_BASE_MS: 3000,
  RECONNECT_MAX_MS: 30000,
  CLIENT_HEARTBEAT_MS: 25000,

  async _getWsUrl() {
    if (this._clientConfig?.wsUrl) return this._clientConfig.wsUrl;
    try {
      const base = `${location.protocol}//${location.host}/api`;
      const res = await fetch(`${base}/config/client`);
      const json = await res.json();
      if (json?.code === 0 && json?.data?.wsUrl) {
        this._clientConfig = json.data;
        return json.data.wsUrl;
      }
    } catch { /* 降级到本地推断 */ }
    const wsPort = location.port === '3000' ? '3001' : (location.port || '3001');
    return `ws://${location.hostname}:${wsPort}`;
  },

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

  async connect() {
    const token = State.token || localStorage.getItem('token');
    if (!token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this._connecting) return;
    this._connecting = true;
    this._serverReady = false;

    const baseUrl = await this._getWsUrl();
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}token=${token}`;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try { this.ws.close(); } catch {}
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
      this.send({ type: 'heartbeat' });
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = event?.data;
        if (raw == null || typeof raw !== 'string') return;
        const message = JSON.parse(raw);
        const { type, data } = message || {};

        if (type === 'heartbeat') {
          if (!this._serverReady) {
            this._serverReady = true;
            console.log('WebSocket server ready');
          }
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
      this._serverReady = false;
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
      console.log('WebSocket disconnected');
      if (State.token) this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this._connecting = false;
      this._serverReady = false;
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
      console.error('WS Error:', error);
      if (State.token) this.scheduleReconnect();
    };
  },

  ensureConnected(maxWaitMs = 5000) {
    if (this._serverReady) return Promise.resolve(true);
    if (!State.token) return Promise.resolve(false);
    if (!this._connecting && !this.isConnected()) this.connect();
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (this._serverReady) return resolve(true);
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

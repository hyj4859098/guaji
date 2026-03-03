const WS = {
  ws: null,
  handlers: {},
  _connecting: false,

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  },

  connect() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = `ws://localhost:3001?token=${token}`;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this._connecting) return;
    this._connecting = true;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connecting = false;
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
      console.log('WebSocket disconnected');
      if (localStorage.getItem('token')) setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (error) => {
      this._connecting = false;
      console.error('WS Error:', error);
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

WS.connect();

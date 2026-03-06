const API = {
  get baseUrl() {
    return `${location.protocol}//${location.host}/api`;
  },

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (State.token) {
      headers['Authorization'] = `Bearer ${State.token}`;
    }

    try {
      const requestUrl = `${this.baseUrl}${url}`;
      const response = await fetch(requestUrl, {
        ...options,
        headers
      });

      if (response.status === 401) {
        State.clear();
        if (typeof resetToLogin === 'function') resetToLogin();
        else window.location.reload();
        return { code: 40002, msg: '登录已过期', data: null };
      }

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        return { code: 500, msg: '服务器返回格式异常', data: null };
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      return {
        code: 500,
        msg: '网络错误，请检查网络后重试',
        data: null
      };
    }
  },

  get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${url}${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  },

  post(url, data = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(url, data = {}) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(url) {
    return this.request(url, {
      method: 'DELETE'
    });
  }
};

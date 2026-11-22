/**
 * API Wrapper Service
 */
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('bsg_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('bsg_token', token);
    } else {
      localStorage.removeItem('bsg_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.setToken(null);
        localStorage.removeItem('bsg_user');
        window.location.reload();
        throw new Error('Sesi Anda telah kedaluwarsa. Silakan masuk kembali.');
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Error HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(fullUrl, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

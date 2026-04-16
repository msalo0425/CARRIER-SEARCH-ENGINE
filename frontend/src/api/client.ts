import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('bcl_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      // Clear storage directly (avoids importing the store, which would create a
      // circular dependency: api → store → api)
      localStorage.removeItem('bcl_token');
      localStorage.removeItem('bcl_user');
      window.location.replace('/login');
    }
    return Promise.reject(err);
  }
);

export default api;

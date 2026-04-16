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
      localStorage.removeItem('bcl_token');
      localStorage.removeItem('bcl_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

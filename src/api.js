import axios from 'axios';

const defaultApiRoot = window?.location?.hostname === 'localhost'
  ? 'http://localhost:5077'
  : 'https://api.archive.innov.rw';

export const API_ROOT =
  process.env.REACT_APP_API_BASE_URL || defaultApiRoot;

const api = axios.create({
  baseURL: `${API_ROOT.replace(/\/$/, '')}/api`,
});

// Automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Automatically handle unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('email');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

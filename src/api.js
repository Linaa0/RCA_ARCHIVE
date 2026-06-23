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

export default api;

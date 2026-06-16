import axios from 'axios';

export const API_ROOT =
  import.meta.env.VITE_API_BASE_URL || 'https://api.archive.innov.rw';

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

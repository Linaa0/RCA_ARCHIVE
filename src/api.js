import axios from "axios";
import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "./utils/auth";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token && !(isTokenExpired(token) || isSessionExpired())) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      clearAuthStorage();
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };

import axios from "axios";
import { API_BASE_URL } from "./config";
import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "./utils/auth";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token && !(isTokenExpired(token) || isSessionExpired())) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
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

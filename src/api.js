import axios from "axios";
import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "./utils/auth";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token && !(isTokenExpired(token) || isSessionExpired())) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Let axios set the correct Content-Type automatically for FormData.
  // Only set JSON header when the body is not FormData.
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

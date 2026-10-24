import axios from "axios";
import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "../utils/auth";

const IS_DEV = import.meta.env.DEV;
const DEFAULT_API_BASE_URL = "https://api.archive.innov.rw/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "/api";

export const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token && !(isTokenExpired(token) || isSessionExpired())) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.url && config.url.startsWith("/api/") && API_BASE_URL.endsWith("/api")) {
    config.url = config.url.replace(/^\/api/, "");
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

    if (status === 401) {
      const hadAuth = Boolean(
        error.config?.headers?.Authorization || error.config?.headers?.authorization
      );
      if (hadAuth) {
        clearAuthStorage();
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/signup" &&
          window.location.pathname !== "/"
        ) {
          if (!sessionStorage.getItem("login_notice")) {
            sessionStorage.setItem(
              "login_notice",
              "Your session has expired. Please sign in again."
            );
          }
          window.location.href = `/login?redirect=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };

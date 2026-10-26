import axios from "axios";
import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "../utils/auth.js";

export const DEFAULT_API_BASE_URL = "https://api.archive.innov.rw/api";
export const DEFAULT_API_ROOT = "https://api.archive.innov.rw";

export function normalizeApiUrl(rawUrl, isDev = false) {
  let url = (typeof rawUrl === "string" ? rawUrl : "").trim();
  if (!url) {
    url = isDev ? "/api" : DEFAULT_API_BASE_URL;
  }
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  return url;
}

export function resolveApiRoot(baseUrl, isDev = false) {
  const root = (baseUrl || "").replace(/\/api\/?$/, "");
  if (!root && !isDev) {
    return DEFAULT_API_ROOT;
  }
  return root;
}

const rawEnvApiUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_URL
    : undefined;

const isDev =
  typeof import.meta !== "undefined" && import.meta.env
    ? Boolean(import.meta.env.DEV)
    : false;

export const API_BASE_URL = normalizeApiUrl(rawEnvApiUrl, isDev);
export const API_ROOT = resolveApiRoot(API_BASE_URL, isDev);

export function apiUrl(path = "") {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api/")) {
    if (API_ROOT) {
      return `${API_ROOT}${cleanPath}`;
    }
    return cleanPath;
  }
  if (cleanPath === "/api") {
    return API_BASE_URL;
  }
  return `${API_BASE_URL}${cleanPath}`;
}

export function getApiErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  const status = err?.response?.status;
  if (!err.response || err.code === "ERR_NETWORK" || status === 405) {
    return "The app could not reach the server. Please try again, and tell the administrator if it continues.";
  }
  if (
    status === 404 &&
    (!err.response.data || typeof err.response.data !== "object" || !err.response.data.error)
  ) {
    return "The app could not reach the server. Please try again, and tell the administrator if it continues.";
  }
  return (
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.friendlyMessage ||
    fallback
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

export async function openPaperDownload(paperId) {
  try {
    const { data } = await api.post(`/papers/${paperId}/access-link`);
    if (data?.downloadUrl) {
      window.location.href = apiUrl(data.downloadUrl);
      return;
    }
  } catch (_) {}
  window.location.href = apiUrl(`/papers/${paperId}/download`);
}

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
    const isNetworkError = !error.response || error.code === "ERR_NETWORK";
    const isRouteError = status === 404 || status === 405;
    const hasBackendErrorMessage = typeof error?.response?.data?.error === "string";

    if (isNetworkError || (isRouteError && !hasBackendErrorMessage)) {
      error.friendlyMessage =
        "The app could not reach the server. Please try again, and tell the administrator if it continues.";
    }

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

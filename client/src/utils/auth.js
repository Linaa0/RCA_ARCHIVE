const TOKEN_KEY = "token";
const EMAIL_KEY = "email";
const USERNAME_KEY = "username";
const ROLE_KEY = "role";
const SESSION_EXPIRES_AT_KEY = "auth_expires_at";
const DEFAULT_SESSION_HOURS = 12;

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  return "";
}

export function decodeJwt(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    return null;
  }
}

export function isTokenExpired(token, leewaySeconds = 30) {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + leewaySeconds;
}

export function getSessionExpiresAt() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSessionExpired() {
  const expiresAt = getSessionExpiresAt();
  if (!expiresAt) {
    return false;
  }

  return Date.now() >= expiresAt;
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

const MUST_CHANGE_PASSWORD_KEY = "must_change_password";
const AUTH_CHANNEL_NAME = "rca_auth_channel";

export function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  localStorage.removeItem("rca_user_gender");
}

export function broadcastLogout() {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.BroadcastChannel === "function") {
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.postMessage({ type: "LOGOUT", timestamp: Date.now() });
      channel.close();
    }
  } catch (_) {}
}

export function initAuthSync(onLogout) {
  if (typeof window === "undefined") return () => {};

  let channel = null;
  try {
    if (typeof window.BroadcastChannel === "function") {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "LOGOUT") {
          clearAuthStorage();
          if (typeof onLogout === "function") {
            onLogout();
          } else if (
            window.location.pathname !== "/login" &&
            window.location.pathname !== "/signup" &&
            window.location.pathname !== "/"
          ) {
            window.location.href = "/login";
          }
        }
      };
    }
  } catch (_) {}

  const storageHandler = (event) => {
    if (event.key === TOKEN_KEY && !event.newValue) {
      clearAuthStorage();
      if (typeof onLogout === "function") {
        onLogout();
      } else if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/signup" &&
        window.location.pathname !== "/"
      ) {
        window.location.href = "/login";
      }
    }
  };
  window.addEventListener("storage", storageHandler);

  return () => {
    if (channel) {
      try {
        channel.close();
      } catch (_) {}
    }
    window.removeEventListener("storage", storageHandler);
  };
}

export async function performLogout(apiBaseUrl = "/api") {
  const token = getStoredToken();
  if (token) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = apiBaseUrl.endsWith("/api") ? `${apiBaseUrl}/logout` : `${apiBaseUrl}/api/logout`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (_) {}
  }

  clearAuthStorage();
  broadcastLogout();
  if (typeof window !== "undefined") {
    if (
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/signup" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/login";
    }
  }
}

export async function performLogoutAll(apiBaseUrl = "/api") {
  const token = getStoredToken();
  if (token) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const url = apiBaseUrl.endsWith("/api") ? `${apiBaseUrl}/logout-all` : `${apiBaseUrl}/api/logout-all`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (_) {}
  }

  clearAuthStorage();
  broadcastLogout();
  if (typeof window !== "undefined") {
    if (
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/signup" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/login";
    }
  }
}

export function isAuthenticated() {
  const token = getStoredToken();
  return Boolean(token && !isTokenExpired(token) && !isSessionExpired());
}

export function getStoredRole() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(ROLE_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return {
      token: null,
      email: null,
      username: null,
      role: null,
      mustChangePassword: false,
    };
  }

  return {
    token: localStorage.getItem(TOKEN_KEY),
    email: localStorage.getItem(EMAIL_KEY),
    username: localStorage.getItem(USERNAME_KEY),
    role: localStorage.getItem(ROLE_KEY),
    mustChangePassword: localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "true",
  };
}

export function setStoredMustChangePassword(mustChange) {
  if (typeof window === "undefined") return;
  if (mustChange) {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "true");
  } else {
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }
}

export function persistAuth({ token, email, username, role, mustChangePassword, user, expiresAt: customExpiresAt }) {
  if (typeof window === "undefined") {
    return;
  }

  const tokenPayload = decodeJwt(token);
  const tokenExpiresAt = tokenPayload?.exp ? tokenPayload.exp * 1000 : null;
  const serverExpiresAt = customExpiresAt ? new Date(customExpiresAt).getTime() : null;
  const sessionExpiresAt = serverExpiresAt || (Date.now() + 30 * 60 * 1000); // 30 mins
  const expiresAt = tokenExpiresAt ? Math.min(tokenExpiresAt, sessionExpiresAt) : sessionExpiresAt;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  if (email) {
    localStorage.setItem(EMAIL_KEY, email);
  } else if (user?.email) {
    localStorage.setItem(EMAIL_KEY, user.email);
  }

  if (username) {
    localStorage.setItem(USERNAME_KEY, username);
  } else if (user?.username) {
    localStorage.setItem(USERNAME_KEY, user.username);
  }

  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  } else if (user?.role) {
    localStorage.setItem(ROLE_KEY, user.role);
  }

  const shouldChange = mustChangePassword !== undefined
    ? Boolean(mustChangePassword)
    : Boolean(user?.mustChangePassword);
  if (shouldChange) {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "true");
  } else {
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }

  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
}

// Where each role lands after login / when opening "/"
export function getHomePathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/home";
}

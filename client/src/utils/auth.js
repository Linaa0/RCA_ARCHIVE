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

export function persistAuth({ token, email, username, role, mustChangePassword, user }) {
  if (typeof window === "undefined") {
    return;
  }

  const tokenPayload = decodeJwt(token);
  const tokenExpiresAt = tokenPayload?.exp ? tokenPayload.exp * 1000 : null;
  const sessionExpiresAt = Date.now() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000;
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

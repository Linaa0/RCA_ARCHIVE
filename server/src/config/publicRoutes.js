"use strict";

const PUBLIC_ROUTES = [
  { method: "GET", path: "/api/health" },
  { method: "POST", path: "/api/login" },
  { method: "POST", path: "/api/signup" },
  { method: "POST", path: "/api/send-otp" },
  { method: "POST", path: "/api/send-teacher-otp" },
  { method: "POST", path: "/api/verify-otp" },
  { method: "POST", path: "/api/forgot-password" },
  { method: "POST", path: "/api/reset-password" },
  { method: "POST", path: "/api/auth/refresh" },
  { method: "POST", path: "/api/refresh" },
  { method: "GET", path: "/api/public/curriculum" },
  { method: "GET", path: "/api/public/summary" },
  { method: "GET", path: "/api/papers/access/:token/:mode" },
];

function normalizePath(p) {
  if (!p || typeof p !== "string") return "/";
  const withoutQuery = p.split("?")[0].split("#")[0];
  const cleaned = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "");
  return cleaned.startsWith("/") ? cleaned : "/" + cleaned;
}

function matchRoutePath(pattern, actual) {
  if (pattern === actual) return true;
  const pSegs = pattern.split("/").filter(Boolean);
  const aSegs = actual.split("/").filter(Boolean);
  if (pSegs.length !== aSegs.length) return false;
  for (let i = 0; i < pSegs.length; i++) {
    if (pSegs[i].startsWith(":")) continue;
    if (pSegs[i] !== aSegs[i]) return false;
  }
  return true;
}

function isPublicRoute(method, rawPath) {
  const normMethod = (method || "").toUpperCase();
  const path = normalizePath(rawPath);

  // Normalize path so both /api/... and /... match
  const apiPath = path.startsWith("/api") ? path : "/api" + path;

  return PUBLIC_ROUTES.some((route) => {
    return route.method === normMethod && matchRoutePath(route.path, apiPath);
  });
}

module.exports = {
  PUBLIC_ROUTES,
  isPublicRoute,
  normalizePath,
};

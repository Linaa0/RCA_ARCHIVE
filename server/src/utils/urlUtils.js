const { FRONTEND_BASE_URL, NODE_ENV } = require("../config/env");

function getFrontendBaseUrl(req) {
  if (FRONTEND_BASE_URL) {
    return FRONTEND_BASE_URL.replace(/\/$/, "");
  }

  const origin = req?.get?.("origin") || req?.headers?.origin;
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const referer = req?.get?.("referer") || req?.headers?.referer;
  if (referer) {
    try {
      return new URL(referer).origin.replace(/\/$/, "");
    } catch {
      // ignore invalid referer value
    }
  }

  return NODE_ENV === "production" ? "https://rcaarchive.innov.rw" : "http://localhost:3074";
}

function buildPasswordSetupUrl(frontendBaseUrl, token) {
  const defaultBase = NODE_ENV === "production" ? "https://rcaarchive.innov.rw" : "http://localhost:3074";
  const baseUrl = (frontendBaseUrl || defaultBase).replace(/\/$/, "");
  return `${baseUrl}/reset-password/${encodeURIComponent(token)}`;
}

module.exports = {
  getFrontendBaseUrl,
  buildPasswordSetupUrl,
};

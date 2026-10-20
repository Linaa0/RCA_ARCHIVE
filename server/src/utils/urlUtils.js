const { FRONTEND_BASE_URL } = require("../config/env");

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

  return "http://localhost:3074";
}

function buildPasswordSetupUrl(frontendBaseUrl, token) {
  const baseUrl = (frontendBaseUrl || "http://localhost:3074").replace(/\/$/, "");
  return `${baseUrl}/reset-password/${encodeURIComponent(token)}`;
}

module.exports = {
  getFrontendBaseUrl,
  buildPasswordSetupUrl,
};

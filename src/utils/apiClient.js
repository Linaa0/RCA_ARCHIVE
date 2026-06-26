import { clearAuthStorage, getStoredToken, isSessionExpired, isTokenExpired } from "./auth";

function buildHeaders(headers = {}) {
  const token = getStoredToken();
  const authHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }

  return authHeaders;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

export async function requestJson(url, options = {}) {
  const token = getStoredToken();

  if (token && (isTokenExpired(token) || isSessionExpired())) {
    clearAuthStorage();
    const expiredError = new Error("Your session has expired. Please sign in again.");
    expiredError.code = "SESSION_EXPIRED";
    throw expiredError;
  }

  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  const data = await parseResponse(response);

  if (response.status === 401 || response.status === 403) {
    clearAuthStorage();
    const error = new Error(data.message || "You are not authorized to continue.");
    error.code = response.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN";
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.code = "REQUEST_FAILED";
    error.data = data;
    throw error;
  }

  return data;
}

export async function authGet(url, options = {}) {
  return requestJson(url, {
    ...options,
    method: "GET",
  });
}

export async function authPost(url, body, options = {}) {
  return requestJson(url, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function authPut(url, body, options = {}) {
  return requestJson(url, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function authPatch(url, body, options = {}) {
  return requestJson(url, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function authDelete(url, options = {}) {
  return requestJson(url, {
    ...options,
    method: "DELETE",
  });
}

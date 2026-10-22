import api from "../services/api";

export async function requestJson(url, options = {}) {
  const method = (options.method || "GET").toLowerCase();
  let data;
  if (options.body) {
    try {
      data = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    } catch {
      data = options.body;
    }
  }

  const response = await api({
    ...options,
    method,
    url,
    data,
  });

  return response.data;
}

export async function authGet(url, options = {}) {
  const response = await api.get(url, options);
  return response.data;
}

export async function authPost(url, body, options = {}) {
  const response = await api.post(url, body, options);
  return response.data;
}

export async function authPut(url, body, options = {}) {
  const response = await api.put(url, body, options);
  return response.data;
}

export async function authPatch(url, body, options = {}) {
  const response = await api.patch(url, body, options);
  return response.data;
}

export async function authDelete(url, options = {}) {
  const response = await api.delete(url, options);
  return response.data;
}

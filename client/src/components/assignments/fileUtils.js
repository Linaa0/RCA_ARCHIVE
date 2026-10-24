import api from "../../services/api";

export function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// Authenticated download (the token lives in the axios instance, so plain <a href> would not work)
export async function downloadFrom(url, filename, config = {}) {
  const res = await api.get(url, { responseType: "blob", ...config });
  saveBlob(res.data, filename);
}

export async function fetchBlob(url) {
  const res = await api.get(url, { responseType: "blob" });
  return res.data;
}

export async function getBlobErrorMessage(err, fallback = "This file is no longer available.") {
  if (err?.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      if (parsed.error) return parsed.error;
    } catch (_) {}
  }
  if (err?.response?.status === 404) {
    return "This file is no longer available.";
  }
  return err?.response?.data?.error || err?.message || fallback;
}

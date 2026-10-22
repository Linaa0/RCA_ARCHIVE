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

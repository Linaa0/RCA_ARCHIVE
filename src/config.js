const DEFAULT_API_BASE_URL = "https://api.archive.innov.rw/api";

export const API_BASE_URL =
  process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL;

export const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");

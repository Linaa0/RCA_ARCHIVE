const IS_DEV = import.meta.env.DEV;
const DEFAULT_API_BASE_URL = "https://api.archive.innov.rw/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || (IS_DEV ? "/api" : DEFAULT_API_BASE_URL);

export const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");

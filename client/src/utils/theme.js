/**
 * RCA Archive Theme Manager
 * Manages light and dark theme switching with persistent storage and system fallback
 */

export function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("rca_theme");
  if (saved === "light" || saved === "dark") return saved;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const validTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", validTheme);
  try {
    localStorage.setItem("rca_theme", validTheme);
  } catch (e) {
    // Ignore storage errors
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || getInitialTheme();
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

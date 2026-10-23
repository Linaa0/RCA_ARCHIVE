/**
 * RCA Archive Theme Manager
 * Supports Light, Dark, and System modes with immediate DOM application,
 * persistent storage, system preference listener, and event dispatch.
 */

export function getThemePreference() {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem("rca_theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch (err) {
    // Ignore storage errors
  }
  return "system";
}

export function getEffectiveTheme(preference = getThemePreference()) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(preference) {
  if (typeof document === "undefined") return;
  const validPref = preference === "dark" || preference === "light" || preference === "system" ? preference : "system";
  const effective = getEffectiveTheme(validPref);

  document.documentElement.setAttribute("data-theme", effective);

  try {
    localStorage.setItem("rca_theme", validPref);
  } catch (err) {
    // Ignore storage errors
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("rca-theme-change", {
        detail: { preference: validPref, effective },
      })
    );
  }

  return { preference: validPref, effective };
}

export function toggleTheme() {
  const currentEffective = document.documentElement.getAttribute("data-theme") || getEffectiveTheme();
  const next = currentEffective === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

export function getInitialTheme() {
  return getEffectiveTheme();
}

// Global listener for OS system theme changes
if (typeof window !== "undefined" && window.matchMedia) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = (e) => {
    const currentPref = getThemePreference();
    if (currentPref === "system") {
      const nextEffective = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextEffective);
      window.dispatchEvent(
        new CustomEvent("rca-theme-change", {
          detail: { preference: "system", effective: nextEffective },
        })
      );
    }
  };

  if (mql.addEventListener) {
    mql.addEventListener("change", handleMediaChange);
  } else if (mql.addListener) {
    mql.addListener(handleMediaChange);
  }
}

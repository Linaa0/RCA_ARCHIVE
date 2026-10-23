import React, { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "./Icons";
import { getEffectiveTheme, toggleTheme } from "../../utils/theme";

export default function ThemeToggle({ size = "md", className = "" }) {
  const [effectiveTheme, setEffectiveTheme] = useState(getEffectiveTheme());

  useEffect(() => {
    const handleThemeChange = (e) => {
      setEffectiveTheme(e.detail?.effective || getEffectiveTheme());
    };
    window.addEventListener("rca-theme-change", handleThemeChange);
    return () => window.removeEventListener("rca-theme-change", handleThemeChange);
  }, []);

  const isDark = effectiveTheme === "dark";
  const label = `Switch to ${isDark ? "light" : "dark"} mode`;

  const btnSize = size === "sm" ? 36 : 40;
  const iconSize = size === "sm" ? 17 : 19;

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${btnSize}px`,
        height: `${btnSize}px`,
        borderRadius: "50%",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-med)",
        color: "var(--color-ink)",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
        boxShadow: "var(--shadow-xs)",
        flexShrink: 0,
      }}
    >
      {isDark ? <SunIcon size={iconSize} /> : <MoonIcon size={iconSize} />}
    </button>
  );
}

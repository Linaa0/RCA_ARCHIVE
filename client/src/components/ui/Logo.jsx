import React from "react";
import rcaLogo from "../../assets/rca.png";

/**
 * RCA Archive Official Brand Logo
 * - Full-colour shield on light backgrounds
 * - Crisp white silhouette on dark or indigo backgrounds
 * - NO container tile or box behind it
 * - Sizes: Navbar 52px, Sidebar 56px, Auth 120px, Footer 48px
 * - Quicksand 700 wordmark with tight letter spacing
 * - Subtle soft glow/drop shadow tuned for theme
 */
export default function Logo({
  variant = "full",
  size = "md",
  showWordmark = true,
  wordmarkColor,
  className = "",
  style = {},
  onClick,
}) {
  const sizeMap = {
    xs: 24,
    sm: 40,
    md: 52,
    lg: 120,
    navbar: 52,
    sidebar: 60,
    auth: 120,
    footer: 48,
  };

  const pixelSize = typeof size === "number" ? size : (sizeMap[size] || 52);

  const isWhite =
    variant === "white" ||
    variant === "knockout" ||
    variant === "dark";

  // Crisp silhouette for dark/knockout with soft glow; full-color with subtle depth for light
  const imgFilter = isWhite
    ? "brightness(0) invert(1) drop-shadow(0 2px 8px rgba(255, 255, 255, 0.22))"
    : "drop-shadow(0 2px 8px rgba(35, 44, 107, 0.12))";

  const defaultTextColor = isWhite ? "#FFFFFF" : "var(--color-ink, #1B2142)";
  const textColor = wordmarkColor || defaultTextColor;

  return (
    <div
      className={`rca-logo ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: pixelSize >= 80 ? "18px" : pixelSize <= 44 ? "12px" : "14px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        background: "transparent",
        border: "none",
        padding: 0,
        transition: "transform var(--transition-fast)",
        ...style,
      }}
    >
      <img
        src={rcaLogo}
        alt="Rwanda Coding Academy"
        style={{
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          objectFit: "contain",
          filter: imgFilter,
          display: "block",
          flexShrink: 0,
          transition: "filter var(--transition-base), transform var(--transition-fast)",
        }}
      />
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span
            style={{
              fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
              fontWeight: 700,
              fontSize: pixelSize >= 80 ? "1.85rem" : pixelSize <= 48 ? "1.1rem" : "1.3rem",
              letterSpacing: "-0.03em",
              color: textColor,
              whiteSpace: "nowrap",
            }}
          >
            RCA Archive
          </span>
          {pixelSize >= 80 && (
            <span
              style={{
                fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
                fontSize: "0.9rem",
                color: isWhite ? "rgba(255, 255, 255, 0.75)" : "var(--color-muted, #6A7399)",
                fontWeight: 500,
                marginTop: "4px",
                letterSpacing: "-0.01em",
              }}
            >
              Academic Knowledge Portal
            </span>
          )}
        </div>
      )}
    </div>
  );
}

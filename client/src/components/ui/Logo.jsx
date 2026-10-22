import React from "react";
import rcaLogo from "../../assets/rca.png";

/**
 * RCA Archive Official Logo
 * - Full-colour shield on light backgrounds
 * - Crisp white silhouette on dark or indigo backgrounds
 * - No container tile or box
 * - Standard sizes: navbar: 40px, sidebar: 44px, auth: 96px
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
    md: 44,
    lg: 96,
    navbar: 40,
    sidebar: 44,
    auth: 96,
  };

  const pixelSize = typeof size === "number" ? size : (sizeMap[size] || 44);

  const isWhite =
    variant === "white" ||
    variant === "knockout" ||
    variant === "dark";

  const imgFilter = isWhite
    ? "brightness(0) invert(1)"
    : "none";

  const defaultTextColor = isWhite ? "#FFFFFF" : "var(--color-ink, #1B2142)";
  const textColor = wordmarkColor || defaultTextColor;

  return (
    <div
      className={`rca-logo ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: pixelSize >= 80 ? "16px" : pixelSize <= 40 ? "10px" : "12px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        background: "transparent",
        border: "none",
        padding: 0,
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
        }}
      />
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span
            style={{
              fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
              fontWeight: 700,
              fontSize: pixelSize >= 80 ? "1.75rem" : pixelSize <= 40 ? "1.05rem" : "1.25rem",
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
                fontSize: "0.875rem",
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

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
  logoSrc = rcaLogo,
  showWordmark = true,
  showSubtitle = true,
  wordmarkColor,
  layout = "row",
  withPlate = false,
  className = "",
  style = {},
  onClick,
}) {
  const sizeMap = {
    xs: 28,
    sm: 44,
    md: 60,
    lg: 96,
    navbar: 76,
    sidebar: 80,
    auth: 120,
    footer: 72,
  };

  const pixelSize = typeof size === "number" ? size : (sizeMap[size] || 60);

  const isWhite =
    variant === "white" ||
    variant === "knockout" ||
    variant === "dark";

  const showPlate = withPlate || variant === "plate";

  // Crisp silhouette for dark/knockout; full-color with subtle depth for light or plate
  const imgFilter = isWhite && !showPlate
    ? "brightness(0) invert(1) drop-shadow(0 2px 8px rgba(255, 255, 255, 0.22))"
    : "drop-shadow(0 2px 8px rgba(35, 44, 107, 0.12))";

  const defaultTextColor = (isWhite || variant === "white") ? "#FFFFFF" : "var(--color-ink, #1B2142)";
  const textColor = wordmarkColor || defaultTextColor;

  const isColumn = layout === "column";

  return (
    <div
      className={`rca-logo ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        flexDirection: isColumn ? "column" : "row",
        alignItems: isColumn ? "flex-start" : "center",
        gap: isColumn ? "10px" : (pixelSize >= 72 ? "16px" : pixelSize <= 44 ? "10px" : "12px"),
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        background: "transparent",
        border: "none",
        padding: 0,
        transition: "transform var(--transition-fast)",
        ...style,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          ...(showPlate
            ? {
                background: "#FFFFFF",
                borderRadius: "50%",
                padding: `${Math.max(6, Math.round(pixelSize * 0.08))}px`,
                boxShadow: "0 4px 18px rgba(0, 0, 0, 0.18)",
                flexShrink: 0,
              }
            : { flexShrink: 0 }),
        }}
      >
        <img
          src={logoSrc}
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
      </div>
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span
            style={{
              fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
              fontWeight: 700,
              fontSize: pixelSize >= 80 ? "1.6rem" : pixelSize >= 70 ? "1.4rem" : pixelSize <= 48 ? "1.1rem" : "1.25rem",
              letterSpacing: "-0.03em",
              color: textColor,
              whiteSpace: "nowrap",
            }}
          >
            RCA Archive
          </span>
          {showSubtitle && pixelSize >= 76 && (
            <span
              style={{
                fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
                fontSize: "0.85rem",
                color: (isWhite && !showPlate) || wordmarkColor === "#FFFFFF"
                  ? "rgba(255, 255, 255, 0.78)"
                  : "var(--color-muted, #6A7399)",
                fontWeight: 500,
                marginTop: "3px",
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

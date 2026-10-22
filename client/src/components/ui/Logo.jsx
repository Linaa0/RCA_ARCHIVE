import React from "react";
import rcaLogo from "../../assets/rca.png";

/**
 * Clean RCA Archive Logo component
 * - variant: "light" (for white/light backgrounds, full-colour navy/gold shield)
 *            "knockout" (for dark/indigo backgrounds, white silhouette filter)
 * - size: "sm" (navbar: 38-40px), "md" (sidebar: 44px), "lg" (auth hero: 96-110px), "icon"
 * - showWordmark: boolean (whether to render "RCA Archive" text beside it)
 */
export default function Logo({
  variant = "light",
  size = "md",
  showWordmark = true,
  wordmarkColor,
  className = "",
  style = {},
  onClick,
}) {
  const sizeMap = {
    xs: 28,
    sm: 38,
    md: 44,
    lg: 104,
  };

  const pixelSize = sizeMap[size] || (typeof size === "number" ? size : 44);

  const isKnockout = variant === "knockout" || variant === "white";

  const imgFilter = isKnockout
    ? "brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.25))"
    : "drop-shadow(0 2px 8px rgba(35, 44, 107, 0.08))";

  const defaultTextColor = isKnockout ? "#FFFFFF" : "#1B2142";
  const textColor = wordmarkColor || defaultTextColor;

  return (
    <div
      className={`rca-logo-wrap ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "lg" ? "16px" : size === "sm" ? "10px" : "12px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
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
          transition: "transform 0.2s ease",
        }}
      />
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: size === "lg" ? "1.75rem" : size === "sm" ? "1rem" : "1.2rem",
              letterSpacing: "-0.035em",
              color: textColor,
              whiteSpace: "nowrap",
            }}
          >
            RCA Archive
          </span>
          {size === "lg" && (
            <span
              style={{
                fontSize: "0.85rem",
                color: isKnockout ? "rgba(255,255,255,0.7)" : "#6A7399",
                fontWeight: 500,
                marginTop: "3px",
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

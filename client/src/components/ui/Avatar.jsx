import React from "react";
import { UserIcon } from "./Icons";

/**
 * RCA Archive Standard Default Avatar
 * - Displays a clean, elegant initials circle (or minimal person glyph when there is no name)
 * - If a custom image URL (src) is provided, displays the image
 * - Works seamlessly in both Light and Dark themes
 */
export default function Avatar({
  name = "User",
  src = null,
  size = "md",
  className = "",
  style = {},
  showStatus = false,
  status = "online",
}) {
  const sizeMap = {
    xs: 28,
    sm: 36,
    md: 44,
    lg: 54,
    xl: 72,
    hero: 96,
  };

  const px = sizeMap[size] || (typeof size === "number" ? size : 44);

  const getInitials = (str) => {
    if (!str || typeof str !== "string") return "";
    const parts = str.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const effectiveSrc = src;

  return (
    <div
      className={`rca-avatar ${className}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: "50%",
        flexShrink: 0,
        ...style,
      }}
    >
      {effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid var(--color-surface)",
            boxShadow: "var(--shadow-xs)",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-indigo-600) 0%, var(--color-indigo-800) 100%)",
            color: "#FFFFFF",
            fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
            fontWeight: 700,
            fontSize: `${Math.max(11, Math.round(px * 0.38))}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--color-surface)",
            boxShadow: "var(--shadow-xs)",
            letterSpacing: "-0.01em",
            userSelect: "none",
          }}
        >
          {initials ? initials : <UserIcon size={Math.round(px * 0.5)} />}
        </div>
      )}

      {showStatus && (
        <span
          style={{
            position: "absolute",
            bottom: "0px",
            right: "0px",
            width: `${Math.max(8, Math.round(px * 0.26))}px`,
            height: `${Math.max(8, Math.round(px * 0.26))}px`,
            borderRadius: "50%",
            backgroundColor: status === "online" ? "var(--color-success)" : "var(--color-muted)",
            border: "2px solid var(--color-surface)",
          }}
        />
      )}
    </div>
  );
}

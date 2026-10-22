import React from "react";

export default function IconButton({
  icon,
  onClick,
  title,
  variant = "ghost",
  size = "md",
  disabled = false,
  className = "",
  style = {},
  ...props
}) {
  const sizeMap = {
    sm: { width: "32px", height: "32px", fontSize: "14px" },
    md: { width: "38px", height: "38px", fontSize: "16px" },
    lg: { width: "44px", height: "44px", fontSize: "18px" },
  };

  const variantStyles = {
    ghost: {
      background: "transparent",
      color: "var(--color-muted, #6A7399)",
      border: "none",
    },
    subtle: {
      background: "var(--color-bg, #EEF0F6)",
      color: "var(--color-ink, #1B2142)",
      border: "1px solid rgba(63, 79, 168, 0.08)",
    },
    primary: {
      background: "var(--color-indigo-700, #3F4FA8)",
      color: "#FFFFFF",
      border: "none",
      boxShadow: "0 2px 8px rgba(63, 79, 168, 0.25)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.10)",
      color: "#EF4444",
      border: "1px solid rgba(239, 68, 68, 0.20)",
    },
  };

  const sz = sizeMap[size] || sizeMap.md;
  const vs = variantStyles[variant] || variantStyles.ghost;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`rca-icon-btn ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        flexShrink: 0,
        ...sz,
        ...vs,
        ...style,
      }}
      {...props}
    >
      {icon}
    </button>
  );
}

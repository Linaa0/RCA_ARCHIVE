import React from "react";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconRight,
  className = "",
  style = {},
  onClick,
  type = "button",
  ...props
}) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    borderRadius: "var(--radius-pill, 999px)",
    fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
    fontWeight: 600,
    transition: "all var(--transition-fast)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap",
    userSelect: "none",
    outline: "none",
  };

  const sizeStyles = {
    sm: { padding: "7px 16px", fontSize: "0.8rem", height: "34px" },
    md: { padding: "10px 22px", fontSize: "0.875rem", height: "42px" },
    lg: { padding: "13px 28px", fontSize: "0.95rem", height: "48px" },
    icon: { padding: "10px", width: "42px", height: "42px" },
  };

  const variantStyles = {
    primary: {
      background: "var(--gradient-accent, linear-gradient(135deg, #5B73E0 0%, #3F4FA8 100%))",
      color: "#FFFFFF",
      boxShadow: "0 4px 14px rgba(63, 79, 168, 0.28)",
      border: "none",
    },
    indigo: {
      background: "var(--color-indigo-700, #3F4FA8)",
      color: "#FFFFFF",
      boxShadow: "0 4px 14px rgba(63, 79, 168, 0.24)",
      border: "none",
    },
    outline: {
      background: "var(--color-surface, #FFFFFF)",
      color: "var(--color-indigo-500, #4B62CE)",
      border: "1.5px solid var(--color-border-med, rgba(63, 79, 168, 0.16))",
      boxShadow: "var(--shadow-xs)",
    },
    secondary: {
      background: "var(--color-surface-subtle, #F8F9FD)",
      color: "var(--color-ink, #1B2142)",
      border: "1px solid var(--color-border, rgba(63, 79, 168, 0.09))",
    },
    ghost: {
      background: "transparent",
      color: "var(--color-muted, #6A7399)",
      border: "none",
    },
    danger: {
      background: "var(--color-danger, #EF4444)",
      color: "#FFFFFF",
      border: "none",
      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.25)",
    },
    glass: {
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(8px)",
      color: "var(--color-ink, #1B2142)",
      border: "1px solid rgba(255, 255, 255, 0.6)",
      boxShadow: "var(--shadow-card)",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`rca-button ${className}`}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#FFFFFF",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      ) : (
        <>
          {icon}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}

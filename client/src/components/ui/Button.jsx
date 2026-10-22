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
    fontWeight: "600",
    transition: "var(--transition-normal, all 0.25s ease)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  };

  const sizeStyles = {
    sm: { padding: "8px 16px", fontSize: "12px" },
    md: { padding: "11px 22px", fontSize: "14px" },
    lg: { padding: "14px 28px", fontSize: "15px" },
    icon: { padding: "10px", width: "40px", height: "40px" },
  };

  const variantStyles = {
    primary: {
      background: "var(--primary-gradient, linear-gradient(135deg, #5B73E0 0%, #3F4FA8 100%))",
      color: "#FFFFFF",
      boxShadow: "0 4px 14px rgba(63, 79, 168, 0.28)",
      border: "none",
    },
    indigo: {
      background: "#3F4FA8",
      color: "#FFFFFF",
      boxShadow: "0 4px 14px rgba(63, 79, 168, 0.22)",
      border: "none",
    },
    outline: {
      background: "#FFFFFF",
      color: "#3F4FA8",
      border: "1.5px solid #D8E0FB",
      boxShadow: "0 2px 6px rgba(30, 37, 71, 0.03)",
    },
    secondary: {
      background: "#F0F3FA",
      color: "#1E2547",
      border: "1px solid #E2E6F0",
    },
    ghost: {
      background: "transparent",
      color: "#586380",
      border: "none",
    },
    danger: {
      background: "#EF4444",
      color: "#FFFFFF",
      border: "none",
      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.25)",
    },
    glass: {
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(8px)",
      color: "#1E2547",
      border: "1px solid rgba(255, 255, 255, 0.6)",
      boxShadow: "0 4px 16px rgba(30, 37, 71, 0.06)",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
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

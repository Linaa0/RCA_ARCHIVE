import React from "react";

export default function Badge({ children, variant = "neutral", size = "md", className = "", style = {} }) {
  const stylesByVariant = {
    primary: {
      background: "var(--primary-light, rgba(23, 79, 131, 0.12))",
      color: "var(--primary-accent, #174F83)",
      border: "1px solid rgba(23, 79, 131, 0.2)",
    },
    indigo: {
      background: "rgba(23, 79, 131, 0.12)",
      color: "#174F83",
      border: "1px solid rgba(23, 79, 131, 0.22)",
    },
    success: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#059669",
      border: "1px solid rgba(16, 185, 129, 0.25)",
    },
    warning: {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#D97706",
      border: "1px solid rgba(245, 158, 11, 0.25)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.12)",
      color: "#DC2626",
      border: "1px solid rgba(239, 68, 68, 0.25)",
    },
    neutral: {
      background: "#EEF0F6",
      color: "#586380",
      border: "1px solid #E2E6F0",
    },
    pillActive: {
      background: "#174F83",
      color: "#FFFFFF",
      border: "1px solid #174F83",
    },
  };

  const sizes = {
    sm: { padding: "3px 8px", fontSize: "11px", fontWeight: "600" },
    md: { padding: "5px 12px", fontSize: "12px", fontWeight: "600" },
  };

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "var(--radius-pill, 999px)",
        lineHeight: 1.2,
        letterSpacing: "0.2px",
        ...sizes[size],
        ...stylesByVariant[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

import React from "react";

export default function ClassChip({
  label,
  value,
  isSelected = false,
  onClick,
  size = "md",
  className = "",
  style = {},
  variant = "default",
}) {
  const displayLabel = label || value || "";
  const isInteractive = typeof onClick === "function";

  const padding = size === "sm" ? "4px 10px" : size === "lg" ? "8px 20px" : "6px 14px";
  const fontSize = size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.85rem";

  let background = "var(--color-surface, #FFFFFF)";
  let color = "var(--color-ink, #1B2142)";
  let border = "1px solid var(--color-border-med, rgba(63, 79, 168, 0.16))";
  let shadow = "var(--shadow-xs)";

  if (isSelected) {
    background = "var(--gradient-accent, linear-gradient(135deg, #5B73E0 0%, #3F4FA8 100%))";
    color = "#FFFFFF";
    border = "1px solid var(--color-indigo-500, #5B73E0)";
    shadow = "0 4px 12px rgba(63, 79, 168, 0.28)";
  } else if (variant === "subtle") {
    background = "var(--color-surface-subtle, #F8F9FD)";
    color = "var(--color-ink-subtle, #343D68)";
  } else if (variant === "solid") {
    background = "var(--color-indigo-50, #F4F6FD)";
    color = "var(--color-indigo-700, #3F4FA8)";
    border = "1px solid var(--color-indigo-200, #C7D2FE)";
  }

  const Tag = isInteractive ? "button" : "span";

  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      className={`rca-class-chip ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding,
        fontSize,
        fontWeight: isSelected ? 700 : 600,
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        borderRadius: "var(--radius-pill, 999px)",
        border,
        background,
        color,
        boxShadow: shadow,
        cursor: isInteractive ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        transition: "all var(--transition-fast)",
        outline: "none",
        ...style,
      }}
    >
      {displayLabel}
    </Tag>
  );
}

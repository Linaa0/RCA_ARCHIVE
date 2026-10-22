import React from "react";

/**
 * StatCard component styled following the Smart student dashboard reference:
 * Big rounded white card (radius 24px), layered subtle shadow, bold numeric stat, muted label
 */
export default function StatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  trendType = "neutral", // "up" | "down" | "neutral"
  color = "#3F4FA8",
  onClick,
  className = "",
  style = {},
}) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value ?? "—";

  return (
    <article
      className={`rca-stat-card ${className}`}
      onClick={onClick}
      style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRadius: "var(--radius-card, 24px)",
        padding: "24px 28px",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "130px",
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-muted, #6A7399)",
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "var(--color-indigo-50, #F4F6FD)",
              color: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ marginTop: "14px" }}>
        <strong
          style={{
            fontFamily: "var(--font-numeric, 'Inter', sans-serif)",
            fontVariantNumeric: "tabular-nums",
            fontSize: "2.35rem",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: "var(--color-ink, #1B2142)",
            display: "block",
          }}
        >
          {formattedValue}
        </strong>

        {(subtext || trend) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              fontSize: "0.8rem",
              color: "var(--color-tertiary, #949EBF)",
            }}
          >
            {trend && (
              <span
                style={{
                  fontWeight: 700,
                  color:
                    trendType === "up"
                      ? "#10B981"
                      : trendType === "down"
                      ? "#EF4444"
                      : "var(--color-indigo-500, #5B73E0)",
                }}
              >
                {trend}
              </span>
            )}
            {subtext && <span>{subtext}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

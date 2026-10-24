import React, { useState } from "react";

export default function BarChart({
  title,
  metricValue,
  metricLabel,
  actionLabel,
  onActionClick,
  bars = [],
  data = [],
  maxHeight = 160,
  className = "",
  style = {},
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const chartBars = bars.length > 0 ? bars : data;
  const maxValue = Math.max(1, ...chartBars.map((b) => Number(b.value) || 0));

  return (
    <div
      className={`rca-bar-chart ${className}`}
      style={{
        backgroundColor: "var(--color-surface, #FFFFFF)",
        borderRadius: "var(--radius-card, 24px)",
        padding: "24px",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        ...style,
      }}
    >
      {/* Header Metric */}
      {(title || metricValue || actionLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {title && (
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-muted, #6A7399)",
                  marginBottom: "4px",
                }}
              >
                {title}
              </div>
            )}
            {metricValue && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: "var(--color-ink, #1B2142)",
                    fontFamily: "var(--font-numeric, monospace)",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {metricValue}
                </span>
                {metricLabel && (
                  <span style={{ fontSize: "0.8rem", color: "var(--color-muted, #6A7399)", fontWeight: 500 }}>
                    {metricLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {actionLabel && (
            <button
              onClick={onActionClick}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-pill, 999px)",
                border: "1px solid var(--color-border-med, rgba(63, 79, 168, 0.16))",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-indigo-600, #4B62CE)",
                backgroundColor: "var(--color-surface-subtle, #F8F9FD)",
                transition: "all var(--transition-fast)",
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Bars Container */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "12px",
          height: `${maxHeight}px`,
          paddingTop: "24px",
          borderBottom: "1px solid var(--color-divider, #E4E8F2)",
        }}
      >
        {chartBars.map((bar, idx) => {
          const rawVal = Number(bar.value) || 0;
          const isZero = rawVal === 0;
          const heightPercent = isZero ? 4 : Math.min(100, Math.max(12, (rawVal / maxValue) * 100));
          const isHovered = hoveredIndex === idx;
          const unit = bar.unit || (rawVal === 1 ? "paper" : "papers");

          return (
            <div
              key={bar.label || idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                position: "relative",
                cursor: "pointer",
              }}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: "-26px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    backgroundColor: "var(--color-indigo-950, #191F4D)",
                    color: "#FFFFFF",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  {rawVal} {unit}
                </div>
              )}

              {/* Bar */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "28px",
                  height: `${heightPercent}%`,
                  borderRadius: "8px 8px 3px 3px",
                  background: isZero
                    ? "var(--color-border, rgba(63, 79, 168, 0.12))"
                    : isHovered
                    ? "var(--color-indigo-500, #5B73E0)"
                    : bar.color || "var(--gradient-accent, linear-gradient(135deg, #5B73E0 0%, #3F4FA8 100%))",
                  border: isZero ? "1px dashed var(--color-border-med, rgba(63, 79, 168, 0.25))" : "none",
                  transition: "all var(--transition-fast)",
                  transform: isHovered && !isZero ? "scaleY(1.04)" : "scaleY(1)",
                  transformOrigin: "bottom",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
        {chartBars.map((bar, idx) => (
          <div
            key={bar.label || idx}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: hoveredIndex === idx ? "var(--color-indigo-500, #5B73E0)" : "var(--color-muted, #6A7399)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={bar.label}
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";

export default function ProgressRing({
  percentage = 0,
  label = "",
  size = 72,
  strokeWidth = 8,
  color = "var(--color-indigo-500, #3F4FA8)",
  trackColor = "var(--color-border, rgba(63, 79, 168, 0.12))",
  showValue = true,
  className = "",
  style = {},
}) {
  const safePercent = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div
      className={`rca-progress-ring ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            style={{
              transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </svg>

        {showValue && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size <= 64 ? "0.75rem" : "0.95rem",
              fontWeight: 700,
              color: "var(--color-ink, #1B2142)",
              fontFamily: "var(--font-numeric, monospace)",
            }}
          >
            {Math.round(safePercent)}%
          </div>
        )}
      </div>

      {label && (
        <span
          style={{
            marginTop: "6px",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--color-muted, #6A7399)",
            lineHeight: 1.25,
            maxWidth: `${size + 24}px`,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

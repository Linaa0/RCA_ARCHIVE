import React from "react";

export default function StatRing({ percentage = 75, label = "", size = 72, strokeWidth = 8, color = "#174F83" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E7ECF7"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Ring */}
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
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: "700",
            color: "#1E2547",
          }}
        >
          {percentage}%
        </div>
      </div>
      {label && (
        <span
          style={{
            marginTop: "8px",
            fontSize: "11px",
            fontWeight: "500",
            color: "#586380",
            lineHeight: 1.3,
            maxWidth: "90px",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

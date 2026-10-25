import React from "react";

export default function BarChartWidget({
  title = "Performance",
  metricValue = "95.4",
  metricLabel = "Past papers archived",
  actionLabel = "All subjects",
  onActionClick,
  bars = [
    { value: 85, label: "Algorithms" },
    { value: 65, label: "Object Prog." },
    { value: 84, label: "Database" },
    { value: 46, label: "Web Dev." },
    { value: 68, label: "Mobile Apps" },
    { value: 74, label: "Machine Learning" },
  ],
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-card, 24px)",
        padding: "24px",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--card-border, #E6EAF2)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header Metric */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#586380", marginBottom: "4px" }}>
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "32px", fontWeight: "800", color: "#1E2547", letterSpacing: "-0.5px" }}>
              {metricValue}
            </span>
            <span style={{ fontSize: "12px", color: "#8C97B0", fontWeight: "500" }}>
              {metricLabel}
            </span>
          </div>
        </div>
        {actionLabel && (
          <button
            onClick={onActionClick}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: "1px solid #D8E0FB",
              fontSize: "12px",
              fontWeight: "600",
              color: "#174F83",
              backgroundColor: "#F1F6FA",
              transition: "all 0.2s ease",
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {/* Bar Columns */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "8px",
          height: "140px",
          paddingTop: "24px",
        }}
      >
        {bars.map((item, idx) => {
          const heightPercent = Math.min(100, Math.max(15, item.value));
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
                height: "100%",
                justifyContent: "flex-end",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: "700", color: "#586380" }}>
                {item.value}
              </span>
              <div
                style={{
                  width: "28px",
                  height: `${heightPercent}%`,
                  borderRadius: "14px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div style={{ height: "30%", background: "#2C6798" }} />
                <div style={{ height: "70%", background: "#0B2D52" }} />
              </div>
              <span
                style={{
                  fontSize: "10px",
                  color: "#8C97B0",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "50px",
                  marginTop: "2px",
                }}
                title={item.label}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from "react";

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  size = "md",
  className = "",
  style = {},
}) {
  return (
    <div
      className={`rca-tabs-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--color-bg, #EEF0F6)",
        padding: "4px",
        borderRadius: "var(--radius-pill, 999px)",
        border: "1px solid rgba(63, 79, 168, 0.08)",
        gap: "4px",
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: size === "sm" ? "6px 14px" : "8px 20px",
              borderRadius: "var(--radius-pill, 999px)",
              fontSize: size === "sm" ? "0.8rem" : "0.86rem",
              fontWeight: isActive ? 700 : 600,
              cursor: "pointer",
              border: "none",
              background: isActive ? "#FFFFFF" : "transparent",
              color: isActive ? "var(--color-indigo-700, #3F4FA8)" : "var(--color-muted, #6A7399)",
              boxShadow: isActive ? "0 2px 8px rgba(35, 44, 107, 0.08)" : "none",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              whiteSpace: "nowrap",
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 7px",
                  borderRadius: "999px",
                  background: isActive ? "var(--color-indigo-100, #E4E8FA)" : "rgba(106, 115, 153, 0.15)",
                  color: isActive ? "var(--color-indigo-700, #3F4FA8)" : "var(--color-muted, #6A7399)",
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

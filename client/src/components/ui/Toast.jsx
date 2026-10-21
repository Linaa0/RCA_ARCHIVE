import React, { useEffect } from "react";

export default function Toast({
  message,
  type = "info", // "success" | "error" | "info" | "warning"
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (!duration || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!message) return null;

  const bgMap = {
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
    info: "#3F4FA8",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "28px",
        right: "28px",
        zIndex: 9999,
        background: bgMap[type] || bgMap.info,
        color: "#FFFFFF",
        padding: "12px 22px",
        borderRadius: "var(--radius-pill, 999px)",
        boxShadow: "0 8px 24px rgba(35, 44, 107, 0.22)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "0.88rem",
        fontWeight: 600,
        animation: "toast-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255, 255, 255, 0.8)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

import React from "react";
import Button from "./Button";
import studentBoy from "../../assets/avatars/student-boy.svg";

export default function EmptyState({
  title = "No papers found",
  description = "No past papers or curriculum resources have been uploaded here yet.",
  actionText,
  onAction,
  icon,
  useAvatar = false,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`rca-empty-state ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        background: "var(--color-surface, #FFFFFF)",
        borderRadius: "var(--radius-card, 24px)",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
        width: "100%",
        ...style,
      }}
    >
      {useAvatar ? (
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #EEF0F6 0%, #E4E8FA 100%)",
            border: "3px solid #FFFFFF",
            boxShadow: "0 8px 20px rgba(63, 79, 168, 0.12)",
            overflow: "hidden",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={studentBoy}
            alt="Student"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.2) translateY(5%)",
            }}
          />
        </div>
      ) : icon ? (
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "18px",
            background: "var(--color-indigo-50, #F4F6FD)",
            color: "var(--color-indigo-700, #3F4FA8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "18px",
          }}
        >
          {icon}
        </div>
      ) : (
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "18px",
            background: "var(--color-indigo-50, #F4F6FD)",
            color: "var(--color-indigo-700, #3F4FA8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "18px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
      )}

      <h3
        style={{
          fontSize: "1.2rem",
          fontWeight: 700,
          color: "var(--color-ink, #1B2142)",
          marginBottom: "6px",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "0.88rem",
          color: "var(--color-muted, #6A7399)",
          maxWidth: "380px",
          lineHeight: 1.5,
          marginBottom: actionText ? "20px" : "0",
        }}
      >
        {description}
      </p>

      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}

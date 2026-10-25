import React from "react";
import Button from "./Button";
import { MaterialsIcon } from "./Icons";

export default function EmptyState({
  title = "No papers found",
  description = "No past papers or curriculum resources have been uploaded here yet.",
  actionText,
  onAction,
  icon,
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
      <div
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "18px",
          background: "var(--color-surface-raised, rgba(63, 79, 168, 0.08))",
          color: "var(--color-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "18px",
        }}
      >
        {icon || <MaterialsIcon size={28} />}
      </div>

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

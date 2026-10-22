import React from "react";

/**
 * Card component with optional "archive shelf" tab / folder motif
 */
export default function Card({
  children,
  shelfMotif = false,
  className = "",
  style = {},
  onClick,
  padding = "28px",
}) {
  return (
    <div
      className={`rca-card ${shelfMotif ? "rca-card-shelf" : ""} ${className}`}
      onClick={onClick}
      style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRadius: "var(--radius-card, 24px)",
        padding,
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        boxShadow: shelfMotif
          ? "var(--shadow-shelf, 0 4px 0 #DDE2F0, 0 8px 20px rgba(35, 44, 107, 0.06))"
          : "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {shelfMotif && (
        <div
          style={{
            position: "absolute",
            top: "-8px",
            left: "24px",
            width: "56px",
            height: "8px",
            background: "#D8DFFA",
            borderTopLeftRadius: "6px",
            borderTopRightRadius: "6px",
            border: "1px solid rgba(63, 79, 168, 0.12)",
            borderBottom: "none",
          }}
        />
      )}
      {children}
    </div>
  );
}

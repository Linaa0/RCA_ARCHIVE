import React, { useEffect } from "react";
import { CloseIcon } from "./Icons";

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "540px",
  size,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedMaxWidth = size === "sm" ? "440px" : size === "lg" ? "720px" : maxWidth;

  return (
    <div
      className="rca-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(10, 14, 28, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        className="rca-modal-card"
        style={{
          width: "100%",
          maxWidth: resolvedMaxWidth,
          background: "var(--color-surface, #FFFFFF)",
          color: "var(--color-ink, #1B2142)",
          borderRadius: "var(--radius-card, 24px)",
          boxShadow: "var(--shadow-modal, 0 24px 60px rgba(0, 0, 0, 0.35))",
          border: "1px solid var(--color-border, rgba(63, 79, 168, 0.12))",
          overflow: "hidden",
          animation: "modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border, #E4E8F2)",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--color-ink, #1B2142)",
                  margin: 0,
                  lineHeight: 1.3,
                  fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
                }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-muted, #6A7399)",
                  margin: "6px 0 0 0",
                  lineHeight: 1.45,
                  fontWeight: 500,
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              padding: "8px",
              borderRadius: "50%",
              color: "var(--color-muted, #6A7399)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "background var(--transition-fast), color var(--transition-fast)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-ink, #1B2142)";
              e.currentTarget.style.background = "var(--color-surface-hover, rgba(0,0,0,0.06))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-muted, #6A7399)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", color: "var(--color-ink, #1B2142)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

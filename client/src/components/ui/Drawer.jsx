import React, { useEffect } from "react";
import { CloseIcon } from "./Icons";
import IconButton from "./IconButton";

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  width = 380,
  className = "",
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRight = position === "right";

  return (
    <div
      className={`rca-drawer-portal ${className}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: isRight ? "flex-end" : "flex-start",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 18, 34, 0.55)",
          backdropFilter: "blur(4px)",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          zIndex: 1001,
          width: "100%",
          maxWidth: typeof width === "number" ? `${width}px` : width,
          height: "100%",
          backgroundColor: "var(--color-surface, #FFFFFF)",
          color: "var(--color-ink, #1B2142)",
          boxShadow: isRight
            ? "-12px 0 40px rgba(15, 18, 34, 0.25)"
            : "12px 0 40px rgba(15, 18, 34, 0.25)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
          animation: `${isRight ? "slideInRight" : "slideInLeft"} 0.25s cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border, rgba(63, 79, 168, 0.09))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {title ? (
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-ink, #1B2142)",
                margin: 0,
              }}
            >
              {title}
            </h3>
          ) : (
            <span />
          )}
          <IconButton
            icon={<CloseIcon size={20} />}
            onClick={onClose}
            aria-label="Close drawer"
            variant="ghost"
          />
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

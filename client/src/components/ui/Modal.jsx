import React, { useEffect } from "react";
import { CloseIcon } from "./Icons";

export default function Modal({ isOpen, onClose, title, children, maxWidth = "540px" }) {
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(27, 34, 69, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          background: "#FFFFFF",
          borderRadius: "var(--radius-card, 24px)",
          boxShadow: "0 20px 60px rgba(30, 37, 71, 0.2)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          overflow: "hidden",
          animation: "modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle, #E4E8F2)",
          }}
        >
          <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#1E2547" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              borderRadius: "50%",
              color: "#8C97B0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

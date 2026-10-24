import React from "react";
import { useNavigate } from "react-router-dom";
import Logo from "./ui/Logo";
import Button from "./ui/Button";
import { SearchIcon } from "./ui/Icons";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg, #EEF0F6)",
        padding: "24px",
        textAlign: "center",
        fontFamily: "var(--font-family, 'Inter', sans-serif)",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <Logo variant="light" size="sm" showWordmark />
      </div>

      <div
        style={{
          background: "var(--color-surface, #FFFFFF)",
          borderRadius: "var(--radius-card, 24px)",
          padding: "48px 40px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "var(--color-surface-raised, rgba(91, 115, 224, 0.1))",
            color: "var(--color-primary)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SearchIcon size={36} />
        </div>

        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 800,
            color: "var(--color-indigo-500, #5B73E0)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "6px",
          }}
        >
          404 Not Found
        </span>
        <h1
          style={{
            fontSize: "1.85rem",
            fontWeight: 800,
            color: "var(--color-ink, #1B2142)",
            marginBottom: "10px",
            letterSpacing: "-0.03em",
          }}
        >
          This paper or shelf doesn't exist
        </h1>
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--color-muted, #6A7399)",
            lineHeight: 1.55,
            marginBottom: "28px",
          }}
        >
          The page or curriculum resource you requested could not be located in the archive.
          It may have been relocated or renamed.
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate("/")}>
            Return to Archive
          </Button>
        </div>
      </div>
    </div>
  );
}

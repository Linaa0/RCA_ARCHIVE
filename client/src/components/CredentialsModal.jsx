import React, { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

export default function CredentialsModal({ isOpen, onClose, credentials }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !credentials) return null;

  const { email, temporaryPassword, role } = credentials;

  const handleCopy = async () => {
    try {
      const text = `RCA Archive Access Credentials:\nEmail: ${email}\nTemporary Password: ${temporaryPassword}\nRole: ${role || "member"}\nSign In URL: ${window.location.origin}/login`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Credentials Generated" size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
          The account has been created. The temporary password is shown below <strong>only once</strong>. Please copy or note it down now so you can share it directly if email delivery fails.
        </p>

        <div
          style={{
            background: "var(--color-surface-raised, rgba(63, 79, 168, 0.08))",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm, 8px)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>Email:</span>
            <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>Temporary Password:</span>
            <code
              style={{
                background: "var(--color-surface)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.92rem",
                color: "var(--color-primary)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              {temporaryPassword}
            </code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>Role:</span>
            <strong style={{ color: "var(--color-text-primary)", textTransform: "capitalize" }}>{role || "member"}</strong>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied to Clipboard" : "Copy Credentials"}
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

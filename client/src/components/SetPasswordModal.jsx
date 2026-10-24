import React, { useState } from "react";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Button from "./ui/Button";
import api from "../services/api";
import { setStoredMustChangePassword } from "../utils/auth";

export default function SetPasswordModal({ isOpen, onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError("Please provide both current and new passwords.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/change-password", {
        currentPassword,
        newPassword,
      });
      setStoredMustChangePassword(false);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to update password. Please check your current password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Permanent Password" size="sm">
      <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
        You signed in with a temporary password. Please establish your own permanent password to protect your account.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#EF4444",
            borderRadius: "var(--radius-sm, 8px)",
            fontSize: "0.85rem",
            marginBottom: "14px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Input
          label="Current Temporary Password"
          type="password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setError("");
          }}
          required
          autoFocus
        />

        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setError("");
          }}
          hint="Minimum 8 characters with at least one letter and one number"
          required
        />

        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError("");
          }}
          required
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Later
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

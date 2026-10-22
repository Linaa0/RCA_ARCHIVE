import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Avatar from "./ui/Avatar";
import { LogoutIcon } from "./ui/Icons";
import { RCA_CLASSES } from "./ui/ClassChips";
import { clearAuthStorage, persistAuth } from "../utils/auth";
import { applyTheme, getInitialTheme } from "../utils/theme";
import { errorMessage } from "./assignments/common";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [nameMsg, setNameMsg] = useState({ type: "", text: "" });
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || getInitialTheme();
    }
    return "light";
  });

  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => {
        setUser(data.user);
        setName(data.user.name || data.user.username || "");
        setCls(data.user.class || "");
      })
      .catch((err) => setNameMsg({ type: "error", text: errorMessage(err, "Could not load your profile.") }));
  }, []);

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
  };

  const saveName = async (e) => {
    e.preventDefault();
    setNameMsg({ type: "", text: "" });
    setSavingName(true);
    try {
      const payload = { name };
      if (user?.role === "student" && cls) payload.class = cls;
      const { data } = await api.put("/me", payload);
      persistAuth({ username: data.name });
      setUser((u) => ({ ...u, name: data.name, username: data.name, class: data.class || u.class }));
      setNameMsg({ type: "success", text: "Profile details updated." });
    } catch (err) {
      setNameMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    setSavingPw(true);
    try {
      await api.put("/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg({ type: "success", text: "Password changed successfully." });
    } catch (err) {
      setPwMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setSavingPw(false);
    }
  };

  const logout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-secondary)" }}>
        {nameMsg.text || "Loading user profile..."}
      </div>
    );
  }

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Page Header ── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            ACCOUNT SETTINGS
          </span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "4px",
              marginBottom: "4px",
              letterSpacing: "-0.02em",
            }}
          >
            Profile and Preferences
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            Manage your personal profile, credentials, and appearance preferences.
          </p>
        </div>

        <Button variant="outline" size="sm" icon={<LogoutIcon size={16} />} onClick={logout}>
          Log Out
        </Button>
      </header>

      {/* ── User ID Card ── */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "28px 32px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <Avatar name={user.name || user.email} size="lg" variant="initials" />
        <div style={{ flex: 1, minWidth: "220px" }}>
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              marginBottom: "4px",
            }}
          >
            {user.name || user.username}
          </h2>
          <span style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", display: "block", marginBottom: "8px" }}>
            {user.email}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Badge variant="indigo" size="sm">
              {roleLabel}
            </Badge>
            {user.class && (
              <Badge variant="neutral" size="sm">
                Class {user.class}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-Column Settings Grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Name and Cohort Form */}
        <form
          onSubmit={saveName}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Personal Details
          </h3>

          {nameMsg.text && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.84rem",
                fontWeight: 600,
                background: nameMsg.type === "success" ? "rgba(16, 185, 129, 0.10)" : "rgba(239, 68, 68, 0.10)",
                color: nameMsg.type === "success" ? "#10B981" : "#EF4444",
                border: nameMsg.type === "success" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {nameMsg.text}
            </div>
          )}

          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />

          {user.role === "student" && (
            <div>
              <Select
                label="Enrolled Class"
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                options={[
                  { value: "", label: "Select your class..." },
                  ...RCA_CLASSES.map((c) => ({
                    value: c.id,
                    label: `${c.label} (Year ${c.year})`,
                  })),
                ]}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", marginTop: "4px", display: "block" }}>
                Class assignments and peer materials are filtered by your cohort.
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <Button type="submit" variant="primary" size="sm" loading={savingName}>
              Save Details
            </Button>
          </div>
        </form>

        {/* Change Password Form */}
        <form
          onSubmit={savePassword}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Security and Password
          </h3>

          {pwMsg.text && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.84rem",
                fontWeight: 600,
                background: pwMsg.type === "success" ? "rgba(16, 185, 129, 0.10)" : "rgba(239, 68, 68, 0.10)",
                color: pwMsg.type === "success" ? "#10B981" : "#EF4444",
                border: pwMsg.type === "success" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {pwMsg.text}
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div>
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", marginTop: "4px", display: "block" }}>
              At least 8 characters with letters, numbers, and special characters.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <Button type="submit" variant="primary" size="sm" loading={savingPw}>
              Update Password
            </Button>
          </div>
        </form>
      </div>

      {/* ── Appearance & Theme Settings ── */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "28px 32px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "6px" }}>
          Appearance Theme
        </h3>
        <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", marginBottom: "20px" }}>
          Choose between clean light mode or high contrast dark mode for your working environment.
        </p>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            style={{
              flex: 1,
              minWidth: "160px",
              padding: "16px",
              borderRadius: "var(--radius-card)",
              border: currentTheme === "light" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: "#F8F9FD",
              color: "#1B2142",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: currentTheme === "light" ? "0 4px 14px rgba(63, 79, 168, 0.15)" : "none",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.95rem" }}>Light Mode</strong>
              {currentTheme === "light" && <Badge variant="indigo" size="sm">Active</Badge>}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#6A7399" }}>
              Standard lavender gray canvas with white surfaces.
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            style={{
              flex: 1,
              minWidth: "160px",
              padding: "16px",
              borderRadius: "var(--radius-card)",
              border: currentTheme === "dark" ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
              background: "#1E2235",
              color: "#F1F3FA",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: currentTheme === "dark" ? "0 4px 14px rgba(91, 115, 224, 0.25)" : "none",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.95rem" }}>Dark Mode</strong>
              {currentTheme === "dark" && <Badge variant="indigo" size="sm">Active</Badge>}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#A5ADC8" }}>
              High contrast midnight canvas optimized for study sessions.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

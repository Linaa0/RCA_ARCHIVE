import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Input from "./ui/Input";
import Avatar from "./ui/Avatar";
import { clearAuthStorage, persistAuth } from "../utils/auth";
import { applyTheme, getThemePreference } from "../utils/theme";
import { errorMessage } from "./assignments/common";

function computePasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "#EF4444" };
  if (score === 2) return { score: 2, label: "Fair", color: "#F59E0B" };
  if (score <= 4) return { score: 3, label: "Good", color: "#3B82F6" };
  return { score: 4, label: "Strong", color: "#10B981" };
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [cls, setCls] = useState("");
  const [nameMsg, setNameMsg] = useState({ type: "", text: "" });
  const [savingName, setSavingName] = useState(false);

  const [gender, setGender] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("rca_user_gender") || "female";
    }
    return "female";
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [themePref, setThemePref] = useState(() => getThemePreference());

  // Notification settings
  const [notifications, setNotifications] = useState({
    inAppAlerts: true,
    dueReminders: true,
    emailNotifications: true,
  });
  const [notifMsg, setNotifMsg] = useState({ type: "", text: "" });
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => {
        setUser(data.user);
        setName(data.user.name || data.user.username || "");
        setUsername(data.user.username || "");
        setCls(data.user.class || "");
        if (data.user.gender) {
          setGender(data.user.gender);
          localStorage.setItem("rca_user_gender", data.user.gender);
        }
        setNotifications(data.user.notifications || {
          inAppAlerts: true,
          dueReminders: true,
          emailNotifications: true,
        });
      })
      .catch((err) => setNameMsg({ type: "error", text: errorMessage(err, "Could not load your profile.") }));
  }, []);

  const handleThemeChange = (newTheme) => {
    setThemePref(newTheme);
    applyTheme(newTheme);
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    setNameMsg({ type: "", text: "" });
    setSavingName(true);
    try {
      const payload = { name, username };
      const { data } = await api.put("/me", payload);
      persistAuth({ username: data.username || data.name });
      setUser((u) => ({
        ...u,
        name: data.name,
        username: data.username,
      }));
      setNameMsg({ type: "success", text: "Profile details updated successfully." });
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

  const saveNotifications = async (e) => {
    e.preventDefault();
    setNotifMsg({ type: "", text: "" });
    setSavingNotif(true);
    try {
      const { data } = await api.put("/me", { notifications });
      const savedPreferences = data.notifications || notifications;
      setNotifications(savedPreferences);
      window.dispatchEvent(new CustomEvent("rca-notification-preferences-changed", {
        detail: savedPreferences,
      }));
      setNotifMsg({ type: "success", text: "Notification preferences saved." });
    } catch (err) {
      setNotifMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setSavingNotif(false);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-secondary)" }}>
        {nameMsg.text || "Loading user profile..."}
      </div>
    );
  }

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const pwStrength = computePasswordStrength(newPassword);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Page Header */}
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
              letterSpacing: "-0.02em",
            }}
          >
            Settings & Profile
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.92rem", marginTop: "4px" }}>
            Manage your account identity, security credentials, appearance theme, and notifications.
          </p>
        </div>
      </header>

      {/* Account Overview Card */}
      <section
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
        <Avatar name={user.name || user.username} size="lg" />
        <div style={{ flex: 1, minWidth: "220px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              {user.name || user.username}
            </h2>
            <Badge variant="indigo" size="sm">
              {roleLabel}
            </Badge>
            {user.role === "student" && user.class && (
              <Badge variant="info" size="sm">
                Cohort {user.class}
              </Badge>
            )}
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "6px 0 0" }}>
            {user.email} &bull; @{user.username || "username"}
          </p>
        </div>
      </section>

      {/* Two-Column Layout: Profile Details and Security */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Profile Details Form */}
        <form
          onSubmit={saveDetails}
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
            Profile Details
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

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            required
          />

          {user.role === "student" && (
            <div>
              <Input
                label="Enrolled Class"
                value={cls ? `${cls} (Year ${cls.startsWith("Y") ? cls.charAt(1) : cls})` : "Not assigned"}
                disabled
                readOnly
              />
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", marginTop: "4px", display: "block" }}>
                Class is assigned during registration and remains locked until annual promotion.
              </span>
            </div>
          )}

          <div>
            <Input
              label="Gender"
              value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "Not specified"}
              disabled
              readOnly
            />
            <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", marginTop: "4px", display: "block" }}>
              Gender is set during registration and cannot be modified.
            </span>
          </div>

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

            {/* Password Strength Meter */}
            {newPassword && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ display: "flex", gap: "4px", height: "5px", marginBottom: "6px" }}>
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        borderRadius: "2px",
                        background: step <= pwStrength.score ? pwStrength.color : "var(--color-border)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem" }}>
                  <span style={{ color: "var(--color-text-tertiary)" }}>Password strength:</span>
                  <span style={{ fontWeight: 700, color: pwStrength.color }}>{pwStrength.label}</span>
                </div>
              </div>
            )}

            <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", marginTop: "6px", display: "block" }}>
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

      {/* Appearance & Theme Settings (Light, Dark, System) */}
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
          Choose your visual preference or sync automatically with your device system settings.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Light Mode */}
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            style={{
              padding: "16px",
              borderRadius: "var(--radius-card)",
              border: themePref === "light" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: "var(--color-surface-subtle)",
              color: "var(--color-ink)",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: themePref === "light" ? "0 4px 14px rgba(63, 79, 168, 0.15)" : "none",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.95rem" }}>Light Mode</strong>
              {themePref === "light" && <Badge variant="indigo" size="sm">Active</Badge>}
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
              Standard lavender gray canvas with crisp white surfaces.
            </span>
          </button>

          {/* Dark Mode */}
          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            style={{
              padding: "16px",
              borderRadius: "var(--radius-card)",
              border: themePref === "dark" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: "var(--color-surface-subtle)",
              color: "var(--color-ink)",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: themePref === "dark" ? "0 4px 14px rgba(63, 79, 168, 0.25)" : "none",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.95rem" }}>Dark Mode</strong>
              {themePref === "dark" && <Badge variant="indigo" size="sm">Active</Badge>}
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
              High contrast midnight canvas optimized for focused study.
            </span>
          </button>

          {/* System Preference */}
          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            style={{
              padding: "16px",
              borderRadius: "var(--radius-card)",
              border: themePref === "system" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: "var(--color-surface-subtle)",
              color: "var(--color-ink)",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: themePref === "system" ? "0 4px 14px rgba(63, 79, 168, 0.25)" : "none",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.95rem" }}>System Default</strong>
              {themePref === "system" && <Badge variant="indigo" size="sm">Active</Badge>}
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
              Automatically adapt to your operating system theme.
            </span>
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <form
        onSubmit={saveNotifications}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "28px 32px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Notification Preferences
        </h3>
        <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
          Control which real-time alerts and email updates you receive.
        </p>

        {notifMsg.text && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.84rem",
              fontWeight: 600,
              background: notifMsg.type === "success" ? "rgba(16, 185, 129, 0.10)" : "rgba(239, 68, 68, 0.10)",
              color: notifMsg.type === "success" ? "#10B981" : "#EF4444",
              border: notifMsg.type === "success" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            {notifMsg.text}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", color: "var(--color-ink)", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={notifications.inAppAlerts}
              onChange={(e) => setNotifications((prev) => ({ ...prev, inAppAlerts: e.target.checked }))}
              style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
            />
            <span>
              <strong>Real-time In-App Toasts:</strong> Show floating toast popups for new papers and one-hour assignment reminders.
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", color: "var(--color-ink)", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={notifications.dueReminders}
              onChange={(e) => setNotifications((prev) => ({ ...prev, dueReminders: e.target.checked }))}
              style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
            />
            <span>
              <strong>Deadline Reminders:</strong> Receive an alert 20 minutes after assignments due within an hour, or one hour after other assignments are given to you.
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", color: "var(--color-ink)", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={notifications.emailNotifications}
              onChange={(e) => setNotifications((prev) => ({ ...prev, emailNotifications: e.target.checked }))}
              style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
            />
            <span>
              <strong>Email Notifications:</strong> Receive emails about password changes, credentials, and assignment appeal decisions.
            </span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
          <Button type="submit" variant="primary" size="sm" loading={savingNotif}>
            Save Notification Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}

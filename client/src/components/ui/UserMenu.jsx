import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import Badge from "./Badge";
import {
  SunIcon,
  MoonIcon,
  SettingsIcon,
  LogoutIcon,
  UserIcon,
} from "./Icons";
import {
  getThemePreference,
  applyTheme,
} from "../../utils/theme";
import { clearAuthStorage, getStoredRole, getStoredUser } from "../../utils/auth";

export default function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState(getThemePreference());
  const menuRef = useRef(null);

  const user = getStoredUser();
  const role = getStoredRole();
  const displayName = user?.name || user?.username || "Student";
  const userEmail = user?.email || "";
  const roleLabel = (role || "student").toUpperCase();

  // Listen to external theme changes
  useEffect(() => {
    const handleThemeChange = (e) => {
      setPreference(e.detail?.preference || getThemePreference());
    };
    window.addEventListener("rca-theme-change", handleThemeChange);
    return () => window.removeEventListener("rca-theme-change", handleThemeChange);
  }, []);

  // Close on outside click or escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelectPreference = (newPref) => {
    setPreference(newPref);
    applyTheme(newPref);
  };

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  const userGender = user?.gender || (typeof localStorage !== "undefined" ? localStorage.getItem("rca_user_gender") : null);

  return (
    <div className="user-menu-wrapper" ref={menuRef} style={{ position: "relative" }}>
      {/* Topbar Trigger */}
      <button
        type="button"
        className="topbar-profile-link"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="User navigation menu"
      >
        <Avatar name={displayName} size="xs" gender={userGender} />
        <span className="topbar-profile-name">{displayName}</span>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          className="user-menu-dropdown"
          role="menu"
          aria-label="User account and theme menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "270px",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card-sm, 16px)",
            border: "1px solid var(--color-border-med)",
            boxShadow: "var(--shadow-dropdown)",
            padding: "16px",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* User Info Header */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Avatar name={displayName} size="md" gender={userGender} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong
                title={displayName}
                style={{
                  display: "block",
                  fontSize: "0.92rem",
                  color: "var(--color-ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </strong>
              {userEmail && (
                <span
                  title={userEmail}
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    color: "var(--color-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userEmail}
                </span>
              )}
              <div style={{ marginTop: "4px" }}>
                <Badge variant={role === "admin" ? "primary" : role === "teacher" ? "indigo" : "neutral"} size="sm">
                  {roleLabel}
                </Badge>
              </div>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--color-divider)", margin: "0 -4px" }} />

          {/* Theme Segmented Control: Light, Dark, System */}
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--color-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              Theme Preference
            </span>

            <div
              className="theme-segmented-control"
              role="radiogroup"
              aria-label="Theme mode"
              style={{
                display: "flex",
                background: "var(--color-surface-subtle)",
                borderRadius: "10px",
                padding: "3px",
                border: "1px solid var(--color-border)",
                gap: "2px",
              }}
            >
              {[
                { id: "light", label: "Light", icon: <SunIcon size={14} /> },
                { id: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
                { id: "system", label: "System", icon: null },
              ].map((opt) => {
                const isSelected = preference === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectPreference(opt.id)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      padding: "6px 8px",
                      fontSize: "0.78rem",
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: "7px",
                      border: "none",
                      background: isSelected ? "var(--color-surface)" : "transparent",
                      color: isSelected ? "var(--color-primary)" : "var(--color-muted)",
                      boxShadow: isSelected ? "var(--shadow-xs)" : "none",
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--color-divider)", margin: "0 -4px" }} />

          {/* Menu Action Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                fontSize: "0.85rem",
                color: "var(--color-ink)",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: 600,
                transition: "background var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <SettingsIcon size={16} />
              <span>Settings and Profile</span>
            </Link>

            <Link
              to="/report-issue"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                fontSize: "0.85rem",
                color: "var(--color-ink)",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: 600,
                transition: "background var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <UserIcon size={16} />
              <span>Help and Report Issue</span>
            </Link>
          </div>

          <div style={{ height: "1px", background: "var(--color-divider)", margin: "0 -4px" }} />

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              fontSize: "0.85rem",
              color: "#EF4444",
              background: "none",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.10)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogoutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./DashboardShell.css";
import {
  DashboardIcon,
  LessonsIcon,
  CalendarIcon,
  MaterialsIcon,
  ForumIcon,
  AssessmentsIcon,
  SettingsIcon,
  LogoutIcon,
  SearchIcon,
  BellIcon,
  MailIcon,
  ChevronDownIcon,
  MenuIcon,
  ShieldIcon,
  UploadIcon,
} from "../components/ui/Icons";
import { clearAuthStorage, getStoredRole, getStoredUser, isAuthenticated } from "../utils/auth";
import Logo from "../components/ui/Logo";
import Avatar from "../components/ui/Avatar";

export default function DashboardShell({ children, onSearch, currentSearch = "" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const user = getStoredUser();
  const role = getStoredRole();
  const loggedIn = isAuthenticated();

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    } else {
      navigate(`/?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  const navItems = [
    { label: "Dashboard", path: "/", icon: <DashboardIcon size={20} /> },
    { label: "Past Papers", path: "/#papers", icon: <LessonsIcon size={20} /> },
    { label: "Subjects", path: "/#subjects", icon: <MaterialsIcon size={20} /> },
  ];

  if (role === "admin") {
    navItems.push({ label: "Admin Panel", path: "/admin", icon: <ShieldIcon size={20} /> });
  }

  // Active check helper
  const isItemActive = (itemPath) => {
    if (itemPath === "/") return location.pathname === "/" && !location.hash;
    if (itemPath.startsWith("/#")) return location.hash === itemPath.substring(1);
    return location.pathname.startsWith(itemPath);
  };

  const displayName = user?.name || user?.username || "Guest User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="dashboard-layout">
      {/* Mobile Overlay */}
      <div
        className={`mobile-sidebar-overlay ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Indigo Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo variant="knockout" size="sm" wordmarkColor="#FFFFFF" />
          {role === "admin" && <span className="sidebar-brand-badge">ADMIN</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, idx) => {
            const active = isItemActive(item.path);
            return (
              <Link
                key={idx}
                to={item.path}
                className={`sidebar-item ${active ? "active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {loggedIn ? (
            <button className="sidebar-logout" onClick={handleLogout}>
              <LogoutIcon size={18} />
              <span>Log Out</span>
            </button>
          ) : (
            <Link to="/login" className="sidebar-logout" style={{ color: "#FFFFFF" }}>
              <LogoutIcon size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="dashboard-main">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <MenuIcon size={20} />
          </button>

          {/* Search bar */}
          <form className="topbar-search" onSubmit={handleSearchSubmit}>
            <SearchIcon size={18} className="topbar-search-icon" />
            <input
              type="text"
              placeholder="Search past papers, notes, subjects..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
            />
          </form>

          {/* Actions & Profile */}
          <div className="topbar-actions">
            <div className="topbar-action-pill">
              <span>ENG</span>
              <ChevronDownIcon size={14} />
            </div>

            <button className="topbar-icon-btn" title="Messages">
              <MailIcon size={18} />
            </button>

            <button className="topbar-icon-btn" title="Notifications">
              <BellIcon size={18} />
              <span className="notification-dot" />
            </button>

            {/* User Dropdown */}
            {loggedIn ? (
              <div
                className="topbar-user"
                onClick={() => navigate(role === "admin" ? "/admin" : "/")}
                title="Profile & Dashboard"
              >
                <Avatar name={displayName} size="xs" variant="boy" />
                <span className="topbar-user-name">{displayName}</span>
                <ChevronDownIcon size={14} style={{ color: "#8C97B0" }} />
              </div>
            ) : (
              <button
                className="topbar-action-pill"
                onClick={() => navigate("/login")}
                style={{ background: "#3F4FA8", color: "#FFFFFF", borderColor: "#3F4FA8" }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}

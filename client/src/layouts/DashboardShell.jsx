import React, { useEffect, useState } from "react";
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
  UserIcon,
} from "../components/ui/Icons";
import api from "../services/api";
import { clearAuthStorage, getStoredRole, getStoredUser, isAuthenticated, getHomePathForRole } from "../utils/auth";
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
  const [pendingAppeals, setPendingAppeals] = useState(0);

  // Teachers see a live count of appeals waiting for a decision
  useEffect(() => {
    if (!loggedIn || role !== "teacher") return;
    const refresh = () =>
      api
        .get("/appeals?unread=1")
        .then(({ data }) => setPendingAppeals((data.appeals || []).length))
        .catch(() => setPendingAppeals(0));
    refresh();
    window.addEventListener("appeals-changed", refresh);
    return () => window.removeEventListener("appeals-changed", refresh);
  }, [loggedIn, role, location.pathname]);

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    } else {
      navigate(`/home?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  let navItems;
  if (role === "teacher") {
    navItems = [
      { label: "Dashboard", path: "/teacher", icon: <DashboardIcon size={20} /> },
      { label: "Assignments", path: "/teacher/assignments", icon: <LessonsIcon size={20} /> },
      { label: "Resources", path: "/teacher/resources", icon: <MaterialsIcon size={20} /> },
      { label: "Appealed Assignments", path: "/teacher/appeals", icon: <ForumIcon size={20} />, badge: pendingAppeals },
      { label: "Profile", path: "/profile", icon: <UserIcon size={20} /> },
    ];
  } else if (role === "admin") {
    navItems = [
      { label: "Dashboard", path: "/home", icon: <DashboardIcon size={20} /> },
      { label: "Past Papers", path: "/home#papers", icon: <LessonsIcon size={20} /> },
      { label: "Subjects", path: "/home#subjects", icon: <MaterialsIcon size={20} /> },
      { label: "Admin Panel", path: "/admin", icon: <ShieldIcon size={20} /> },
      { label: "Profile", path: "/profile", icon: <UserIcon size={20} /> },
    ];
  } else {
    navItems = [
      { label: "Dashboard", path: "/home", icon: <DashboardIcon size={20} /> },
      { label: "My Assignments", path: "/student/assignments", icon: <AssessmentsIcon size={20} /> },
      { label: "Past Papers", path: "/home#papers", icon: <LessonsIcon size={20} /> },
      { label: "Subjects", path: "/home#subjects", icon: <MaterialsIcon size={20} /> },
      { label: "Profile", path: "/profile", icon: <UserIcon size={20} /> },
    ];
  }

  // Active check helper
  const isItemActive = (itemPath) => {
    const [pathOnly, hash] = itemPath.split("#");
    if (hash) return location.pathname === pathOnly && location.hash === `#${hash}`;
    if (pathOnly === "/home") return location.pathname === "/home" && !location.hash;
    return location.pathname === pathOnly;
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
          {role === "teacher" && <span className="sidebar-brand-badge">TEACHER</span>}
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
                {item.badge > 0 && <span className="sidebar-item-count">{item.badge}</span>}
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

          {/* Search bar (past papers) - not shown for teachers */}
          {role === "teacher" ? (
            <div style={{ flex: 1 }} />
          ) : (
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
          )}

          {/* Actions & Profile */}
          <div className="topbar-actions">
            {role !== "teacher" && (
              <>
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
              </>
            )}

            {/* User Dropdown */}
            {loggedIn ? (
              <div
                className="topbar-user"
                onClick={() => navigate("/profile")}
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

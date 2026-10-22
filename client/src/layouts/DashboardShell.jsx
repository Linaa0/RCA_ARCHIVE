import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DashboardIcon,
  UsersIcon,
  GraduationCapIcon,
  TrashIcon,
  MaterialsIcon,
  SettingsIcon,
  FileTextIcon,
  ForumIcon,
  LayersIcon,
  ShieldIcon,
  UserIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  SearchIcon,
  SunIcon,
  MoonIcon,
} from "../components/ui/Icons";
import "./DashboardShell.css";
import api from "../services/api";
import { clearAuthStorage, getStoredRole, getStoredUser, isAuthenticated } from "../utils/auth";
import { toggleTheme, getInitialTheme } from "../utils/theme";
import Logo from "../components/ui/Logo";
import Avatar from "../components/ui/Avatar";

export default function DashboardShell({ children, onSearch, currentSearch = "" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [currentTheme, setCurrentTheme] = useState(getInitialTheme());
  const user = getStoredUser();
  const role = getStoredRole();
  const loggedIn = isAuthenticated();
  const [pendingAppeals, setPendingAppeals] = useState(0);

  // Sync theme state with DOM
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const active = document.documentElement.getAttribute("data-theme") || "light";
      setCurrentTheme(active);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setCurrentTheme(next);
  };

  // Teachers live appeals counter
  useEffect(() => {
    if (!loggedIn || role !== "teacher") return;
    let isMounted = true;
    const refresh = () =>
      api
        .get("/appeals?unread=1")
        .then(({ data }) => {
          if (isMounted) setPendingAppeals((data.appeals || []).length);
        })
        .catch(() => {
          if (isMounted) setPendingAppeals(0);
        });

    refresh();
    window.addEventListener("appeals-changed", refresh);
    return () => {
      isMounted = false;
      window.removeEventListener("appeals-changed", refresh);
    };
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

  // Build role-specific navigation according to exact specifications
  let navItems = [];
  if (role === "admin") {
    navItems = [
      { label: "Dashboard", path: "/admin", icon: <DashboardIcon size={20} /> },
      { label: "Teachers", path: "/admin?tab=teachers", icon: <UsersIcon size={20} /> },
      { label: "Students", path: "/admin?tab=students", icon: <GraduationCapIcon size={20} /> },
      { label: "Deletion Requests", path: "/admin?tab=deletions", icon: <TrashIcon size={20} /> },
      { label: "Statistics", path: "/admin?tab=stats", icon: <MaterialsIcon size={20} /> },
      { label: "Settings", path: "/settings", icon: <SettingsIcon size={20} /> },
    ];
  } else if (role === "teacher") {
    navItems = [
      { label: "Dashboard", path: "/teacher", icon: <DashboardIcon size={20} /> },
      { label: "Assignments", path: "/teacher/assignments", icon: <FileTextIcon size={20} /> },
      { label: "Resources", path: "/teacher/resources", icon: <MaterialsIcon size={20} /> },
      {
        label: "Appeals Inbox",
        path: "/teacher/appeals",
        icon: <ForumIcon size={20} />,
        badge: pendingAppeals,
      },
      { label: "Settings", path: "/settings", icon: <SettingsIcon size={20} /> },
    ];
  } else {
    // Student Area (Strict order: Academic Years, Subjects, Appeal for Assignment, Settings)
    navItems = [
      { label: "Academic Years", path: "/home", icon: <GraduationCapIcon size={20} /> },
      { label: "Subjects", path: "/subjects", icon: <LayersIcon size={20} /> },
      { label: "Appeal for Assignment", path: "/student/assignments", icon: <FileTextIcon size={20} /> },
      { label: "Settings", path: "/settings", icon: <SettingsIcon size={20} /> },
    ];
  }

  // Active navigation checker
  const isItemActive = (itemPath) => {
    const currentFull = `${location.pathname}${location.search}`;
    if (itemPath === "/home" && (location.pathname === "/home" || location.pathname === "/years")) return true;
    if (itemPath === "/admin" && location.pathname === "/admin" && !location.search) return true;
    if (itemPath.includes("?tab=")) return currentFull === itemPath;
    if (itemPath === "/subjects" && (location.pathname === "/subjects" || location.pathname.startsWith("/subject/"))) return true;
    if (itemPath === "/settings" && (location.pathname === "/settings" || location.pathname === "/profile")) return true;
    return location.pathname === itemPath;
  };

  const displayName = user?.name || user?.username || "Student";
  const userRole = (role || "Student").toUpperCase();

  return (
    <div className="dashboard-layout">
      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-sidebar-overlay ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Unified Deep Indigo Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <Logo variant="knockout" size="sidebar" wordmarkColor="#FFFFFF" />
          <div className="sidebar-brand-badge-wrap">
            {role === "admin" && (
              <span className="sidebar-brand-badge admin-badge">
                <ShieldIcon size={11} /> ADMIN
              </span>
            )}
            {role === "teacher" && (
              <span className="sidebar-brand-badge teacher-badge">
                <UserIcon size={11} /> TEACHER
              </span>
            )}
          </div>
        </div>

        {/* Navigation Items with Curved Concave Cutouts */}
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
                <span className="sidebar-item-label">{item.label}</span>
                {item.badge > 0 && <span className="sidebar-item-count">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: User Card and Pinned Log Out */}
        <div className="sidebar-footer">
          <div className="sidebar-user-block">
            <Avatar name={displayName} size="sm" />
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={displayName}>
                {displayName}
              </span>
              <span className="sidebar-user-role">{userRole}</span>
            </div>
          </div>

          {loggedIn ? (
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Log out of RCA Archive"
            >
              <LogoutIcon size={18} />
              <span>Log Out</span>
            </button>
          ) : (
            <Link to="/login" className="sidebar-logout-btn">
              <LogoutIcon size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Top Header Bar */}
        <header className="dashboard-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>

          {/* Search Input (Global Archive Search) */}
          <form className="topbar-search-form" onSubmit={handleSearchSubmit}>
            <SearchIcon size={18} className="topbar-search-icon" />
            <input
              type="text"
              placeholder="Search past papers, assignments, subjects..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              aria-label="Search past papers and resources"
            />
          </form>

          {/* Header Actions */}
          <div className="topbar-actions">
            {/* Theme Switcher Button */}
            <button
              type="button"
              className="topbar-theme-toggle"
              onClick={handleToggleTheme}
              title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle visual theme"
            >
              {currentTheme === "dark" ? <SunIcon size={19} /> : <MoonIcon size={19} />}
            </button>

            {/* Profile Avatar Quicklink */}
            {loggedIn && (
              <div
                className="topbar-profile-link"
                onClick={() => navigate("/settings")}
                title="Account Settings"
              >
                <Avatar name={displayName} size="xs" />
                <span className="topbar-profile-name">{displayName}</span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}

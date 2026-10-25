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
import Logo from "../components/ui/Logo";
import "./DashboardShell.css";
import api from "../services/api";
import { clearAuthStorage, getStoredRole, getStoredUser, isAuthenticated } from "../utils/auth";
import { toggleTheme, getInitialTheme } from "../utils/theme";
import Avatar from "../components/ui/Avatar";
import ThemeToggle from "../components/ui/ThemeToggle";
import UserMenu from "../components/ui/UserMenu";
import SetPasswordModal from "../components/SetPasswordModal";
import NotificationBell from "../components/NotificationBell";

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

  const [needsPasswordChange, setNeedsPasswordChange] = useState(Boolean(user?.mustChangePassword));
  const [showPasswordModal, setShowPasswordModal] = useState(
    Boolean(user?.mustChangePassword && typeof sessionStorage !== "undefined" && sessionStorage.getItem("pwd_modal_dismissed") !== "true")
  );

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

  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash === "#subjects") return "subjects";
    return null;
  });

  // Scroll-spy for student dashboard subjects section
  useEffect(() => {
    if (location.pathname !== "/home" && location.pathname !== "/") {
      setActiveSection(null);
      return;
    }

    if (location.hash === "#subjects") {
      setActiveSection("subjects");
    }

    const subjectsEl = document.getElementById("subjects");
    if (!subjectsEl) return;

    const handleScrollSpy = () => {
      const rect = subjectsEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 800;
      // When subjects section enters view (top is within upper half of viewport)
      if (rect.top <= viewportHeight * 0.45 && rect.bottom >= 120) {
        setActiveSection("subjects");
      } else if (rect.top > viewportHeight * 0.45) {
        setActiveSection("academic-years");
      }
    };

    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    handleScrollSpy();

    return () => window.removeEventListener("scroll", handleScrollSpy);
  }, [location.pathname, location.hash]);

  // Handle nav clicks with smooth scroll for in-page anchors
  const handleNavItemClick = (item, e) => {
    setMobileMenuOpen(false);
    if (item.path === "/subjects" || item.path === "/home#subjects") {
      if (location.pathname === "/home" || location.pathname === "/") {
        e.preventDefault();
        const target = document.getElementById("subjects");
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          setActiveSection("subjects");
          try {
            window.history.replaceState(null, "", "/home#subjects");
          } catch (_) {}
        }
      }
    } else if (item.path === "/home") {
      if (location.pathname === "/home" || location.pathname === "/") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setActiveSection("academic-years");
        try {
          window.history.replaceState(null, "", "/home");
        } catch (_) {}
      }
    }
  };

  // Build role-specific navigation according to exact specifications
  let navItems = [];
  const isAdminStudentView =
    role === "admin" &&
    (location.pathname === "/home" || location.pathname === "/student/assignments");
  if (role === "admin" && !isAdminStudentView) {
    navItems = [
      { label: "Dashboard", path: "/admin", icon: <DashboardIcon size={20} /> },
      { label: "Teachers", path: "/admin?tab=teachers", icon: <UsersIcon size={20} /> },
      { label: "Students", path: "/admin?tab=students", icon: <GraduationCapIcon size={20} /> },
      { label: "Deletion Requests", path: "/admin?tab=deletions", icon: <TrashIcon size={20} /> },
      { label: "Student View", path: "/home", icon: <GraduationCapIcon size={20} /> },
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
      ...(isAdminStudentView
        ? [{ label: "Admin Dashboard", path: "/admin", icon: <DashboardIcon size={20} /> }]
        : []),
      { label: "Settings", path: "/settings", icon: <SettingsIcon size={20} /> },
    ];
  }

  // Active navigation checker
  const isItemActive = (itemPath) => {
    const currentFull = `${location.pathname}${location.search}`;

    // Admin dashboard vs tabs
    if (itemPath === "/admin") {
      return location.pathname === "/admin" && !location.search;
    }
    if (itemPath.includes("?tab=")) {
      return currentFull === itemPath;
    }

    // Teacher navigation
    if (itemPath === "/teacher") {
      return location.pathname === "/teacher" && !location.search;
    }
    if (itemPath.startsWith("/teacher/")) {
      return location.pathname.startsWith(itemPath);
    }

    // Student navigation (Academic Years vs Subjects scroll-spy)
    if (itemPath === "/subjects" || itemPath === "/home#subjects") {
      if (location.pathname === "/subjects" || location.pathname.startsWith("/subject/")) return true;
      if ((location.pathname === "/home" || location.pathname === "/") && activeSection === "subjects") {
        return true;
      }
      return false;
    }

    if (itemPath === "/home" || itemPath === "/academic-years") {
      if ((location.pathname === "/home" || location.pathname === "/" || location.pathname === "/years") && activeSection !== "subjects") {
        return true;
      }
      return false;
    }

    if (itemPath === "/settings" || itemPath === "/profile") {
      return location.pathname === "/settings" || location.pathname === "/profile";
    }

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
          <div className="sidebar-brand-heading">
            <Logo variant="knockout" size={60} showWordmark={false} />
            <span className="sidebar-brand-name">RCA Archive</span>
          </div>
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
                onClick={(e) => handleNavItemClick(item, e)}
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
            <ThemeToggle size="md" />
            {loggedIn && <NotificationBell />}
            {loggedIn && <UserMenu />}
          </div>
        </header>

        {/* Persistent Temporary Password Banner */}
        {needsPasswordChange && (
          <div
            style={{
              background: "rgba(23, 79, 131, 0.12)",
              borderBottom: "1px solid var(--color-border)",
              padding: "10px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.86rem",
              color: "var(--color-text-primary)",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span>You are currently using a temporary password. Please set your own permanent password to secure your account.</span>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              style={{
                background: "var(--color-primary)",
                color: "#FFFFFF",
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
            >
              Set your own password
            </button>
          </div>
        )}

        {/* Dynamic Page Container */}
        <main className="dashboard-content">{children}</main>

        <SetPasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("pwd_modal_dismissed", "true");
            }
          }}
          onSuccess={() => {
            setNeedsPasswordChange(false);
            setShowPasswordModal(false);
          }}
        />
      </div>
    </div>
  );
}

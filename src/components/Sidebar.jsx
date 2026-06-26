import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { clearAuthStorage } from "../utils/auth";
import "./Sidebar.css";

function Sidebar({ activeYear, onYearChange, allYears = [1, 2, 3], isDarkMode, toggleDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role") || "student";
  const token = localStorage.getItem("token");
  const isAcademicPage = location.pathname === "/" || location.pathname.startsWith("/subject/");
  const [yearsOpen, setYearsOpen] = useState(isAcademicPage);

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  const handleYearClick = (y) => {
    // Update the active year via callback
    if (onYearChange) {
      onYearChange(y);
    }

    // Navigate to homepage with year query param and hash
    // This triggers App.js useEffect to scroll to subjects section
    navigate(`/?year=${y}#subjects`);
  };

  const initial = username ? username.charAt(0).toUpperCase() : "U";
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <img src="/rwandacoding.png" alt="RCA Logo" className="sidebar-logo" />
        <span className="sidebar-brand-name">RCA ARCHIVE+</span>
      </div>

      <div className="sidebar-menu-section">
        <nav className="sidebar-nav-menu">
          <button
            type="button"
            className={`sidebar-nav-btn sidebar-group-btn ${isAcademicPage ? "active" : ""}`}
            onClick={() => setYearsOpen((open) => !open)}
            aria-expanded={yearsOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
            </svg>
            <span>Academic Years</span>
            <span className={`sidebar-chevron ${yearsOpen ? "open" : ""}`}>›</span>
          </button>

          {yearsOpen && (
            <div className="sidebar-submenu">
              {allYears.map((y) => {
                const isActive = activeYear === y && location.pathname === "/";
                const icon = y === 1 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                  </svg>
                );

                return (
                  <button
                    key={y}
                    className={`sidebar-nav-btn sidebar-submenu-btn ${isActive ? "active" : ""}`}
                    onClick={() => handleYearClick(y)}
                  >
                    {icon}
                    <span>Year {y}</span>
                  </button>
                );
              })}
            </div>
          )}

          <Link
            to="/report-issue"
            className={`sidebar-nav-btn sidebar-link-btn ${location.pathname === "/report-issue" ? "active" : ""}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Report Issue</span>
          </Link>
        </nav>
      </div>

      <div className="sidebar-profile-footer">
        {token && (
          <div className="theme-toggle-wrapper">
            <button 
              onClick={toggleDarkMode} 
              className="theme-toggle-btn"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="theme-toggle-icon">
                {isDarkMode ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </div>
              <div className="theme-toggle-label">
                {isDarkMode ? "Dark Mode" : "Light Mode"}
              </div>
              <div className={`theme-toggle-switch ${isDarkMode ? 'dark' : 'light'}`}>
                <div className="theme-toggle-knob"></div>
              </div>
            </button>
          </div>
        )}
        <div className="sidebar-divider"></div>
        {token ? (
          <div className="profile-container">
            <div className="profile-info-row">
              <div className="profile-avatar">{initial}</div>
              <div className="profile-text">
                <span className="profile-name">{username}</span>
                <span className="profile-role">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="sidebar-logout-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="sidebar-login-btn">Login / Sign Up</Link>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;

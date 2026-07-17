import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import SearchBar from "./components/SearchBar";
import Stats from "./components/Stats";
import SubjectsList from "./components/SubjectsList";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./components/ResetPassword";
import AdminDashboard from "./components/AdminDashboard";
import SubjectPage from "./components/SubjectPage";
import PrivateRoute from "./components/PrivateRoute";
import FileViewer from "./components/FileViewer";
import Footer from "./components/Footer";
import ReportIssue from "./components/ReportIssue";
import Landing from "./components/Landing";
import "./App.css";
import api from "./api";

const year1Subjects = [
  "Mathematics",
  "Physics",
  "Fundamentals of Programming",
  "Database",
  "English",
  "Networking",
  "PHP",
  "JavaScript",
  "Embedded Systems",
  "Web User Interface",
  "Graphical User Interface",
  "Computer Basics",
  "Short Courses",
];

const year2Subjects = [
  "Mathematics",
  "Physics",
  "Data Structures with C++",
  "Advanced Networking",
  "OOP and Web Development with Java",
  "Software Engineering",
  "Advanced Database",
  "English",
  "Embedded Systems (Integrate Hardware with Software)",
  "Web 3 with Solidity",
  "3D Modelling with Blender",
  "Short Courses",
];

const year3Subjects = [
  "Mathematics",
  "Physics",
  "Machine Learning with Python",
  "Cybersecurity",
  "DevOps",
  "English",
  "Intelligent Robotics and Some Embedded Systems",
  "Mobile Apps Development with React Native",
  "Information Technology with Project Management",
  "Short Courses",
];

const allSubjectsByYear = {
  1: year1Subjects,
  2: year2Subjects,
  3: year3Subjects,
};

const typeColors = {
  pdf: { bg: "#2563eb", label: "PDF" },
  docx: { bg: "#2563eb", label: "DOCX" },
  pptx: { bg: "#f97316", label: "PPTX" },
  doc: { bg: "#2563eb", label: "DOC" },
};

function getTypeInfo(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  return typeColors[ext] || { bg: "#6b7280", label: ext.toUpperCase() };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
}

function RecentlyAdded() {
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    api
      .get("/papers?sort=recent&limit=5")
      .then(({ data }) =>
        setPapers(Array.isArray(data) ? data.slice(0, 5) : []),
      )
      .catch(() => setPapers([]));
  }, []);

  if (papers.length === 0) return null;

  return (
    <div className="recently-added-section">
      <div className="recently-added-inner">
        <div className="recently-added-header">
          <div>
            <div
              className="recently-added-title-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
              <h2 className="recently-added-title">Recently Added</h2>
            </div>
            <p className="recently-added-sub">
              Latest materials uploaded by RCA
            </p>
          </div>
          <a
            href="#subjects"
            className="view-all-link"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            View all →
          </a>
        </div>

        <div className="recently-added-grid">
          {papers.map((paper) => {
            const typeInfo = getTypeInfo(paper.filename || paper.title || "");
            return (
              <a
                key={paper.id}
                href={`/view/${paper.id}`}
                className="recent-card"
              >
                <div
                  className="recent-card-icon"
                  style={{ background: typeInfo.bg }}
                >
                  {typeInfo.label}
                </div>
                <div className="recent-card-title">{paper.title}</div>
                <div className="recent-card-meta">
                  {typeInfo.label} · Year {paper.year}
                </div>
                <div className="recent-card-age">
                  {timeAgo(paper.uploadedAt)}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PaperCard({ paper }) {
  const date = new Date(paper.uploadedAt).toLocaleDateString();
  const meta = `${paper.subject} • Year ${paper.year} • ${paper.type} • Uploaded by ${paper.uploadedBy} • ${date}`;

  return (
    <div className="paper-card">
      <div className="paper-info">
        <strong>{paper.title}</strong>
        <span className="paper-meta">{meta}</span>
      </div>
      <div className="paper-actions">
        <a
          href={`/view/${paper.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="view-btn"
        >
          View
        </a>
        <a href={`/api/papers/${paper.id}/download`} className="download-btn">
          Download
        </a>
      </div>
    </div>
  );
}

function HomeContent({
  search,
  setSearch,
  onSearch,
  results,
  loading,
  clearSearch,
  activeYear,
  setActiveYear,
  isDarkMode,
  toggleDarkMode,
}) {
  return (
    <div className="page-layout-with-sidebar" id="years">
      <Sidebar
        activeYear={activeYear}
        onYearChange={setActiveYear}
        allYears={[1, 2, 3]}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <div className="main-content-panel">
        {results !== null ? (
          <>
            <SearchBar
              search={search}
              setSearch={setSearch}
              onSearch={onSearch}
            />
            <div className="search-results-section">
              <div className="search-results-header">
                <h3>
                  {loading
                    ? "Searching..."
                    : `${results.length} result(s) for "${search}"`}
                </h3>
                <button className="clear-search-btn" onClick={clearSearch}>
                  Clear search
                </button>
              </div>
              {results.length === 0 ? (
                <p className="no-results">No papers found for "{search}".</p>
              ) : (
                <div>
                  {results.map((paper) => (
                    <PaperCard key={paper.id} paper={paper} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="home-hero">
              <SearchBar
                search={search}
                setSearch={setSearch}
                onSearch={onSearch}
              />
              <Stats />
            </div>
            <div className="home-after-hero">
              <SubjectsList
                subjects={allSubjectsByYear[activeYear]}
                activeYear={activeYear}
              />
              <RecentlyAdded />
            </div>
          </>
        )}
        <Footer />
      </div>
    </div>
  );
}

// ─── Simple Signup page (for students) ───────────────────────────────────────

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    otp: "",
  });
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, operation: "signup" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
      setInfo("Verification code sent to your email.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!otpSent) {
      await sendOtp();
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          otp: form.otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      setInfo("Account created! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="archive-auth-shell" style={{ justifyContent: "center" }}>
        <section
          className="auth-panel"
          style={{ width: "100%", maxWidth: "460px" }}
        >
          <div className="auth-card">
            <h1 className="form-title">Create student account</h1>
            <p className="form-subtitle">
              Join RCA Archive to access study materials and past papers.
            </p>

            {error ? <div className="error-msg">{error}</div> : null}
            {info ? <div className="success-msg">{info}</div> : null}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="auth-label active">Email</label>
                <div className="input-shell">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="your@email.com"
                    required
                    disabled={otpSent}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="auth-label active">Username</label>
                <div className="input-shell">
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="Choose a username"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="auth-label active">Password</label>
                <div className="input-shell">
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
              </div>
              {otpSent && (
                <div className="form-group">
                  <label className="auth-label active">Verification code</label>
                  <div className="input-shell">
                    <input
                      type="text"
                      value={form.otp}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, otp: e.target.value }))
                      }
                      placeholder="Enter code from email"
                      required
                    />
                  </div>
                </div>
              )}
              <button type="submit" className="login-btn" disabled={loading}>
                <span
                  className={loading ? "button-text hidden" : "button-text"}
                >
                  {otpSent ? "Create account" : "Send verification code"}
                </span>
                {loading && <span className="button-spinner" />}
              </button>
            </form>

            <div
              className="form-footer"
              style={{ marginTop: "16px", textAlign: "center" }}
            >
              <button
                type="button"
                className="toggle-link"
                onClick={() => navigate("/login")}
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeYear, setActiveYear] = useState(2);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const location = useLocation();

  useEffect(() => {
    document.body.classList.toggle("light-mode", !isDarkMode);
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((d) => !d);

  useEffect(() => {
    if (location.pathname !== "/") return;
    const params = new URLSearchParams(location.search);
    const yearParam = parseInt(params.get("year"), 10);
    if ([1, 2, 3].includes(yearParam) && yearParam !== activeYear) {
      setActiveYear(yearParam);
    }
    if (location.hash) {
      setTimeout(() => {
        const target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location, activeYear]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        "/papers?search=" + encodeURIComponent(search),
      );
      setResults(data);
    } catch (err) {
      console.error("Search failed", err);
    }
    setLoading(false);
  };

  const clearSearch = () => {
    setResults(null);
    setSearch("");
  };

  return (
    <div className="app-container">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Admin only */}
        <Route
          path="/admin"
          element={
            <PrivateRoute requiredRole="admin">
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        {/* Authenticated routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomeContent
                search={search}
                setSearch={setSearch}
                onSearch={handleSearch}
                results={results}
                loading={loading}
                clearSearch={clearSearch}
                activeYear={activeYear}
                setActiveYear={setActiveYear}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
              />
            </PrivateRoute>
          }
        />
        <Route
          path="/view/:id"
          element={
            <PrivateRoute>
              <FileViewer />
            </PrivateRoute>
          }
        />
        <Route
          path="/subject/:year/:subject"
          element={
            <PrivateRoute>
              <div className="page-layout-with-sidebar">
                <Sidebar
                  activeYear={activeYear}
                  onYearChange={setActiveYear}
                  allYears={[1, 2, 3]}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                />
                <div className="main-content-panel">
                  <SubjectPage />
                  <Footer />
                </div>
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/report-issue"
          element={
            <PrivateRoute>
              <div className="page-layout-with-sidebar">
                <Sidebar
                  activeYear={activeYear}
                  onYearChange={setActiveYear}
                  allYears={[1, 2, 3]}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                />
                <div className="main-content-panel">
                  <ReportIssue />
                  <Footer />
                </div>
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;

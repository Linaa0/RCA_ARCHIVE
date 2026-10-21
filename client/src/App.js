import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import DashboardShell from "./layouts/DashboardShell";
import DashboardHome from "./components/DashboardHome";
import SubjectsList from "./components/SubjectsList";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./components/ResetPassword";
import AdminDashboard from "./components/AdminDashboard";
import SubjectPage from "./components/SubjectPage";
import PrivateRoute from "./components/PrivateRoute";
import FileViewer from "./components/FileViewer";
import ReportIssue from "./components/ReportIssue";
import Landing from "./components/Landing";
import NotFound from "./components/NotFound";
import "./styles/App.css";
import api from "./services/api";
import { isAuthenticated, getStoredRole } from "./utils/auth";

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

function PaperResultCard({ paper }) {
  const date = new Date(paper.uploadedAt).toLocaleDateString();
  const meta = `${paper.subject} • Year ${paper.year} • ${paper.type} • Uploaded by ${paper.uploadedBy || "Faculty"} • ${date}`;

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "20px 24px",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: "240px" }}>
        <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
          {paper.title}
        </strong>
        <span style={{ fontSize: "0.825rem", color: "var(--text-tertiary)" }}>{meta}</span>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <a
          href={`/view/${paper.id}`}
          style={{
            padding: "8px 22px",
            borderRadius: "999px",
            background: "var(--primary-accent)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(91, 115, 224, 0.25)",
          }}
        >
          View
        </a>
        <a
          href={`/api/papers/${paper.id}/download`}
          style={{
            padding: "8px 22px",
            borderRadius: "999px",
            background: "var(--canvas-bg)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Download
        </a>
      </div>
    </div>
  );
}

function AuthenticatedHome({
  search,
  setSearch,
  handleSearch,
  results,
  loading,
  clearSearch,
  activeYear,
  setActiveYear,
  papers,
}) {
  return (
    <DashboardShell onSearch={handleSearch} currentSearch={search}>
      {results !== null ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--primary-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Search Results
              </span>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: "2px" }}>
                {loading ? "Searching archive..." : `${results.length} result(s) for "${search}"`}
              </h2>
            </div>
            <button
              onClick={clearSearch}
              style={{
                padding: "8px 20px",
                borderRadius: "999px",
                background: "var(--canvas-bg)",
                border: "1px solid var(--border-subtle)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Clear search
            </button>
          </div>

          {results.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              No papers found matching "{search}". Try searching by subject or exam type.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {results.map((paper) => (
                <PaperResultCard key={paper.id} paper={paper} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <DashboardHome papers={papers} />

          {/* Subjects explorer section */}
          <div
            id="subjects"
            style={{
              marginTop: "36px",
              background: "#ffffff",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--primary-accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Curriculum Repository
                </span>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "2px" }}>
                  Explore Subjects by Cohort
                </h3>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {[1, 2, 3].map((y) => (
                  <button
                    key={y}
                    onClick={() => setActiveYear(y)}
                    style={{
                      padding: "8px 22px",
                      borderRadius: "999px",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      border: "1px solid var(--border-subtle)",
                      background: activeYear === y ? "var(--sidebar-bg)" : "#ffffff",
                      color: activeYear === y ? "#ffffff" : "var(--text-secondary)",
                      cursor: "pointer",
                      boxShadow: activeYear === y ? "0 4px 12px rgba(59, 76, 163, 0.25)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Year {y}
                  </button>
                ))}
              </div>
            </div>

            <SubjectsList subjects={allSubjectsByYear[activeYear]} activeYear={activeYear} />
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function App() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeYear, setActiveYear] = useState(2);
  const [papers, setPapers] = useState([]);
  const location = useLocation();

  useEffect(() => {
    // Fetch papers for dashboard widgets
    api
      .get("/papers?sort=recent&limit=12")
      .then(({ data }) => setPapers(Array.isArray(data) ? data : []))
      .catch(() => setPapers([]));
  }, []);

  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/home") return;
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

  const handleSearch = async (term) => {
    const query = typeof term === "string" ? term : search;
    if (!query || !query.trim()) return;
    setLoading(true);
    setSearch(query);
    try {
      const { data } = await api.get("/papers?search=" + encodeURIComponent(query));
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
        {/* Landing page (public) */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to={getStoredRole() === "admin" ? "/admin" : "/home"} replace />
            ) : (
              <Landing />
            )
          }
        />

        {/* Auth routes */}
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

        {/* Authenticated routes in DashboardShell */}
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <AuthenticatedHome
                search={search}
                setSearch={setSearch}
                handleSearch={handleSearch}
                results={results}
                loading={loading}
                clearSearch={clearSearch}
                activeYear={activeYear}
                setActiveYear={setActiveYear}
                papers={papers}
              />
            </PrivateRoute>
          }
        />

        <Route
          path="/subject/:year/:subject"
          element={
            <PrivateRoute>
              <DashboardShell>
                <SubjectPage />
              </DashboardShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/report-issue"
          element={
            <PrivateRoute>
              <DashboardShell>
                <ReportIssue />
              </DashboardShell>
            </PrivateRoute>
          }
        />

        {/* Dedicated File Viewer (full-screen focus) */}
        <Route
          path="/view/:id"
          element={
            <PrivateRoute>
              <FileViewer />
            </PrivateRoute>
          }
        />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;

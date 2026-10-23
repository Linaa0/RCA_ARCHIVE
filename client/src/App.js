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
import { isAuthenticated, getStoredRole, getHomePathForRole } from "./utils/auth";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import TeacherAssignments from "./components/teacher/TeacherAssignments";
import TeacherAppeals from "./components/teacher/TeacherAppeals";
import TeacherResources from "./components/teacher/TeacherResources";
import StudentAssignments from "./components/student/StudentAssignments";
import StudentAssignmentsWidget from "./components/student/StudentAssignmentsWidget";
import Profile from "./components/Profile";
import curriculumService from "./services/curriculum";

function PaperResultCard({ paper }) {
  const date = new Date(paper.uploadedAt).toLocaleDateString();
  const meta = `${paper.subject} • Year ${paper.year} • ${paper.type} • Uploaded by ${paper.uploadedBy || "Faculty"} • ${date}`;

  return (
    <div
      style={{
        background: "var(--color-card)",
        borderRadius: "18px",
        padding: "20px 24px",
        border: "1px solid var(--color-card-border)",
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
  activePromotionId,
  setActivePromotionId,
  papers,
}) {
  const promotions = curriculumService.getPromotions();
  const currentPromo = curriculumService.getPromotion(activePromotionId) || promotions[0];
  const subjects = currentPromo ? currentPromo.subjects : [];

  return (
    <DashboardShell onSearch={handleSearch} currentSearch={search}>
      {results !== null ? (
        <div
          style={{
            background: "var(--color-card)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--color-card-border)",
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
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: "2px", color: "var(--color-ink)" }}>
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
                color: "var(--text-primary)",
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
          {getStoredRole() === "student" && <StudentAssignmentsWidget />}
          <DashboardHome papers={papers} />

          {/* Subjects explorer section */}
          <div
            id="subjects"
            style={{
              marginTop: "36px",
              background: "var(--color-card)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--color-card-border)",
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
                    color: "var(--color-indigo-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Curriculum Repository
                </span>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "2px", color: "var(--color-ink)" }}>
                  Explore Subjects by Promotion
                </h3>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {promotions.map((promo) => {
                  const isSelected = (currentPromo?.id || "").toLowerCase() === promo.id.toLowerCase();
                  return (
                    <button
                      key={promo.id}
                      onClick={() => setActivePromotionId(promo.id)}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "999px",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        border: isSelected ? "1px solid var(--color-indigo-500)" : "1px solid var(--color-border-med)",
                        background: isSelected ? "var(--color-indigo-600)" : "var(--color-surface-subtle)",
                        color: isSelected ? "#ffffff" : "var(--text-secondary)",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 4px 12px rgba(59, 76, 163, 0.25)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {promo.id === "Y1GenAI" ? "Year 1 GenAI" : promo.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <SubjectsList
              subjects={subjects}
              activePromotion={currentPromo}
            />
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
  const [activePromotionId, setActivePromotionId] = useState("Y1");
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
    const promoParam = params.get("promotion") || params.get("year");
    if (promoParam) {
      const match = curriculumService.getPromotion(promoParam);
      if (match && match.id !== activePromotionId) {
        setActivePromotionId(match.id);
      } else if (["1", "2", "3"].includes(promoParam)) {
        setActivePromotionId(`Y${promoParam}`);
      }
    }
    if (location.hash) {
      setTimeout(() => {
        const target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location, activePromotionId]);

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
              <Navigate to={getHomePathForRole(getStoredRole())} replace />
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
              <DashboardShell>
                <AdminDashboard />
              </DashboardShell>
            </PrivateRoute>
          }
        />

        {/* Teacher only */}
        <Route
          path="/teacher"
          element={
            <PrivateRoute requiredRole="teacher">
              <DashboardShell>
                <TeacherDashboard />
              </DashboardShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/assignments"
          element={
            <PrivateRoute requiredRole="teacher">
              <DashboardShell>
                <TeacherAssignments />
              </DashboardShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/resources"
          element={
            <PrivateRoute requiredRole="teacher">
              <DashboardShell>
                <TeacherResources />
              </DashboardShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/appeals"
          element={
            <PrivateRoute requiredRole="teacher">
              <DashboardShell>
                <TeacherAppeals />
              </DashboardShell>
            </PrivateRoute>
          }
        />

        {/* Student only */}
        <Route
          path="/student/assignments"
          element={
            <PrivateRoute requiredRole="student">
              <DashboardShell>
                <StudentAssignments />
              </DashboardShell>
            </PrivateRoute>
          }
        />

        {/* Profile (any logged-in role) */}
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <DashboardShell>
                <Profile />
              </DashboardShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <DashboardShell>
                <Profile />
              </DashboardShell>
            </PrivateRoute>
          }
        />
        <Route path="/subjects" element={<Navigate to="/home#subjects" replace />} />
        <Route path="/academic-years" element={<Navigate to="/home" replace />} />

        {/* Authenticated routes in DashboardShell */}
        <Route
          path="/home"
          element={
            <PrivateRoute requiredRole={["student", "admin"]}>
              <AuthenticatedHome
                search={search}
                setSearch={setSearch}
                handleSearch={handleSearch}
                results={results}
                loading={loading}
                clearSearch={clearSearch}
                activePromotionId={activePromotionId}
                setActivePromotionId={setActivePromotionId}
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

import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import "./styles/App.css";
import api, { openPaperDownload, apiUrl, API_ROOT } from "./services/api";
import { isAuthenticated, getStoredRole, getHomePathForRole, initAuthSync } from "./utils/auth";
import { applyTheme, getThemePreference } from "./utils/theme";
import curriculumService from "./services/curriculum";

const DashboardShell = lazy(() => import("./layouts/DashboardShell"));
const DashboardHome = lazy(() => import("./components/DashboardHome"));
const SubjectsList = lazy(() => import("./components/SubjectsList"));
const Login = lazy(() => import("./components/Login"));
const Signup = lazy(() => import("./components/Signup"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const SubjectPage = lazy(() => import("./components/SubjectPage"));
const FileViewer = lazy(() => import("./components/FileViewer"));
const Landing = lazy(() => import("./components/Landing"));
const NotFound = lazy(() => import("./components/NotFound"));
const TeacherDashboard = lazy(() => import("./components/teacher/TeacherDashboard"));
const TeacherAssignments = lazy(() => import("./components/teacher/TeacherAssignments"));
const TeacherAppeals = lazy(() => import("./components/teacher/TeacherAppeals"));
const TeacherResources = lazy(() => import("./components/teacher/TeacherResources"));
const StudentAssignments = lazy(() => import("./components/student/StudentAssignments"));
const Profile = lazy(() => import("./components/Profile"));
const ThemeShowcase = lazy(() => import("./components/ThemeShowcase"));

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
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "8px 22px",
            borderRadius: "999px",
            background: "var(--primary-accent)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(11, 45, 82, 0.25)",
          }}
        >
          View
        </a>
        <button
          type="button"
          onClick={() => openPaperDownload(paper.id)}
          style={{
            padding: "8px 22px",
            borderRadius: "999px",
            background: "var(--canvas-bg)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Download
        </button>
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
          {["student", "admin"].includes(getStoredRole()) && <StudentAssignmentsWidget />}
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
                        boxShadow: isSelected ? "0 4px 12px rgba(11, 45, 82, 0.25)" : "none",
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
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  useEffect(() => {
    const cleanup = initAuthSync(() => {
      navigate("/login");
    });
    return cleanup;
  }, [navigate]);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const response = await fetch(apiUrl("/api/health"), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        setServerUnreachable(false);
      } else {
        setServerUnreachable(true);
      }
    } catch (_) {
      setServerUnreachable(true);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useLayoutEffect(() => {
    if (!isAuthPage) return undefined;

    document.documentElement.setAttribute("data-theme", "light");
    return () => applyTheme(getThemePreference());
  }, [isAuthPage]);

  useEffect(() => {
    if (location.pathname !== "/home") return undefined;
    let isMounted = true;

    // Fetch papers for dashboard widgets
    api
      .get("/papers?sort=recent&limit=12")
      .then(({ data }) => {
        if (isMounted) setPapers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (isMounted) setPapers([]);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

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
      {serverUnreachable && (
        <div
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            borderBottom: "1px solid #f87171",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            fontSize: "0.9rem",
            fontWeight: 500,
            position: "sticky",
            top: 0,
            zIndex: 9999,
            textAlign: "center",
          }}
        >
          <span>We cannot reach the server right now.</span>
          <button
            type="button"
            onClick={checkHealth}
            disabled={checkingHealth}
            style={{
              padding: "4px 12px",
              background: "#991b1b",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: checkingHealth ? "default" : "pointer",
            }}
          >
            {checkingHealth ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
      <Suspense
        fallback={
          <div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            Loading page...
          </div>
        }
      >
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
        <Route path="/landing" element={<Landing />} />

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
            <PrivateRoute requiredRole={["student", "admin"]}>
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

        {/* Dedicated File Viewer (full-screen focus) */}
        <Route path="/view/:id" element={<FileViewer />} />

        {/* Developer Theme Showcase */}
        <Route path="/__theme" element={<ThemeShowcase />} />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </div>
  );
}

export default App;

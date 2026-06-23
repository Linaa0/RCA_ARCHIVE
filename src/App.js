import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import SearchBar from "./components/SearchBar";
import Stats from "./components/Stats";
import SubjectsList from "./components/SubjectsList";
import Login from "./components/Login";
import ResetPassword from "./components/ResetPassword";
import SubjectPage from "./components/SubjectPage";
import PrivateRoute from "./components/PrivateRoute";
import FileViewer from "./components/FileViewer";
import Footer from "./components/Footer";
import ReportIssue from "./components/ReportIssue";
import "./App.css";
import api from './api';

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

const allSubjectsByYear = { 1: year1Subjects, 2: year2Subjects, 3: year3Subjects };

// File type → coloured label
const typeColors = {
  pdf:  { bg: "#2563eb", label: "PDF" },
  docx: { bg: "#2563eb", label: "DOCX" },
  pptx: { bg: "#f97316", label: "PPTX" },
  doc:  { bg: "#2563eb", label: "DOC" },
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
    api.get("/papers?sort=recent&limit=5")
      .then(({ data }) => setPapers(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setPapers([]));
  }, []);

  if (papers.length === 0) return null;

  return (
    <div className="recently-added-section">
      <div className="recently-added-inner">
        <div className="recently-added-header">
          <div>
            <div className="recently-added-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
              </svg>
              <h2 className="recently-added-title">Recently Added</h2>
            </div>
            <p className="recently-added-sub">Latest materials uploaded by RCA</p>
          </div>
          <a href="#subjects" className="view-all-link" style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500, fontFamily: "Inter, sans-serif" }}>
            View all →
          </a>
        </div>

        <div className="recently-added-grid">
          {papers.map((paper) => {
            const typeInfo = getTypeInfo(paper.filename || paper.title || "");
            return (
              <a key={paper.id} href={`/view/${paper.id}`} className="recent-card">
                <div className="recent-card-icon" style={{ background: typeInfo.bg }}>
                  {typeInfo.label}
                </div>
                <div className="recent-card-title">{paper.title}</div>
                <div className="recent-card-meta">
                  {typeInfo.label} · Year {paper.year}
                </div>
                <div className="recent-card-age">{timeAgo(paper.uploadedAt)}</div>
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
  const meta =
    paper.subject +
    " • Year " +
    paper.year +
    " • " +
    paper.type +
    " • Uploaded by " +
    paper.uploadedBy +
    " • " +
    date;

  return (
    <div className="paper-card">
      <div className="paper-info">
        <strong>{paper.title}</strong>
        <span className="paper-meta">{meta}</span>
      </div>
      <div className="paper-actions">
        <a href={`/view/${paper.id}`} target="_blank" rel="noopener noreferrer" className="view-btn">
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
  setActiveYear 
}) {
  return (
    <div className="page-layout-with-sidebar" id="years">
      <Sidebar activeYear={activeYear} onYearChange={setActiveYear} allYears={[1, 2, 3]} />
      
      <div className="main-content-panel">
        {results !== null ? (
          <>
            <SearchBar search={search} setSearch={setSearch} onSearch={onSearch} />
            <div className="search-results-section">
              <div className="search-results-header">
                <h3>
                  {loading
                    ? "Searching..."
                    : results.length + ' result(s) for "' + search + '"'}
                </h3>
                <button className="clear-search-btn" onClick={clearSearch}>
                  Clear search
                </button>
              </div>
              {results.length === 0 ? (
                <p className="no-results">No papers found for "{search}".</p>
              ) : (
                <div>
                  {results.map(function (paper) {
                    return <PaperCard key={paper.id} paper={paper} />;
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="home-hero">
              <SearchBar search={search} setSearch={setSearch} onSearch={onSearch} />
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

function App() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeYear, setActiveYear] = useState(2);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const publicPaths = ["/login", "/reset-password"];
    const isPublic = publicPaths.some((path) => location.pathname === path || location.pathname.startsWith(path));
    if (!token && !isPublic) {
      navigate("/login", { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(location.search);
    const yearParam = parseInt(params.get("year"), 10);
    if ([1, 2, 3].includes(yearParam) && yearParam !== activeYear) {
      setActiveYear(yearParam);
    }

    // Scroll to hash if present (with a small delay to allow DOM updates)
    if (location.hash) {
      setTimeout(() => {
        const target = document.getElementById(location.hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [location, activeYear]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get('/papers?search=' + encodeURIComponent(search));
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
        <Route path="/login" element={<Login />} />
        <Route
          path="/view/:id"
          element={
            <PrivateRoute>
              <FileViewer />
            </PrivateRoute>
          }
        />
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
              />
            </PrivateRoute>
          }
        />
        <Route
          path="/subject/:year/:subject"
          element={
            <PrivateRoute>
              <div className="page-layout-with-sidebar">
                <Sidebar activeYear={activeYear} onYearChange={setActiveYear} allYears={[1, 2, 3]} />
                <div className="main-content-panel">
                  <SubjectPage />
                  <Footer />
                </div>
              </div>
            </PrivateRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/report-issue"
          element={
            <PrivateRoute>
              <div className="page-layout-with-sidebar">
                <Sidebar activeYear={activeYear} onYearChange={setActiveYear} allYears={[1, 2, 3]} />
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

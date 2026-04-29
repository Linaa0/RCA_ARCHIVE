import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./components/SearchBar";
import Stats from "./components/Stats";
import SubjectsList from "./components/SubjectsList";
import Login from "./components/Login";
import SubjectPage from "./components/SubjectPage";
import PrivateRoute from "./components/PrivateRoute";
import "./App.css";

const year1Subjects = [
  "Mathematics", "Physics", "Fundamentals of Programming", "Database",
  "English", "Networking", "PHP", "JavaScript", "Embedded Systems",
  "Web User Interface", "Graphical User Interface",
  "Computer Basics", "Short Courses",
];

const year2Subjects = [
  "Mathematics", "Physics", "Data Structures with C++", "Advanced Networking",
  "OOP and Web Development with Java", "Software Engineering", "Advanced Database",
  "English", "Embedded Systems (Integrate Hardware with Software)",
  "Web 3 with Solidity", "3D Modelling with Blender","Short Courses",
];

const year3Subjects = [
  "Mathematics", "Physics", "Machine Learning with Python", "Cybersecurity",
  "DevOps", "English", "Intelligent Robotics and Some Embedded Systems",
  "Mobile Apps Development with React Native",
  "Information Technology with Project Management","Short Courses",
];

function PaperCard({ paper }) {
  const date = new Date(paper.uploadedAt).toLocaleDateString();
  const meta = paper.subject + " • Year " + paper.year + " • " + paper.type + " • Uploaded by " + paper.uploadedBy + " • " + date;
  const fileUrl = "http://localhost:5000/uploads/" + paper.filename;

  return (
    <div className="paper-card">
      <div className="paper-info">
        <strong>{paper.title}</strong>
        <span className="paper-meta">{meta}</span>
      </div>
      <a href={fileUrl} target="_blank" rel="noreferrer" className="download-btn">
        Download
      </a>
    </div>
  );
}

function HomeContent({ search, setSearch, onSearch, results, loading, clearSearch }) {
  return (
    <div>
      <Navbar />
      <SearchBar search={search} setSearch={setSearch} onSearch={onSearch} />

      {results !== null ? (
        <div className="search-results-section">
          <div className="search-results-header">
            <h3>{loading ? "Searching..." : results.length + " result(s) for \"" + search + "\""}</h3>
            <button className="clear-search-btn" onClick={clearSearch}>Clear search</button>
          </div>
          {results.length === 0 ? (
            <p className="no-results">No papers found for "{search}".</p>
          ) : (
            <div>
              {results.map(function(paper) {
                return <PaperCard key={paper.id} paper={paper} />;
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <Stats />
          <SubjectsList year={1} subjects={year1Subjects} />
          <SubjectsList year={2} subjects={year2Subjects} />
          <SubjectsList year={3} subjects={year3Subjects} />
        </div>
      )}

      <footer className="footer">
        Rwanda Coding Academy Past Papers &amp; Notes System — Years 1-3
      </footer>
    </div>
  );
}

function App() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:5000/api/papers?search=" + encodeURIComponent(search)
      );
      const data = await res.json();
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
              />
            </PrivateRoute>
          }
        />

        <Route
          path="/subject/:year/:subject"
          element={
            <PrivateRoute>
              <div>
                <Navbar />
                <SubjectPage />
                <footer className="footer">
                  Rwanda Coding Academy Past Papers &amp; Notes System — Years 1-3
                </footer>
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
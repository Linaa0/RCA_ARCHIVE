import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./SubjectsList.css";
import api from '../api';

function getSubjectIcon(subject) {
  // Return clipboard SVG for all subjects
  return { 
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    bg: "#eff6ff",
    color: "#2563eb"
  };
}

function SubjectCard({ year, subject }) {
  const [count, setCount] = useState(null);
  const iconMeta = getSubjectIcon(subject);

  useEffect(() => {
    api
      .get(`/papers?subject=${encodeURIComponent(subject)}&year=${year}`)
      .then(({ data }) => setCount(data.length))
      .catch(() => setCount(0));
  }, [subject, year]);

  return (
    <Link to={`/subject/${year}/${subject}`} className="subject-card">
      <div className="subject-card-top">
        <div className="subject-icon" style={{ background: iconMeta.bg, color: iconMeta.color }}>
          {iconMeta.svg}
        </div>
        <h3>{subject}</h3>
      </div>
      <p>{count === null ? "0 file(s)" : `${count} file(s)`}</p>
      <div className="subject-card-footer">
        <span className="subject-link-text">Past Papers &amp; Notes</span>
        <span className="subject-arrow">→</span>
      </div>
    </Link>
  );
}

function SubjectsList({ subjects, activeYear }) {
  return (
    <div className="subjects-wrapper-grid-only" id="subjects">
      <div className="subjects-section-header">
        <div>
          <h2 className="subjects-section-title">Year {activeYear} Subjects</h2>
          <p className="subjects-section-sub">Browse and access all subjects for Year {activeYear}</p>
        </div>
        <a href="#subjects" className="view-all-link">View all subjects →</a>
      </div>

      <div className="subjects-grid">
        {subjects.map((subject, index) => (
          <SubjectCard key={index} year={activeYear} subject={subject} />
        ))}
      </div>
    </div>
  );
}

export default SubjectsList;
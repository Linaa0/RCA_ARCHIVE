import React from "react";
import { useParams, Link } from "react-router-dom";
import "./SubjectPage.css";

function SubjectPage() {
  const { year, subject } = useParams();

  return (
    <div className="subject-page">
      <nav className="subject-nav">
        <Link to="/" className="back-link">← Back to Home</Link>
      </nav>

      <h2>{subject} — Year {year}</h2>

      <div className="filters">
        <input type="text" placeholder="Search" />
        <select>
          <option>All Years</option>
          <option>Year 1</option>
          <option>Year 2</option>
          <option>Year 3</option>
        </select>
        <select>
          <option>All Types</option>
          <option>Notes</option>
          <option>Past Papers</option>
        </select>
        <button className="search-btn">Search</button>
      </div>

      <div className="results">
        <p>0 result(s) found</p>
        <p>No papers found. Try changing your search or filters.</p>
      </div>
    </div>
  );
}

export default SubjectPage;

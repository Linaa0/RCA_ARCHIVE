import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./SubjectsList.css";

function SubjectCard({ year, subject }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    fetch(`/api/papers?subject=${encodeURIComponent(subject)}&year=${year}`)
      .then((res) => res.json())
      .then((data) => setCount(data.length))
      .catch(() => setCount(0));
  }, [subject, year]);

  return (
    <Link to={`/subject/${year}/${subject}`} className="subject-card">
      <h3>{subject}</h3>
      <p>Year {year}: {count === null ? "..." : count + " file(s)"}</p>
    </Link>
  );
}

function SubjectsList({ year, subjects }) {
  return (
    <div className="subjects-section">
      <h2>Year {year} Subjects</h2>
      <div className="subjects-grid">
        {subjects.map((subject, index) => (
          <SubjectCard key={index} year={year} subject={subject} />
        ))}
      </div>
    </div>
  );
}

export default SubjectsList;
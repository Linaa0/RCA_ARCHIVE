import React from "react";
import { Link } from "react-router-dom";
import "./SubjectsList.css";

function SubjectsList({ year, subjects }) {
  return (
    <>
    <div className="subjects-section">
      <h2>Year {year} Subjects</h2>
      <div className="subjects-grid">
        {subjects.map((subject, index) => (
          <Link 
            key={index} 
            to={`/subject/${year}/${subject}`} 
            className="subject-card"
          >
            <h3>{subject}</h3>
            <p>Year {year}: 0 file(s)</p>
          </Link>
        ))}
      </div>
    </div>
 </>
  );
}



export default SubjectsList;

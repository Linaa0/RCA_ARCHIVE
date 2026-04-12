import React from "react";
import "./Stats.css";

function Stats() {
  return (
    <div className="stats">
      <div className="stat-box">
        <div className="stat-number">0</div>
        <div className="stat-label">Total Papers & Notes</div>
      </div>
      <div className="stat-box">
        <div className="stat-number">31</div>
        <div className="stat-label">Subjects Available</div>
      </div>
      <div className="stat-box">
        <div className="stat-number">2026</div>
        <div className="stat-label">Latest Academic Year</div>
      </div>
    </div>
  );
}

export default Stats;

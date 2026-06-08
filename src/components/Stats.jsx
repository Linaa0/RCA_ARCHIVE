import React, { useEffect, useState } from "react";
import "./Stats.css";

function Stats() {
  const [totalPapers, setTotalPapers] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setTotalPapers(data.totalPapers ?? 0);
      } catch (err) {
        console.error("Failed to load stats", err);
        setTotalPapers(0);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="stats">
      <div className="stat-box">
        <div className="stat-number">{totalPapers === null ? "..." : totalPapers}</div>
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

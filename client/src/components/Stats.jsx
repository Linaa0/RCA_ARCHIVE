import React, { useEffect, useState } from "react";
import "./Stats.css";
import api from '../api';

function Stats() {
  const [totalPapers, setTotalPapers] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/stats');
        setTotalPapers(data.totalPapers ?? 0);
      } catch (err) {
        console.error("Failed to load stats", err);
        setTotalPapers(0);
      }
    };
    fetchStats();
  }, []);

  const statItems = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      color: "blue",
      value: totalPapers === null ? "..." : `${totalPapers}+`,
      label: "Past Papers & Notes",
      sub: "Available for download",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      color: "green",
      value: "31",
      label: "Subjects",
      sub: "Across all years",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
      ),
      color: "purple",
      value: "3",
      label: "Academic Years",
      sub: "Year 1, Year 2 & Year 3",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      ),
      color: "orange",
      value: "500+",
      label: "Downloads",
      sub: "By RCA students",
    },
  ];

  return (
    <div className="stats">
      {statItems.map((item, i) => (
        <div className="stat-box" key={i}>
          <div className={`stat-icon ${item.color}`}>{item.icon}</div>
          <div className="stat-text">
            <div className={`stat-number ${item.color}`}>{item.value}</div>
            <div className="stat-label">{item.label}</div>
            <div className="stat-sublabel">{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Stats;

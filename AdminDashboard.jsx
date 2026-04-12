import React from "react";
import { Link } from "react-router-dom";
import "./AdminDashboard.css";

function AdminDashboard() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Rwanda Coding Academy — Past Papers System</h2>
        <Link to="/" className="logout-btn">Logout</Link>
      </header>

      <div className="dashboard-content">
        <h3>Welcome back, admin!</h3>
        <p>Manage all past papers and notes for RCA Year 1 students from here.</p>

        <div className="dashboard-stats">
          <div className="stat-box">
            <div className="stat-number">0</div>
            <div className="stat-label">Total Papers & Notes</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">31</div>
            <div className="stat-label">Subjects</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">11</div>
            <div className="stat-label">Year 1 Subjects</div>
          </div>
        </div>

        <div className="dashboard-actions">
          <button className="action-btn">Upload New Paper / Note</button>
          <button className="action-btn">View All Papers</button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { LessonsIcon, MaterialsIcon, ForumIcon, EyeIcon, PlusIcon } from "../ui/Icons";
import TeacherHero from "./TeacherHero";
import AssignmentTable from "../assignments/AssignmentTable";
import { errorMessage } from "../assignments/common";
import { DEMO_STATS } from "./demoData";
import "../assignments/assignments.css";

function StatCard({ label, value, sub, icon, tone }) {
  return (
    <div className="th-stat">
      <div className="th-stat-label">{label}</div>
      <div className="th-stat-body">
        <div className={`th-stat-icon ${tone}`}>{icon}</div>
        <div>
          <div className="th-stat-value">{value}</div>
          <div className="th-stat-sub">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    api
      .get("/teacher/stats")
      .then(({ data }) => {
        const hasData = data.totalAssignments || data.totalResources || data.totalSubmissions || data.appealsReceived;
        setIsDemo(!hasData);
        setStats(hasData ? { ...data, upcoming: data.upcoming || [] } : DEMO_STATS);
      })
      .catch((err) => {
        setStats(DEMO_STATS);
        setIsDemo(true);
        setError(errorMessage(err, "Could not load your dashboard."));
      });
  }, []);

  return (
    <div className="asg-page">
      <TeacherHero />

      <div style={{ display: "flex", justifyContent: "flex-start", margin: "16px 0 20px" }}>
        <Link
          to="/teacher/assignments?new=1"
          className="topbar-action-pill"
          style={{ background: "#3F4FA8", color: "#FFFFFF", borderColor: "#3F4FA8", fontWeight: 700, textDecoration: "none" }}
        >
          <PlusIcon size={16} />
          <span>Give new assignment</span>
        </Link>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {stats && isDemo && <div className="asg-alert info">Showing sample teacher data for preview.</div>}

      <div className="th-stats">
        <StatCard label="Total assignments" value={stats ? stats.totalAssignments : "–"} sub="assignments sent" icon={<LessonsIcon size={24} />} tone="blue" />
        <StatCard label="Total resources" value={stats ? stats.totalResources ?? 0 : "–"} sub="resources uploaded" icon={<MaterialsIcon size={24} />} tone="green" />
        <StatCard label="Appeals" value={stats ? stats.appealsReceived : "–"} sub="appeals received" icon={<ForumIcon size={24} />} tone="orange" />
        <StatCard label="Read appeals" value={stats ? stats.readAppeals : "–"} sub={stats ? `${stats.unreadAppeals} still unread` : "appeals read"} icon={<EyeIcon size={24} />} tone="pink" />
      </div>

      <div className="asg-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Upcoming deadlines</h3>
          <Link to="/teacher/assignments" style={{ color: "#3F4FA8", fontWeight: 700, fontSize: "0.88rem" }}>
            All assignments →
          </Link>
        </div>
        {!stats ? (
          <p className="asg-sub">Loading…</p>
        ) : (
          <AssignmentTable rows={stats.upcoming} emptyText="No upcoming deadlines. Give an assignment to get started." />
        )}
      </div>
    </div>
  );
}

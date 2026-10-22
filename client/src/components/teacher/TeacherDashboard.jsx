import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { LessonsIcon, MaterialsIcon, ForumIcon, EyeIcon, PlusIcon } from "../ui/Icons";
import TeacherHero from "./TeacherHero";
import AssignmentTable from "../assignments/AssignmentTable";
import { errorMessage } from "../assignments/common";
import StatCardUI from "../ui/StatCard";
import "../assignments/assignments.css";

export default function TeacherDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/teacher/stats")
      .then(({ data }) => {
        setStats({
          totalAssignments: data.totalAssignments ?? 0,
          totalResources: data.totalResources ?? 0,
          appealsReceived: data.appealsReceived ?? 0,
          readAppeals: data.readAppeals ?? 0,
          unreadAppeals: data.unreadAppeals ?? 0,
          upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
        });
      })
      .catch((err) => {
        setStats({
          totalAssignments: 0,
          totalResources: 0,
          appealsReceived: 0,
          readAppeals: 0,
          unreadAppeals: 0,
          upcoming: [],
        });
        setError(errorMessage(err, "Could not load teacher statistics."));
      });
  }, []);

  return (
    <div className="asg-page" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <TeacherHero />

      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "4px" }}>
        <Link
          to="/teacher/assignments?new=1"
          style={{
            background: "var(--color-primary)",
            color: "#FFFFFF",
            padding: "8px 20px",
            borderRadius: "999px",
            fontWeight: 700,
            fontSize: "0.86rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(63, 79, 168, 0.25)",
          }}
        >
          <PlusIcon size={16} />
          <span>Give New Assignment</span>
        </Link>
      </div>

      {error && <div className="asg-alert error">{error}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        <StatCardUI
          label="Total Assignments"
          value={stats ? stats.totalAssignments : 0}
          icon={<LessonsIcon size={22} />}
          accentColor="#3F4FA8"
        />
        <StatCardUI
          label="Total Resources"
          value={stats ? stats.totalResources : 0}
          icon={<MaterialsIcon size={22} />}
          accentColor="#10B981"
        />
        <StatCardUI
          label="Appeals Received"
          value={stats ? stats.appealsReceived : 0}
          icon={<ForumIcon size={22} />}
          accentColor="#F59E0B"
        />
        <StatCardUI
          label="Unread Appeals"
          value={stats ? stats.unreadAppeals : 0}
          icon={<EyeIcon size={22} />}
          accentColor="#EC4899"
        />
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "28px 32px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Upcoming Deadlines
            </h3>
            <span style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)" }}>
              Assignments with deadlines approaching
            </span>
          </div>
          <Link to="/teacher/assignments" style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>
            All Assignments
          </Link>
        </div>

        {!stats ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>Loading deadlines...</p>
        ) : (
          <AssignmentTable rows={stats.upcoming} emptyText="No upcoming deadlines. Give an assignment to get started." />
        )}
      </div>
    </div>
  );
}

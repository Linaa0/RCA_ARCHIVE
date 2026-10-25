import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./DashboardHome.css";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import Avatar from "./ui/Avatar";
import studentGirl from "../assets/figures/student-girl.png";
import studentBoy from "../assets/figures/student-boy.png";
import neutralFigure from "../assets/figures/neutral-figure.svg";
import WaterDecoration from "./ui/WaterDecoration";
import {
  MaterialsIcon,
  EyeIcon,
  DownloadIcon,
  UploadIcon,
  DashboardIcon,
} from "./ui/Icons";
import { getStoredUser } from "../utils/auth";
import api from "../services/api";

export default function DashboardHome({
  papers = [],
  onOpenUpload,
}) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.name || user?.username || "Student";
  const firstName = displayName.split(" ")[0] || "Student";

  const [gender, setGender] = useState(() => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("rca_user_gender");
      if (stored) return stored;
    }
    return user?.gender || null;
  });

  useEffect(() => {
    const handleGenderChange = () => {
      setGender(localStorage.getItem("rca_user_gender") || user?.gender || null);
    };
    window.addEventListener("profile-gender-changed", handleGenderChange);
    return () => window.removeEventListener("profile-gender-changed", handleGenderChange);
  }, [user]);

  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    api
      .get("/papers/dashboard")
      .then(({ data }) => setDashboardData(data))
      .catch((error) => {
        console.error("Could not load dashboard paper summary:", error);
        setDashboardError("Paper statistics could not be loaded. Please refresh to try again.");
      });
  }, []);

  useEffect(() => {
    setLoadingAssignments(true);
    api
      .get("/assignments")
      .then(({ data }) => setAssignments(Array.isArray(data?.assignments) ? data.assignments : []))
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));
  }, []);

  const totalPapers = dashboardData?.totalPapers ?? papers.length;
  const topClassesLeaderboard = dashboardData?.topClasses || [];

  // Real data: Classes with assignments
  const classesWithAssignments = useMemo(() => {
    if (!assignments.length) return [];
    const classMap = new Map();
    assignments.forEach((a) => {
      const classes = Array.isArray(a.classes) ? a.classes : [];
      const labels = Array.isArray(a.classLabels) ? a.classLabels : [];
      const targets = classes.length
        ? classes.map((classId, index) => ({ id: classId, label: labels[index] || classId }))
        : labels.map((label) => ({ id: label, label }));
      if (!targets.length && (a.targetClass || a.class)) {
        const legacyClass = a.targetClass || a.class;
        targets.push({ id: legacyClass, label: legacyClass });
      }

      targets.forEach(({ id, label }) => {
        const current = classMap.get(id) || { className: label, count: 0, pending: 0 };
        current.count += 1;
        const status = a.status || (
          a.deadline && new Date(a.deadline) > new Date() ? "pending" : "overdue"
        );
        if (status === "pending" || status === "extended" || status === "overdue") {
          current.pending += 1;
        }
        classMap.set(id, current);
      });
    });

    return [...classMap.values()].map((data) => ({
      className: data.className,
      total: data.count,
      pending: data.pending,
    }));
  }, [assignments]);

  const recentPapers = dashboardData?.recentPapers || [];
  const myUploads = dashboardData?.myUploads || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {dashboardError && (
        <p role="alert" style={{ color: "var(--color-danger, #b42318)", margin: 0 }}>
          {dashboardError}
        </p>
      )}
      {/* ── Greeting Card with Student Vector Avatar ── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 100%)",
          borderRadius: "var(--radius-card)",
          padding: "32px 36px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <WaterDecoration variant="hero" />

        <div style={{ flex: 1, minWidth: "260px", position: "relative", zIndex: 1 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "4px",
              display: "block",
            }}
          >
            STUDENT DASHBOARD
          </span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "4px",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}
          >
            Welcome Back, {firstName}
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              maxWidth: "520px",
              margin: 0,
            }}
          >
            {totalPapers > 0
              ? `Access ${totalPapers} academic past papers, lecture notes, and assignments indexed for Rwanda Coding Academy cohorts.`
              : "Explore the archive repository or contribute past papers for your cohort."}
          </p>

          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const el = document.getElementById("subjects");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Browse Curriculum
            </Button>
            {onOpenUpload && (
              <Button variant="outline" size="sm" onClick={onOpenUpload}>
                Upload Paper
              </Button>
            )}
          </div>
        </div>

        {/* Student Dashboard Figure (Female, Male, or Neutral based on preference) */}
        <div
          className="dashboard-figure-wrap"
          style={{
            position: "relative",
            zIndex: 1,
            width: "136px",
            height: "136px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(23, 79, 131, 0.22) 0%, rgba(23, 79, 131, 0.08) 100%)",
            border: "3px solid var(--color-surface)",
            boxShadow: "0 8px 24px rgba(15, 20, 36, 0.15)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src={gender === "male" ? studentBoy : gender === "female" ? studentGirl : neutralFigure}
            alt={gender === "male" ? "Male Student Figure" : gender === "female" ? "Female Student Figure" : "Neutral Student Figure"}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: "scale(1.15) translateY(4%)",
            }}
          />
        </div>
      </div>

      {/* ── 2 Widgets Row: Top Classes Leaderboard & Classes with Assignments ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Top Classes Leaderboard Widget */}
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
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                }}
              >
                MOTIVATION LEADERBOARD
              </span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                Top Classes by Uploads
              </h3>
            </div>
            <Badge variant="indigo" size="sm">
              Community
            </Badge>
          </div>

          {topClassesLeaderboard.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: "16px 0" }}>
              No upload statistics recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {topClassesLeaderboard.map((item) => (
                <div
                  key={item.className}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: item.rank === 1 ? "rgba(23, 79, 131, 0.08)" : "var(--color-bg)",
                    border: item.rank === 1 ? "1px solid rgba(23, 79, 131, 0.2)" : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: item.rank === 1 ? "var(--color-primary)" : "var(--color-border)",
                        color: item.rank === 1 ? "#FFFFFF" : "var(--color-text-secondary)",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.rank}
                    </span>
                    <strong style={{ fontSize: "0.9rem", color: "var(--color-text-primary)" }}>
                      {item.className}
                    </strong>
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {item.count} upload{item.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Classes with Assignments Widget */}
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
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--color-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                }}
              >
                ACADEMIC DEADLINES
              </span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                Classes with Active Assignments
              </h3>
            </div>
            <Link
              to="/student/assignments"
              style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}
            >
              View All
            </Link>
          </div>

          {classesWithAssignments.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: "16px 0" }}>
              No assignments currently active across cohorts.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {classesWithAssignments.map((c) => (
                <div
                  key={c.className}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-bg)",
                  }}
                >
                  <strong style={{ fontSize: "0.9rem", color: "var(--color-text-primary)" }}>
                    Cohort: {c.className}
                  </strong>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Badge variant={c.pending > 0 ? "warning" : "success"} size="sm">
                      {c.pending} active
                    </Badge>
                    <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)" }}>
                      ({c.total} total)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2-Column Section: Recent Past Papers & My Uploads ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "24px",
        }}
      >
        {/* Recent Past Papers */}
        <section
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                }}
              >
                REPOSITORY ARCHIVE
              </span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                Recent Papers, Notes and Assignments
              </h3>
            </div>
          </div>

          {recentPapers.length === 0 ? (
            <EmptyState
              icon={<MaterialsIcon size={36} />}
              title="No papers in repository yet"
              description="Be the first student or faculty member to contribute past papers to the RCA archive."
              actionText="Upload Paper"
              onAction={onOpenUpload}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentPapers.map((paper) => {
                const paperId = paper.id || paper._id;
                const dateStr = paper.uploadedAt
                  ? new Date(paper.uploadedAt).toLocaleDateString()
                  : "";
                return (
                  <div
                    key={paperId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      transition: "all var(--transition-fast)",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          background: "var(--color-indigo-100, #E4E8FA)",
                          color: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.74rem",
                          flexShrink: 0,
                        }}
                      >
                        PDF
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          title={paper.title}
                          style={{
                            display: "block",
                            fontSize: "0.92rem",
                            color: "var(--color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "280px",
                          }}
                        >
                          {paper.title}
                        </strong>
                        <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                          {paper.subject} : {paper.classLabel} : {paper.type || "Past Paper"}
                          {dateStr ? ` : ${dateStr}` : ""}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <Link
                        to={`/view/${paperId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "6px 14px",
                          borderRadius: "999px",
                          background: "var(--color-primary)",
                          color: "#FFFFFF",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          textDecoration: "none",
                        }}
                      >
                        <EyeIcon size={13} /> View
                      </Link>
                      <a
                        href={`/api/papers/${paperId}/download`}
                        download
                        style={{
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-primary)",
                          fontSize: "0.8rem",
                          display: "inline-flex",
                          alignItems: "center",
                          textDecoration: "none",
                        }}
                        title="Download paper"
                      >
                        <DownloadIcon size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* My Uploads */}
        <section
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              My Uploads
            </h3>
            <Badge variant="neutral" size="sm">
              {dashboardData?.myUploadsCount ?? myUploads.length}
            </Badge>
          </div>

          {myUploads.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 16px",
                textAlign: "center",
                background: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--color-border)",
              }}
            >
              <UploadIcon size={28} style={{ color: "var(--color-text-tertiary)", marginBottom: "8px" }} />
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
                You have not contributed any past papers yet.
              </p>
              {onOpenUpload && (
                <Button variant="outline" size="sm" onClick={onOpenUpload}>
                  Upload First Paper
                </Button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {myUploads.slice(0, 5).map((up) => (
                <div
                  key={up.id || up._id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-bg)",
                    fontSize: "0.84rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    title={up.title}
                    style={{
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {up.title}
                  </span>
                  <Link
                    to={`/view/${up.id || up._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-primary)", fontWeight: 700, textDecoration: "none", flexShrink: 0 }}
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

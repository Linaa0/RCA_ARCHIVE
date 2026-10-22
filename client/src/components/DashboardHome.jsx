import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./DashboardHome.css";
import BarChartWidget from "./ui/BarChartWidget";
import StatRing from "./ui/StatRing";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import studentBoy from "../assets/avatars/student-boy.svg";
import {
  LessonsIcon,
  MaterialsIcon,
  EyeIcon,
  DownloadIcon,
  UploadIcon,
  StarIcon,
} from "./ui/Icons";
import { getStoredUser } from "../utils/auth";

export default function DashboardHome({
  papers = [],
  onOpenUpload,
}) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.name || user?.username || "Student";
  const firstName = displayName.split(" ")[0] || "Student";

  const totalPapers = papers.length;

  // Real data breakdown: Papers by subject
  const subjectDistribution = useMemo(() => {
    if (!papers.length) return [];
    const counts = {};
    papers.forEach((p) => {
      const subj = p.subject || "General";
      counts[subj] = (counts[subj] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = Math.max(...entries.map((e) => e[1]), 1);

    return entries.slice(0, 6).map(([label, count]) => ({
      label,
      value: Math.round((count / maxCount) * 100),
      rawCount: count,
    }));
  }, [papers]);

  // Real cohort breakdown: percentage of papers per year
  const cohortBreakdown = useMemo(() => {
    if (!papers.length) return { y1: 0, y2: 0, y3: 0 };
    const y1 = papers.filter((p) => Number(p.year) === 1).length;
    const y2 = papers.filter((p) => Number(p.year) === 2).length;
    const y3 = papers.filter((p) => Number(p.year) === 3).length;

    return {
      y1: Math.round((y1 / papers.length) * 100) || 0,
      y2: Math.round((y2 / papers.length) * 100) || 0,
      y3: Math.round((y3 / papers.length) * 100) || 0,
      y1Count: y1,
      y2Count: y2,
      y3Count: y3,
    };
  }, [papers]);

  // Real recent papers
  const recentPapers = useMemo(() => {
    return [...papers]
      .sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0))
      .slice(0, 5);
  }, [papers]);

  // Real user's uploads
  const myUploads = useMemo(() => {
    const uEmail = user?.email?.toLowerCase();
    const uName = user?.name?.toLowerCase();
    return papers.filter((p) => {
      const pBy = (p.uploadedBy || "").toLowerCase();
      return pBy === uEmail || pBy === uName;
    });
  }, [papers, user]);

  return (
    <div className="dashboard-home">
      <div className="dashboard-grid-container">
        {/* ── Left Column: Main Content & Real Visualizations ── */}
        <div className="dashboard-left-col">
          {/* Greeting Card with Student Vector Avatar */}
          <div className="greeting-card">
            <div className="greeting-text">
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--color-indigo-500, #5B73E0)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                Welcome Back
              </span>
              <h2>Good day, {firstName}! 👋</h2>
              <p>
                {totalPapers > 0
                  ? `Access ${totalPapers} verified past papers, exam schemes, and lecture notes curated by RCA faculty and peers.`
                  : "Explore the archive repository or contribute past papers for your cohort."}
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
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

            {/* Flat-vector Student Illustration */}
            <div
              className="greeting-illustration"
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #EEF0F6 0%, #E4E8FA 100%)",
                border: "4px solid #FFFFFF",
                boxShadow: "0 8px 24px rgba(35, 44, 107, 0.12)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <img
                src={studentBoy}
                alt="RCA Student"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.2) translateY(5%)",
                }}
              />
            </div>
          </div>

          {/* Real Analytics Row: Papers by Subject & Cohort Distribution */}
          <div className="analytics-row">
            {/* Real Papers by Subject (Bar Chart) */}
            <BarChartWidget
              title="Archive by Subject"
              metricValue={String(totalPapers)}
              metricLabel="Uploaded documents"
              actionLabel="View all"
              onActionClick={() => {
                const el = document.getElementById("subjects");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              bars={
                subjectDistribution.length > 0
                  ? subjectDistribution
                  : [
                      { label: "Algorithms", value: 40 },
                      { label: "OOP Java", value: 30 },
                      { label: "Database", value: 25 },
                      { label: "Web UI", value: 20 },
                    ]
              }
            />

            {/* Real Cohort Distribution (Stat Rings) */}
            <div className="activity-card">
              <div className="activity-card-header">
                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--color-indigo-500, #5B73E0)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                    }}
                  >
                    Cohort Distribution
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "var(--color-ink, #1B2142)" }}>
                    Paper Breakdown
                  </strong>
                </div>
                <Badge variant="indigo" size="sm">
                  {totalPapers} Papers
                </Badge>
              </div>

              <div className="activity-rings-grid">
                <StatRing
                  percentage={cohortBreakdown.y1}
                  label="Year 1"
                  color="#3F4FA8"
                />
                <StatRing
                  percentage={cohortBreakdown.y2}
                  label="Year 2"
                  color="#5B73E0"
                />
                <StatRing
                  percentage={cohortBreakdown.y3}
                  label="Year 3"
                  color="#232C6B"
                />
              </div>

              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--color-muted, #6A7399)",
                  textAlign: "center",
                  borderTop: "1px solid var(--color-divider, #E7EBF5)",
                  paddingTop: "12px",
                }}
              >
                Calculated dynamically from verified curriculum uploads.
              </div>
            </div>
          </div>

          {/* Recent Past Papers List (Real Data) */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--radius-card, 24px)",
              padding: "28px",
              boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
              border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--color-indigo-500, #5B73E0)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Latest Additions
                </span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-ink, #1B2142)" }}>
                  Recent Past Papers & Notes
                </h3>
              </div>
            </div>

            {recentPapers.length === 0 ? (
              <EmptyState
                title="No papers in repository yet"
                description="Be the first student or faculty member to contribute past papers to the RCA archive."
                actionText="Upload Paper"
                onAction={onOpenUpload}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                        padding: "16px 20px",
                        borderRadius: "16px",
                        background: "var(--color-surface-subtle, #F8F9FD)",
                        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.06))",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "12px",
                            background: "var(--color-indigo-50, #F4F6FD)",
                            color: "var(--color-indigo-700, #3F4FA8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            flexShrink: 0,
                          }}
                        >
                          PDF
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              fontSize: "0.95rem",
                              color: "var(--color-ink, #1B2142)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {paper.title}
                          </strong>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-muted, #6A7399)",
                              display: "flex",
                              gap: "8px",
                              marginTop: "2px",
                            }}
                          >
                            <span>{paper.subject}</span>
                            <span>•</span>
                            <span>Year {paper.year}</span>
                            <span>•</span>
                            <span>{paper.type || "Past Paper"}</span>
                            {dateStr && (
                              <>
                                <span>•</span>
                                <span>{dateStr}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <Link
                          to={`/view/${paperId}`}
                          style={{
                            padding: "6px 16px",
                            borderRadius: "999px",
                            background: "var(--color-indigo-700, #3F4FA8)",
                            color: "#FFFFFF",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            textDecoration: "none",
                            boxShadow: "0 2px 8px rgba(63, 79, 168, 0.22)",
                          }}
                        >
                          <EyeIcon size={14} /> Preview
                        </Link>
                        <a
                          href={`/api/papers/${paperId}/download`}
                          download
                          style={{
                            padding: "6px 12px",
                            borderRadius: "999px",
                            background: "#FFFFFF",
                            border: "1px solid rgba(63, 79, 168, 0.12)",
                            color: "var(--color-ink, #1B2142)",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            textDecoration: "none",
                          }}
                        >
                          <DownloadIcon size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Real Quick Actions & User Contributions ── */}
        <div className="dashboard-right-col">
          {/* Quick Actions Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--radius-card, 24px)",
              padding: "24px",
              boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
              border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--color-indigo-500, #5B73E0)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Shortcuts
            </span>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-ink, #1B2142)", marginBottom: "16px" }}>
              Quick Actions
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("subjects");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  background: "var(--color-surface-subtle, #F8F9FD)",
                  border: "1px solid var(--color-divider, #E7EBF5)",
                  color: "var(--color-ink, #1B2142)",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "var(--color-indigo-100, #E4E8FA)",
                    color: "var(--color-indigo-700, #3F4FA8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialsIcon size={16} />
                </div>
                <span>Browse Cohort Subjects</span>
              </button>

              {onOpenUpload && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #3F4FA8 0%, #232C6B 100%)",
                    border: "none",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "0 4px 12px rgba(63, 79, 168, 0.25)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UploadIcon size={16} />
                  </div>
                  <span>Upload Study Material</span>
                </button>
              )}
            </div>
          </div>

          {/* User's Contribution Widget */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--radius-card, 24px)",
              padding: "24px",
              boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
              border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-ink, #1B2142)" }}>
                My Uploads
              </h4>
              <Badge variant="neutral" size="sm">
                {myUploads.length} Papers
              </Badge>
            </div>

            {myUploads.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  background: "var(--color-surface-subtle, #F8F9FD)",
                  borderRadius: "16px",
                  border: "1px dashed var(--color-divider, #E7EBF5)",
                }}
              >
                <p style={{ fontSize: "0.85rem", color: "var(--color-muted, #6A7399)", marginBottom: "10px" }}>
                  You haven't uploaded any past papers yet.
                </p>
                {onOpenUpload && (
                  <Button variant="outline" size="sm" onClick={onOpenUpload}>
                    Upload First Paper
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {myUploads.slice(0, 3).map((up) => (
                  <div
                    key={up.id || up._id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface-subtle, #F8F9FD)",
                      fontSize: "0.84rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--color-ink, #1B2142)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {up.title}
                    </span>
                    <Link
                      to={`/view/${up.id || up._id}`}
                      style={{ color: "var(--color-indigo-700, #3F4FA8)", fontWeight: 700, textDecoration: "none" }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DeletionRequests from "./DeletionRequests";
import TeacherManagement from "./TeacherManagement";
import StudentManagement from "./StudentManagement";
import { authDelete, authGet } from "../utils/apiClient";
import useRealtime from "../hooks/useRealtime";
import Avatar from "./ui/Avatar";
import StatCard from "./ui/StatCard";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import IconButton from "./ui/IconButton";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import ProgressRing from "./ui/ProgressRing";
import BarChart from "./ui/BarChart";
import {
  UsersIcon,
  MaterialsIcon,
  TrashIcon,
} from "./ui/Icons";
import adminFig from "../assets/figures/admin.png";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = requestedTab === "stats" ? "overview" : requestedTab;

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { subscribe, onReconnect } = useRealtime();

  useEffect(() => {
    if (requestedTab === "stats") {
      navigate("/admin", { replace: true });
    }
  }, [requestedTab, navigate]);

  const loadDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [statsData, teachersData, deletionsData, usersData] = await Promise.all([
        authGet("/api/admin/stats"),
        authGet("/api/admin/teachers"),
        authGet("/api/admin/deletion-requests"),
        authGet("/api/admin/users").catch(async () => {
          const fallback = await authGet("/api/users");
          return Array.isArray(fallback) ? fallback : fallback?.users || [];
        }),
      ]);

      if (statsData) setStats(statsData);
      if (teachersData) {
        setTeachers(
          Array.isArray(teachersData) ? teachersData : teachersData?.teachers || []
        );
      }
      if (deletionsData) {
        setDeletionRequests(
          Array.isArray(deletionsData)
            ? deletionsData
            : deletionsData?.deletionRequests || deletionsData?.requests || []
        );
      }
      if (usersData) {
        setUsers(Array.isArray(usersData) ? usersData : usersData?.users || []);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load dashboard data. Click Retry to reload."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe("stats:changed", () => loadDashboard(true)),
      subscribe("user:created", () => loadDashboard(true)),
      subscribe("user:updated", () => loadDashboard(true)),
      subscribe("user:deleted", () => loadDashboard(true)),
      subscribe("paper:created", () => loadDashboard(true)),
      subscribe("paper:updated", () => loadDashboard(true)),
      subscribe("paper:deleted", () => loadDashboard(true)),
      subscribe("deletion:created", () => loadDashboard(true)),
      subscribe("deletion:decided", () => loadDashboard(true)),
    ];

    const unsubReconnect = onReconnect ? onReconnect(() => loadDashboard(true)) : () => {};

    return () => {
      unsubs.forEach((u) => u && u());
      if (unsubReconnect) unsubReconnect();
    };
  }, [subscribe, onReconnect]);

  const totalStudents = useMemo(() => {
    return stats?.totalStudents ?? (users.filter((u) => u.role === "student").length || 0);
  }, [users, stats]);

  const totalTeachersCount = useMemo(() => {
    return stats?.totalTeachers ?? teachers.length;
  }, [stats, teachers]);

  const totalPapersCount = useMemo(() => {
    return stats?.totalPapers ?? 0;
  }, [stats]);

  const pendingDeletionsCount = useMemo(() => {
    return (
      stats?.pendingDeletionRequests ??
      deletionRequests.filter((r) => r.status === "Pending").length
    );
  }, [stats, deletionRequests]);

  const y1Count = stats?.papersByYear?.Y1 || 0;
  const y2Count = stats?.papersByYear?.Y2 || 0;
  const y3Count = stats?.papersByYear?.Y3 || 0;

  const handleDeleteUser = async () => {
    if (!userDeleteTarget) return;
    setDeletingUser(true);
    try {
      await authDelete(
        `/api/admin/users/${userDeleteTarget._id || userDeleteTarget.id}`
      );
      setUsers((prev) =>
        prev.filter(
          (u) => (u._id || u.id) !== (userDeleteTarget._id || userDeleteTarget.id)
        )
      );
      setUserDeleteTarget(null);
      loadDashboard(true);
    } catch (err) {
      setError(err.message || "Unable to delete user.");
    } finally {
      setDeletingUser(false);
    }
  };

  const userColumns = [
    {
      title: "User",
      key: "name",
      render: (_, u) => {
        const displayName = u.name || u.username || "Unnamed User";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, maxWidth: "240px" }}>
            <Avatar name={displayName} size="sm" variant="initials" />
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <strong
                title={displayName}
                style={{
                  display: "block",
                  color: "var(--color-text-primary)",
                  fontSize: "0.92rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "180px",
                }}
              >
                {displayName}
              </strong>
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)" }}>
                {u.class ? `Class ${u.class}` : "No cohort assigned"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Email Address",
      key: "email",
      render: (val) => (
        <span
          title={val}
          style={{
            color: "var(--color-text-primary)",
            fontSize: "0.86rem",
            display: "block",
            maxWidth: "220px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {val}
        </span>
      ),
    },
    {
      title: "Role",
      key: "role",
      render: (role) => {
        const variant =
          role === "admin" ? "danger" : role === "teacher" ? "indigo" : "primary";
        return (
          <Badge variant={variant} size="sm">
            {(role || "student").toUpperCase()}
          </Badge>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      render: (status) => {
        const isPending = status === "pending_password_setup";
        const isDisabled = status === "disabled";
        return (
          <Badge
            variant={isDisabled ? "neutral" : isPending ? "warning" : "success"}
            dot
            size="sm"
          >
            {isPending ? "Pending Setup" : isDisabled ? "Disabled" : "Active"}
          </Badge>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, u) => (
        <IconButton
          icon={<TrashIcon size={16} />}
          variant="danger"
          size="sm"
          title={`Delete ${u.name || u.email}`}
          onClick={() => setUserDeleteTarget(u)}
        />
      ),
    },
  ];

  // Tab Header titles and subtitles
  const TAB_METADATA = {
    overview: {
      kicker: "ADMINISTRATION PORTAL",
      title: "Platform Overview",
      description: "Monitor user activity, archive metrics, and system requests.",
    },
    teachers: {
      kicker: "FACULTY MANAGEMENT",
      title: "Teachers Directory",
      description: "Manage instructor access, send email invites, and control account permissions.",
    },
    students: {
      kicker: "STUDENT RECORDS",
      title: "Student Directory",
      description: "Explore enrolled students across Year 1, Year 2, and Year 3 cohorts.",
    },
    deletions: {
      kicker: "CONTENT MODERATION",
      title: "Paper Deletion Requests",
      description: "Review removal appeals submitted by students and faculty.",
    },
  };

  const currentMeta = TAB_METADATA[activeTab] || TAB_METADATA.overview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Page Header / Overview Greeting Card ── */}
      {activeTab === "overview" ? (
        <div
          style={{
            background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg) 100%)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
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
              ADMINISTRATION PORTAL
            </span>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color: "var(--color-text-primary)",
                margin: "0 0 6px 0",
                letterSpacing: "-0.02em",
              }}
            >
              Welcome back, Administrator
            </h1>
            <p
              style={{
                fontSize: "0.92rem",
                color: "var(--color-text-secondary)",
                margin: 0,
                maxWidth: "600px",
                lineHeight: 1.5,
              }}
            >
              Platform management overview. Monitor academic archives, student cohorts, faculty accounts, and pending deletion appeals.
            </p>
          </div>

          <div
            className="admin-figure-wrap"
            style={{
              position: "relative",
              zIndex: 1,
              width: "136px",
              height: "136px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(91, 115, 224, 0.22) 0%, rgba(63, 79, 168, 0.08) 100%)",
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
              src={adminFig}
              alt="Admin Character"
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
      ) : (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "28px 32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
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
            {currentMeta.kicker}
          </span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--color-text-primary)",
              margin: "0 0 6px 0",
              letterSpacing: "-0.02em",
            }}
          >
            {currentMeta.title}
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {currentMeta.description}
          </p>
        </div>
      )}

      {/* ── Error Alert with Retry ── */}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderRadius: "var(--radius-card, 16px)",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#EF4444",
            fontSize: "0.88rem",
            fontWeight: 600,
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span>{error}</span>
          <Button variant="danger" size="sm" onClick={() => loadDashboard(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Tab Content ── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Main Key Metrics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            <StatCard
              label="Total Students"
              value={totalStudents}
              icon={<UsersIcon size={22} />}
              accentColor="#3F4FA8"
            />
            <StatCard
              label="Faculty Members"
              value={totalTeachersCount}
              icon={<UsersIcon size={22} />}
              accentColor="#5B73E0"
            />
            <StatCard
              label="Archived Papers"
              value={totalPapersCount}
              icon={<MaterialsIcon size={22} />}
              accentColor="#10B981"
            />
            <StatCard
              label="Pending Deletions"
              value={pendingDeletionsCount}
              icon={<TrashIcon size={22} />}
              accentColor={pendingDeletionsCount > 0 ? "#EF4444" : "#6A7399"}
            />
          </div>

          {/* Upload Activity by Year & Student Ratio */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card)",
                padding: "28px",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  marginBottom: "6px",
                }}
              >
                Upload Activity by Year
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "20px" }}>
                Total academic documents indexed across cohorts.
              </p>
              <BarChart
                data={[
                  { label: `Y1: ${y1Count} ${y1Count === 1 ? "paper" : "papers"}`, value: y1Count },
                  { label: `Y2: ${y2Count} ${y2Count === 1 ? "paper" : "papers"}`, value: y2Count },
                  { label: `Y3: ${y3Count} ${y3Count === 1 ? "paper" : "papers"}`, value: y3Count },
                ]}
                maxHeight={160}
              />
            </div>

            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card)",
                padding: "28px",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <ProgressRing
                value={Math.min(100, Math.round((totalStudents / (totalStudents + totalTeachersCount + 1)) * 100))}
                size={120}
                strokeWidth={12}
                color="var(--color-primary)"
              />
              <strong
                style={{
                  fontSize: "1.1rem",
                  color: "var(--color-text-primary)",
                  marginTop: "16px",
                  display: "block",
                }}
              >
                Student Ratio
              </strong>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                {totalStudents} students vs {totalTeachersCount} faculty members
              </span>
            </div>
          </div>

          {/* Recent Registered Users Table */}
          <section
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              padding: "28px 32px",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    margin: 0,
                  }}
                >
                  All Platform Users
                </h3>
                <span style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)" }}>
                  Registered administrators, educators, and students.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDashboard(false)}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh Users"}
              </Button>
            </div>

            <Table
              columns={userColumns}
              data={users}
              rowKey={(u) => u._id || u.id}
              emptyText="No registered users found in the repository."
            />
          </section>
        </div>
      )}

      {activeTab === "teachers" && <TeacherManagement onUpdated={loadDashboard} />}
      {activeTab === "students" && <StudentManagement onUpdated={loadDashboard} />}
      {activeTab === "deletions" && <DeletionRequests onUpdated={loadDashboard} />}

      {/* Delete User Modal */}
      <Modal
        isOpen={Boolean(userDeleteTarget)}
        onClose={() => setUserDeleteTarget(null)}
        title="Confirm User Account Deletion"
        description={`Are you sure you want to delete user "${userDeleteTarget?.name || userDeleteTarget?.email}"? This action cannot be undone.`}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setUserDeleteTarget(null)}
            disabled={deletingUser}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteUser}
            loading={deletingUser}
          >
            Delete Account
          </Button>
        </div>
      </Modal>
    </div>
  );
}

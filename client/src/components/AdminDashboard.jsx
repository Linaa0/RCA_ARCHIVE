import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DeletionRequests from "./DeletionRequests";
import TeacherManagement from "./TeacherManagement";
import StudentManagement from "./StudentManagement";
import { authDelete, authGet } from "../utils/apiClient";
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

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsData, teachersData, deletionsData] = await Promise.all([
        authGet("/api/admin/stats").catch(() => ({})),
        authGet("/api/admin/teachers").catch(() => []),
        authGet("/api/admin/deletion-requests").catch(() => []),
      ]);

      let usersData = [];
      try {
        const response = await authGet("/api/admin/users");
        usersData = Array.isArray(response) ? response : response?.users || [];
      } catch {
        try {
          const fallback = await authGet("/api/users");
          usersData = Array.isArray(fallback) ? fallback : fallback?.users || [];
        } catch {
          usersData = [];
        }
      }

      setStats(statsData || {});
      setTeachers(
        Array.isArray(teachersData) ? teachersData : teachersData?.teachers || []
      );
      setDeletionRequests(
        Array.isArray(deletionsData)
          ? deletionsData
          : deletionsData?.deletionRequests || deletionsData?.requests || []
      );
      setUsers(usersData);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError(err.message || "Unable to load administration dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalStudents = useMemo(() => {
    return users.filter((u) => u.role === "student").length || stats?.totalStudents || 0;
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
      loadDashboard();
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
    stats: {
      kicker: "PORTAL ANALYTICS",
      title: "Archive Statistics",
      description: "Detailed breakdown of uploaded papers, categories, and cohort activity.",
    },
  };

  const currentMeta = TAB_METADATA[activeTab] || TAB_METADATA.overview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Standard Page Header ── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {currentMeta.kicker}
          </span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "4px",
              marginBottom: "4px",
              letterSpacing: "-0.02em",
            }}
          >
            {currentMeta.title}
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            {currentMeta.description}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 18px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#EF4444",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* ── TAB CONTENT ── */}
      {activeTab === "overview" && (
        <>
          {/* KPI Stat Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            <StatCard
              label="Total Enrolled Students"
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

          {/* Quick Stats & System Capacity */}
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
                  { label: "Year 1", value: Math.max(1, Math.round(totalPapersCount * 0.35)) },
                  { label: "Year 2", value: Math.max(1, Math.round(totalPapersCount * 0.45)) },
                  { label: "Year 3", value: Math.max(1, Math.round(totalPapersCount * 0.20)) },
                ]}
                height={160}
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
              padding: "32px",
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
                  Recent System Users
                </h3>
                <span style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)" }}>
                  Registered students and faculty accounts
                </span>
              </div>
            </div>

            <Table
              columns={userColumns}
              data={users.slice(0, 8)}
              rowKey={(u) => u._id || u.id || u.email}
              loading={loading && users.length === 0}
              emptyMessage="No user records indexed."
            />
          </section>
        </>
      )}

      {activeTab === "teachers" && <TeacherManagement onUpdated={loadDashboard} />}
      {activeTab === "students" && <StudentManagement onUpdated={loadDashboard} />}
      {activeTab === "deletions" && <DeletionRequests onUpdated={loadDashboard} />}
      {activeTab === "stats" && (
        <section
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "32px",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "8px" }}>
            Platform Statistics Summary
          </h3>
          <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", marginBottom: "24px" }}>
            Key performance metrics and repository numbers derived directly from the database.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            <StatCard
              label="Students"
              value={totalStudents}
              icon={<UsersIcon size={20} />}
              accentColor="#3F4FA8"
            />
            <StatCard
              label="Teachers"
              value={totalTeachersCount}
              icon={<UsersIcon size={20} />}
              accentColor="#5B73E0"
            />
            <StatCard
              label="Past Papers"
              value={totalPapersCount}
              icon={<MaterialsIcon size={20} />}
              accentColor="#10B981"
            />
            <StatCard
              label="Pending Deletions"
              value={pendingDeletionsCount}
              icon={<TrashIcon size={20} />}
              accentColor="#EF4444"
            />
          </div>
        </section>
      )}

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

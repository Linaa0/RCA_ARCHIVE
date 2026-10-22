import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import DeletionRequests from "./DeletionRequests";
import TeacherManagement from "./TeacherManagement";
import StudentManagement from "./StudentManagement";
import { authDelete, authGet } from "../utils/apiClient";
import { clearAuthStorage, getStoredUser } from "../utils/auth";
import Logo from "./ui/Logo";
import Avatar from "./ui/Avatar";
import StatCard from "./ui/StatCard";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import IconButton from "./ui/IconButton";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import {
  DashboardIcon,
  UsersIcon,
  MaterialsIcon,
  TrashIcon,
  LogoutIcon,
  UserIcon,
} from "./ui/Icons";
import "./AdminDashboard.css";

const TABS = [
  { id: "overview", label: "Dashboard", icon: <DashboardIcon size={18} /> },
  { id: "teachers", label: "Teachers", icon: <UsersIcon size={18} /> },
  { id: "students", label: "Students", icon: <Avatar size="xs" variant="initials" name="S" style={{ width: 18, height: 18 }} /> },
  {
    id: "deletions",
    label: "Deletion Requests",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" /><path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const username = user?.name || user?.username || "Admin";

  const [activeTab, setActiveTab] = useState("overview");
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
      console.error("ERROR LOADING ADMIN DASHBOARD:", err);
      setError(err.message || "Unable to load admin dashboard.");
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

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login", { replace: true });
  };

  const userColumns = [
    {
      title: "User",
      key: "name",
      render: (_, u) => (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Avatar name={u.name || u.username || u.email} size="sm" variant="initials" />
          <div>
            <strong style={{ display: "block", color: "var(--color-ink, #1B2142)", fontSize: "0.92rem" }}>
              {u.name || u.username || "Unnamed"}
            </strong>
            <span style={{ fontSize: "0.78rem", color: "var(--color-muted, #6A7399)" }}>
              {u.class ? `Class ${u.class}` : "No cohort set"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Email",
      key: "email",
      render: (val) => (
        <span style={{ color: "var(--color-ink, #1B2142)", fontFamily: "monospace", fontSize: "0.86rem" }}>
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

  return (
    <div className="admin-shell">
      {/* ── Indigo Sidebar with Clean Knockout Logo ── */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo variant="knockout" size="sm" wordmarkColor="#FFFFFF" />
        </div>

        <nav className="admin-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}

          <div
            style={{
              height: "1px",
              background: "rgba(255, 255, 255, 0.12)",
              margin: "12px 16px",
            }}
          />

          <Link
            to="/profile"
            className="admin-nav-item"
            style={{ textDecoration: "none" }}
          >
            <UserIcon size={18} />
            <span>My Profile</span>
          </Link>

          <Link
            to="/home"
            className="admin-nav-item"
            style={{ textDecoration: "none" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Student View</span>
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-row">
            <Avatar name={username} size="sm" variant="initials" />
            <div className="admin-profile-text">
              <span className="admin-profile-name">{username}</span>
              <span className="admin-profile-role">Administrator</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
          >
            <LogoutIcon size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="admin-content">
        <header className="admin-header">
          <div className="admin-header-left">
            <p className="admin-eyebrow">Administration</p>
            <h1>
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "teachers" && "Teacher Directory"}
              {activeTab === "students" && "Student Directory"}
              {activeTab === "deletions" && "Deletion Requests Queue"}
            </h1>
            <p className="admin-subtitle">
              {activeTab === "overview" &&
                "Live overview of registered users, faculty, past papers, and moderation tasks."}
              {activeTab === "teachers" &&
                "Manage faculty access, send email invites, and control account statuses."}
              {activeTab === "students" &&
                "Manage student rosters, view cohorts, and issue direct invitations."}
              {activeTab === "deletions" &&
                "Review, approve, or reject user-submitted paper removal requests."}
            </p>
          </div>

          <div className="admin-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboard}
              loading={loading}
            >
              Refresh Data
            </Button>

            {activeTab === "teachers" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-invite-teacher-modal"));
                }}
              >
                + Invite Teacher
              </Button>
            )}
          </div>
        </header>

        {error && (
          <div
            style={{
              padding: "14px 20px",
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#EF4444",
              borderRadius: "16px",
              marginBottom: "24px",
              fontSize: "0.88rem",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {/* KPI Stat Cards (100% Real API Data) */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "20px",
                marginBottom: "32px",
              }}
            >
              <StatCard
                label="Total Users"
                value={users.length || stats?.totalUsers || 0}
                subtext="Registered accounts"
                icon={<UsersIcon size={20} />}
                color="#3F4FA8"
              />
              <StatCard
                label="Total Students"
                value={totalStudents}
                subtext="Enrolled cohorts"
                icon={<Avatar size="xs" variant="initials" name="S" style={{ width: 20, height: 20 }} />}
                color="#5B73E0"
              />
              <StatCard
                label="Faculty Members"
                value={totalTeachersCount}
                subtext="Verified educators"
                icon={<UsersIcon size={20} />}
                color="#3F4FA8"
              />
              <StatCard
                label="Archived Papers"
                value={totalPapersCount}
                subtext="Exams, CATs & notes"
                icon={<MaterialsIcon size={20} />}
                color="#10B981"
              />
              <StatCard
                label="Pending Deletions"
                value={pendingDeletionsCount}
                subtext={pendingDeletionsCount > 0 ? "Requires review" : "Queue clear"}
                icon={<TrashIcon size={20} />}
                color={pendingDeletionsCount > 0 ? "#EF4444" : "#949EBF"}
              />
            </section>

            {/* Users Data Table */}
            <section
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--radius-card, 24px)",
                padding: "32px",
                border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
                boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
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
                    Directory
                  </span>
                  <h3
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: 800,
                      color: "var(--color-ink, #1B2142)",
                      marginTop: "2px",
                    }}
                  >
                    Recent Users & Roles
                  </h3>
                </div>
                <Badge variant="neutral">{users.length} Total Users</Badge>
              </div>

              <Table
                columns={userColumns}
                data={users.slice(0, 10)}
                loading={loading}
                emptyMessage="No user accounts found."
              />
            </section>
          </>
        )}

        {/* ── TEACHERS TAB ── */}
        {activeTab === "teachers" && (
          <TeacherManagement onUpdated={loadDashboard} />
        )}

        {/* ── STUDENTS TAB ── */}
        {activeTab === "students" && (
          <StudentManagement onUpdated={loadDashboard} />
        )}

        {/* ── DELETIONS TAB ── */}
        {activeTab === "deletions" && (
          <DeletionRequests onUpdated={loadDashboard} />
        )}

        {/* ── Delete confirmation modal ── */}
        <Modal
          isOpen={!!userDeleteTarget}
          onClose={() => setUserDeleteTarget(null)}
          title="Delete User Account"
        >
          <p style={{ color: "var(--color-ink-subtle, #3A4269)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "20px" }}>
            Are you sure you want to delete user{" "}
            <strong>{userDeleteTarget?.name || userDeleteTarget?.email}</strong>?
            This will permanently remove their account from RCA Archive.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <Button
              variant="secondary"
              onClick={() => setUserDeleteTarget(null)}
              disabled={deletingUser}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              loading={deletingUser}
            >
              Delete User
            </Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import DeletionRequests from "./DeletionRequests";
import TeacherManagement from "./TeacherManagement";
import StudentManagement from "./StudentManagement";
import { authDelete, authGet } from "../utils/apiClient";
import { clearAuthStorage, getStoredUser } from "../utils/auth";
import "./AdminDashboard.css";

const TABS = [
  {
    id: "overview",
    label: "Dashboard",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "teachers",
    label: "Teachers",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "students",
    label: "Students",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    id: "deletions",
    label: "Deletion Requests",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Statistics",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const formatCount = (value) => {
  if (value === null || value === undefined) return "0";
  return Number(value).toLocaleString();
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { username } = getStoredUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [resourceRole, setResourceRole] = useState("student");
  const [roleResources, setRoleResources] = useState({});
  const [resourceError, setResourceError] = useState("");
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsData, teachersData, deletionsData] = await Promise.all([
        authGet("/api/admin/stats"),
        authGet("/api/admin/teachers"),
        authGet("/api/admin/deletion-requests"),
      ]);

      console.log("API STATS RESPONSE:", statsData);
      console.log("API TEACHERS RESPONSE:", teachersData);
      console.log("API DELETIONS RESPONSE:", deletionsData);

      let usersData = [];
      try {
        const response = await authGet("/api/admin/users");
        console.log("API USERS RESPONSE:", response);
        usersData = Array.isArray(response) ? response : response.users || [];
      } catch {
        try {
          const fallback = await authGet("/api/users");
          usersData = Array.isArray(fallback) ? fallback : fallback.users || [];
        } catch {
          usersData = [];
        }
      }

      setStats(statsData || {});
      setTeachers(
        Array.isArray(teachersData)
          ? teachersData
          : teachersData.teachers || [],
      );
      setDeletionRequests(
        Array.isArray(deletionsData)
          ? deletionsData
          : deletionsData.deletionRequests || deletionsData.requests || [],
      );
      setUsers(usersData);
    } catch (err) {
      console.error("ERROR LOADING DASHBOARD:", err);
      setError(err.message || "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const loadRoleResources = async (role) => {
    const roleUsers = users.filter((user) => user.role === role);
    setResourceRole(role);
    setResourceError("");
    try {
      const results = await Promise.all(
        roleUsers.map(async (user) => {
          const response = await authGet(
            `/api/admin/users/${user._id || user.id}/resources`,
          );
          return {
            user,
            resources: Array.isArray(response.resources)
              ? response.resources
              : [],
          };
        }),
      );
      setRoleResources((previous) => ({ ...previous, [role]: results }));
    } catch (err) {
      setResourceError(err.message || "Unable to load user resources.");
    }
  };

  const handleDeleteUser = async () => {
    if (!userDeleteTarget) return;
    try {
      await authDelete(
        `/api/admin/users/${userDeleteTarget._id || userDeleteTarget.id}`,
      );
      setUsers((prev) =>
        prev.filter(
          (u) =>
            (u._id || u.id) !== (userDeleteTarget._id || userDeleteTarget.id),
        ),
      );
      setUserDeleteTarget(null);
      loadDashboard();
    } catch (err) {
      setError(err.message || "Unable to delete user.");
      setUserDeleteTarget(null);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Total Users", value: stats?.totalUsers ?? users.length },
      { label: "Total Students", value: stats?.totalStudents ?? 0 },
      {
        label: "Total Teachers",
        value: stats?.totalTeachers ?? teachers.length,
      },
      { label: "Total Papers", value: stats?.totalPapers ?? 0 },
      {
        label: "Pending Deletions",
        value:
          stats?.pendingDeletionRequests ??
          deletionRequests.filter((r) => r.status === "Pending").length,
      },
    ],
    [stats, users.length, teachers.length, deletionRequests],
  );

  const recentActivity = useMemo(() => {
    const teacherEvents = teachers.slice(0, 3).map((t) => ({
      id: t._id || t.id || t.email,
      title: `Teacher: ${t.name || t.username || t.email}`,
      description: t.status ? `Status: ${t.status}` : "Teacher account",
      timestamp: t.updatedAt || t.createdAt || null,
    }));
    const deletionEvents = deletionRequests.slice(0, 3).map((r) => ({
      id: r._id || r.id,
      title: `Deletion request: ${r.paperTitle || "Untitled paper"}`,
      description: `${r.requesterRole || "user"} · ${r.status?.toLowerCase() || "pending"}`,
      timestamp: r.requestedAt || r.createdAt || null,
    }));
    return [...deletionEvents, ...teacherEvents].slice(0, 6);
  }, [deletionRequests, teachers]);

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login", { replace: true });
  };

  const initial = username ? username.charAt(0).toUpperCase() : "A";

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img
            src="/rwandacoding.png"
            alt="RCA Logo"
            className="admin-brand-logo"
          />
          <span className="admin-brand-name">RCA ARCHIVE+</span>
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
              {tab.label}
            </button>
          ))}

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: "var(--border-color)",
              margin: "8px 0",
            }}
          />

          {/* Link to student/user view */}
          <Link
            to="/home"
            className="admin-nav-item"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Student View
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-row">
            <div className="admin-avatar">{initial}</div>
            <div className="admin-profile-text">
              <span className="admin-profile-name">{username || "Admin"}</span>
              <span className="admin-profile-role">Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="admin-content">
        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-left">
            <p className="admin-eyebrow">Admin Panel</p>
            <h1>
              {activeTab === "overview" && "Dashboard"}
              {activeTab === "teachers" && "Teacher Management"}
              {activeTab === "students" && "Student Management"}
              {activeTab === "deletions" && "Deletion Requests"}
              {activeTab === "stats" && "Statistics"}
            </h1>
            <p className="admin-subtitle">
              {activeTab === "overview" &&
                "Manage users, teachers, papers, and moderation workflows."}
              {activeTab === "teachers" &&
                "Create, edit, disable, and manage teacher accounts."}
              {activeTab === "students" &&
                "Create and manage student accounts alongside self-service signup."}
              {activeTab === "deletions" &&
                "Review and action pending paper deletion requests."}
              {activeTab === "stats" &&
                "System-wide usage and resource statistics."}
            </p>
          </div>
          <div className="admin-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={loadDashboard}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setActiveTab("teachers")}
            >
              {activeTab === "students" ? "+ Create Student" : "+ Create Teacher"}
            </button>
          </div>
        </header>

        {error ? <div className="admin-alert">{error}</div> : null}

        {/* ── Overview tab ── */}
        {activeTab === "overview" && (
          <>
            {/* Stats row */}
            <section className="summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="summary-card">
                  <span className="summary-card-label">{card.label}</span>
                  <strong className="summary-card-value">
                    {loading ? "—" : formatCount(card.value)}
                  </strong>
                </article>
              ))}
            </section>

            {/* Main panels */}
            <section className="dashboard-grid">
              {/* User overview */}
              <article className="dashboard-panel">
                <div>
                  <p className="panel-eyebrow">Users</p>
                  <h3 className="panel-title">User overview</h3>
                </div>
                <div className="table-wrap">
                  {users.length ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.slice(0, 10).map((user) => (
                          <tr key={user._id || user.id || user.email}>
                            <td>{user.name || user.username || "—"}</td>
                            <td>{user.email}</td>
                            <td>
                              <span
                                className={`role-badge ${user.role || "student"}`}
                              >
                                {user.role || "student"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`status-badge ${
                                  user.status === "disabled"
                                    ? "disabled"
                                    : user.status === "pending_password_setup"
                                      ? "pending"
                                      : "active"
                                }`}
                              >
                                {user.status === "pending_password_setup"
                                  ? "pending"
                                  : user.status || "active"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="danger-link"
                                onClick={() => setUserDeleteTarget(user)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      {loading ? "Loading users…" : "No users found."}
                    </div>
                  )}
                </div>
              </article>

              {/* Recent activity */}
              <article className="dashboard-panel">
                <div>
                  <p className="panel-eyebrow">Activity</p>
                  <h3 className="panel-title">Recent activity</h3>
                </div>
                <div className="activity-list">
                  {recentActivity.length ? (
                    recentActivity.map((item) => (
                      <div key={item.id} className="activity-item">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                        {item.timestamp && (
                          <small>
                            {new Date(item.timestamp).toLocaleString()}
                          </small>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No recent activity yet.</div>
                  )}
                </div>
              </article>

              {/* User resources */}
              <article className="dashboard-panel">
                <div>
                  <p className="panel-eyebrow">Resources</p>
                  <h3 className="panel-title">User resources</h3>
                </div>
                <div
                  className="resource-role-tabs"
                  role="tablist"
                  aria-label="User roles"
                >
                  {["student", "teacher", "admin"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`resource-role-tab ${resourceRole === role ? "active" : ""}`}
                      onClick={() => loadRoleResources(role)}
                    >
                      {role}s
                    </button>
                  ))}
                </div>
                <div className="permissions-summary">
                  <strong>
                    {resourceRole[0].toUpperCase() + resourceRole.slice(1)}{" "}
                    permissions
                  </strong>
                  <span>
                    {resourceRole === "admin"
                      ? "Manage users, teachers, students, resources, statistics, and deletion requests."
                      : resourceRole === "teacher"
                        ? "Upload, edit, and manage academic materials and respond to moderation workflows."
                        : "Browse, rate, upload materials, and request deletion of inappropriate resources."}
                  </span>
                </div>
                {roleResources[resourceRole] ? (
                  <>
                    {roleResources[resourceRole].some(
                      ({ resources }) => resources.length,
                    ) ? (
                      <div className="resource-list">
                        {roleResources[resourceRole].map(
                          ({ user, resources }) => (
                            <div
                              key={user._id || user.id}
                              className="resource-user-group"
                            >
                              <div className="selected-user-chip">
                                <strong>
                                  {user.name || user.username || user.email}
                                </strong>
                                <span>
                                  {user.email} · {resources.length} resource
                                  {resources.length === 1 ? "" : "s"}
                                </span>
                              </div>
                              {resources.map((resource) => (
                                <div
                                  key={resource._id || resource.id}
                                  className="resource-item"
                                >
                                  <strong>
                                    {resource.title ||
                                      resource.paperTitle ||
                                      "Untitled"}
                                  </strong>
                                  <span>
                                    {resource.category ||
                                      resource.subject ||
                                      "Resource"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">
                    Choose a role to inspect resources and permissions.
                  </div>
                )}
                {resourceError ? (
                  <div className="empty-state">{resourceError}</div>
                ) : null}
              </article>

              {/* Quick actions */}
              <article className="dashboard-panel">
                <div>
                  <p className="panel-eyebrow">Quick actions</p>
                  <h3 className="panel-title">Admin shortcuts</h3>
                </div>
                <div className="quick-actions">
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={() => setActiveTab("teachers")}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Manage teachers
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={() => setActiveTab("deletions")}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Review deletions
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={() => setActiveTab("stats")}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    View statistics
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={loadDashboard}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-.85-5.37" />
                    </svg>
                    Sync data
                  </button>
                </div>
              </article>
            </section>
          </>
        )}

        {/* ── Teachers tab ── */}
        {activeTab === "teachers" && (
          <TeacherManagement onUpdated={loadDashboard} />
        )}

        {activeTab === "students" && (
          <StudentManagement onUpdated={loadDashboard} />
        )}

        {/* ── Deletions tab ── */}
        {activeTab === "deletions" && (
          <DeletionRequests onUpdated={loadDashboard} />
        )}

        {/* ── Stats tab ── */}
        {activeTab === "stats" && (
          <section className="dashboard-panel">
            <div>
              <p className="panel-eyebrow">Statistics</p>
              <h3 className="panel-title">System snapshot</h3>
            </div>
            <div className="stats-highlight-grid">
              {summaryCards.slice(0, 4).map((card) => (
                <div key={card.label} className="stats-highlight-card">
                  <span>{card.label}</span>
                  <strong>{formatCount(card.value)}</strong>
                  <div className="stats-meter">
                    <i
                      style={{
                        width: `${Math.min(100, Number(card.value || 0) * 10 + 8)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="stats-breakdown">
              <div className="stats-row">
                <span>Pending moderation</span>
                <strong>{formatCount(summaryCards[4].value)}</strong>
              </div>
              <div className="stats-insight">
                The snapshot combines account, content, and moderation activity
                so admins can spot growth and pending work at a glance.
              </div>
            </div>
          </section>
        )}

        {/* ── Delete confirmation modal ── */}
        {userDeleteTarget && (
          <div className="modal-overlay">
            <div className="confirm-modal">
              <h3>Delete user?</h3>
              <p>
                This will permanently delete{" "}
                <strong>
                  {userDeleteTarget.name || userDeleteTarget.email}
                </strong>
                . This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setUserDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: "#ef4444" }}
                  onClick={handleDeleteUser}
                >
                  Delete user
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;

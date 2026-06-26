import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DeletionRequests from "./DeletionRequests";
import TeacherManagement from "./TeacherManagement";
import { authDelete, authGet } from "../utils/apiClient";
import { clearAuthStorage, getStoredUser } from "../utils/auth";
import "./AdminDashboard.css";

const TABS = [
  { id: "overview", label: "Dashboard" },
  { id: "teachers", label: "Teachers" },
  { id: "deletions", label: "Deletion Requests" },
  { id: "stats", label: "Statistics" },
];

const formatCount = (value) => {
  if (value === null || value === undefined) {
    return "0";
  }

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
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedResources, setSelectedResources] = useState([]);
  const [resourceLoading, setResourceLoading] = useState(false);
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

      let usersData = [];
      try {
        const response = await authGet("/api/admin/users");
        usersData = Array.isArray(response) ? response : response.users || [];
      } catch (usersError) {
        try {
          const fallback = await authGet("/api/users");
          usersData = Array.isArray(fallback) ? fallback : fallback.users || [];
        } catch (fallbackError) {
          usersData = [];
        }
      }

      setStats(statsData || {});
      setTeachers(Array.isArray(teachersData) ? teachersData : teachersData.teachers || []);
      setDeletionRequests(
        Array.isArray(deletionsData)
          ? deletionsData
          : deletionsData.deletionRequests || deletionsData.requests || []
      );
      setUsers(usersData);
    } catch (dashboardError) {
      setError(dashboardError.message || "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const loadUserResources = async (user) => {
    const userId = user._id || user.id;
    if (!userId) {
      return;
    }

    setSelectedUser(user);
    setSelectedResources([]);
    setResourceError("");
    setResourceLoading(true);

    try {
      const response = await authGet(`/api/admin/users/${userId}/resources`);
      setSelectedResources(Array.isArray(response.resources) ? response.resources : []);
    } catch (resourcesError) {
      setResourceError(resourcesError.message || "Unable to load user resources.");
    } finally {
      setResourceLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userDeleteTarget) {
      return;
    }

    try {
      await authDelete(`/api/admin/users/${userDeleteTarget._id || userDeleteTarget.id}`);
      if (selectedUser && (selectedUser._id || selectedUser.id) === (userDeleteTarget._id || userDeleteTarget.id)) {
        setSelectedUser(null);
        setSelectedResources([]);
      }
      setUsers((prev) =>
        prev.filter((user) => (user._id || user.id) !== (userDeleteTarget._id || userDeleteTarget.id))
      );
      setError("");
      setUserDeleteTarget(null);
      loadDashboard();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete user.");
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
      { label: "Total Teachers", value: stats?.totalTeachers ?? teachers.length },
      { label: "Total Papers", value: stats?.totalPapers ?? 0 },
      {
        label: "Pending Deletions",
        value: stats?.pendingDeletionRequests ?? deletionRequests.filter((item) => item.status === "Pending").length,
      },
    ],
    [deletionRequests, stats, teachers.length, users.length]
  );

  const recentActivity = useMemo(() => {
    const teacherEvents = teachers.slice(0, 3).map((teacher) => ({
      id: teacher._id || teacher.id || teacher.email,
      title: `Teacher profile: ${teacher.name || teacher.username || teacher.email}`,
      description: teacher.status ? `Status: ${teacher.status}` : "Teacher account available",
      timestamp: teacher.updatedAt || teacher.createdAt || null,
    }));

    const deletionEvents = deletionRequests.slice(0, 3).map((request) => ({
      id: request._id || request.id,
      title: `Deletion request: ${request.paperTitle || "Untitled paper"}`,
      description: `${request.requesterRole || "user"} requested ${request.status?.toLowerCase() || "pending"} review`,
      timestamp: request.requestedAt || request.createdAt || null,
    }));

    return [...deletionEvents, ...teacherEvents].slice(0, 6);
  }, [deletionRequests, teachers]);

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <p>RCA Archive</p>
          <h2>Admin Console</h2>
        </div>

        <nav className="admin-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-card">
          <span>Signed in as</span>
          <strong>{username || "Admin"}</strong>
          <button type="button" className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Role-based control center</p>
            <h1>Admin Dashboard</h1>
            <p className="admin-subtitle">
              Manage users, teachers, papers, and moderation workflows from one place.
            </p>
          </div>

          <div className="admin-actions">
            <button type="button" className="secondary-action" onClick={loadDashboard} disabled={loading}>
              Refresh
            </button>
            <button type="button" className="primary-action" onClick={() => setActiveTab("teachers")}>
              Create Teacher
            </button>
          </div>
        </header>

        {error ? <div className="admin-alert">{error}</div> : null}

        {activeTab === "overview" ? (
          <>
            <section className="summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="summary-card">
                  <span>{card.label}</span>
                  <strong>{loading ? "..." : formatCount(card.value)}</strong>
                </article>
              ))}
            </section>

            <section className="dashboard-grid">
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p>Users</p>
                    <h3>User overview</h3>
                  </div>
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
                        {users.slice(0, 8).map((user) => (
                          <tr key={user._id || user.id || user.email}>
                            <td>{user.name || user.username || "Unnamed user"}</td>
                            <td>{user.email}</td>
                            <td>{user.role || "student"}</td>
                            <td>{user.status || (user.disabled ? "disabled" : "active")}</td>
                            <td>
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => loadUserResources(user)}
                              >
                                View resources
                              </button>
                              <button
                                type="button"
                                className="danger-link"
                                onClick={() => setUserDeleteTarget(user)}
                              >
                                Delete user
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      {loading ? "Loading users..." : "No user records available yet."}
                    </div>
                  )}
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p>Activity</p>
                    <h3>Recent activities</h3>
                  </div>
                </div>

                <div className="activity-list">
                  {recentActivity.length ? (
                    recentActivity.map((item) => (
                      <div key={item.id} className="activity-item">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                        {item.timestamp ? <small>{new Date(item.timestamp).toLocaleString()}</small> : null}
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No recent activity yet.</div>
                  )}
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p>Resources</p>
                    <h3>User resources</h3>
                  </div>
                </div>

                {selectedUser ? (
                  <>
                    <div className="selected-user-chip">
                      <strong>{selectedUser.name || selectedUser.username || selectedUser.email}</strong>
                      <span>{selectedUser.email}</span>
                    </div>

                    {resourceError ? <div className="empty-state">{resourceError}</div> : null}

                    {resourceLoading ? (
                      <div className="empty-state">Loading resources...</div>
                    ) : selectedResources.length ? (
                      <div className="resource-list">
                        {selectedResources.map((resource) => (
                          <div key={resource._id || resource.id} className="resource-item">
                            <strong>{resource.title || resource.paperTitle || "Untitled resource"}</strong>
                            <span>{resource.category || resource.subject || resource.department || "Resource"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !resourceError && <div className="empty-state">No resources found for this user.</div>
                    )}
                  </>
                ) : (
                  <div className="empty-state">Select a user to review their resources.</div>
                )}
              </article>

              <article className="dashboard-panel quick-actions-panel">
                <div className="panel-heading">
                  <div>
                    <p>Quick actions</p>
                    <h3>Admin shortcuts</h3>
                  </div>
                </div>

                <div className="quick-actions">
                  <button type="button" onClick={() => setActiveTab("teachers")}>
                    Manage teachers
                  </button>
                  <button type="button" onClick={() => setActiveTab("deletions")}>
                    Review deletions
                  </button>
                  <button type="button" onClick={() => setActiveTab("stats")}>
                    View statistics
                  </button>
                  <button type="button" onClick={loadDashboard}>
                    Sync data
                  </button>
                </div>
              </article>
            </section>
          </>
        ) : null}

        {activeTab === "teachers" ? <TeacherManagement onUpdated={loadDashboard} /> : null}

        {activeTab === "deletions" ? <DeletionRequests onUpdated={loadDashboard} /> : null}

        {activeTab === "stats" ? (
          <section className="dashboard-panel stats-panel">
            <div className="panel-heading">
              <div>
                <p>Statistics</p>
                <h3>System snapshot</h3>
              </div>
            </div>

            <div className="stats-breakdown">
              {summaryCards.map((card) => (
                <div key={card.label} className="stats-row">
                  <span>{card.label}</span>
                  <strong>{formatCount(card.value)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {userDeleteTarget ? (
          <div className="modal-overlay">
            <div className="confirm-modal">
              <h3>Delete user?</h3>
              <p>
                This will permanently delete <strong>{userDeleteTarget.name || userDeleteTarget.email}</strong>.
                Their access will be removed immediately, and any linked records will remain only if the backend
                keeps them.
              </p>
              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setUserDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="primary-action" onClick={handleDeleteUser}>
                  Delete user
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default AdminDashboard;

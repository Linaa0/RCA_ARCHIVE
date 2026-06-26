import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost, authPut } from "../utils/apiClient";
import "./TeacherManagement.css";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const TeacherManagement = ({ onUpdated }) => {
  const [teachers, setTeachers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTeachers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authGet("/api/admin/teachers");
      // backend returns { teachers: [...] }
      const list = response.teachers || (Array.isArray(response) ? response : []);
      setTeachers(list);
    } catch (requestError) {
      setError(requestError.message || "Unable to load teachers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return teachers;
    return teachers.filter((t) => {
      const name = (t.name || t.username || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const status = (t.status || "").toLowerCase();
      return name.includes(keyword) || email.includes(keyword) || status.includes(keyword);
    });
  }, [searchTerm, teachers]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingTeacher(null);
    setSuccess("");
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    // Password validation for new teacher creation
    if (!editingTeacher) {
      if (!formData.password) {
        setSaving(false);
        setError("Password is required.");
        return;
      }
      if (formData.password.length < 8) {
        setSaving(false);
        setError("Password must be at least 8 characters.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setSaving(false);
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      if (editingTeacher) {
        // Edit existing teacher
        const payload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
        };
        if (formData.password) {
          payload.password = formData.password;
        }
        const updated = await authPut(
          `/api/admin/teachers/${editingTeacher.id || editingTeacher._id}`,
          payload
        );
        const updatedTeacher = updated.teacher || updated;
        setTeachers((prev) =>
          prev.map((t) =>
            (t.id || t._id) === (updatedTeacher.id || updatedTeacher._id) ? updatedTeacher : t
          )
        );
        setSuccess("Teacher updated successfully.");
      } else {
        // Create new teacher with password (direct creation)
        const created = await authPost("/api/admin/teachers/direct", {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });
        const newTeacher = created.teacher || created;
        setTeachers((prev) => [newTeacher, ...prev]);
        setSuccess("Teacher account created successfully. They can now log in.");
      }

      setFormData(EMPTY_FORM);
      setEditingTeacher(null);
      if (onUpdated) onUpdated();
    } catch (submitError) {
      // apiClient throws with .message from server
      const msg =
        submitError.data?.message ||
        submitError.message ||
        "Unable to save teacher.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name || teacher.username || "",
      email: teacher.email || "",
      password: "",
      confirmPassword: "",
    });
    setError("");
    setSuccess("");
  };

  const handleToggleStatus = async (teacher) => {
    const newStatus = teacher.status === "disabled" ? "active" : "disabled";
    try {
      const updated = await authPut(
        `/api/admin/teachers/${teacher.id || teacher._id}`,
        { status: newStatus }
      );
      const updatedTeacher = updated.teacher || updated;
      setTeachers((prev) =>
        prev.map((t) =>
          (t.id || t._id) === (updatedTeacher.id || updatedTeacher._id) ? updatedTeacher : t
        )
      );
      setSuccess(
        newStatus === "disabled"
          ? "Teacher account disabled."
          : "Teacher account re-enabled."
      );
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to update teacher status.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await authDelete(`/api/admin/teachers/${deleteTarget.id || deleteTarget._id}`);
      setTeachers((prev) =>
        prev.filter((t) => (t.id || t._id) !== (deleteTarget.id || deleteTarget._id))
      );
      setSuccess("Teacher deleted successfully.");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to delete teacher.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <section className="teacher-management">
      <div className="teacher-topbar">
        <div>
          <p className="section-kicker">Teacher management</p>
          <h2>{editingTeacher ? "Edit teacher" : "Create & manage teachers"}</h2>
        </div>

        <div className="teacher-tools">
          <input
            type="search"
            placeholder="Search teachers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="ghost-btn" onClick={loadTeachers} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      <div className="teacher-layout">
        {/* Create / Edit form */}
        <article className="teacher-card">
          <div className="card-header">
            <h3>{editingTeacher ? "Edit teacher" : "Create teacher"}</h3>
            {editingTeacher ? (
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <form className="teacher-form" onSubmit={handleSubmit}>
            <label>
              <span>Full name</span>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Teacher's full name"
                required
              />
            </label>

            <label>
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="teacher@rca.ac.rw"
                required
              />
            </label>

            <label>
              <span>{editingTeacher ? "New password (leave blank to keep)" : "Password"}</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={
                  editingTeacher ? "Leave blank to keep current" : "Min. 8 characters"
                }
                required={!editingTeacher}
              />
            </label>

            {!editingTeacher ? (
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required
                />
              </label>
            ) : null}

            {error ? <div className="feedback error">{error}</div> : null}
            {success ? <div className="feedback success">{success}</div> : null}

            <button type="submit" className="primary-btn" disabled={saving}>
              {saving
                ? "Saving..."
                : editingTeacher
                ? "Update teacher"
                : "Create teacher"}
            </button>
          </form>
        </article>

        {/* Teacher list */}
        <article className="teacher-card teacher-list-card">
          <div className="card-header">
            <h3>All teachers</h3>
            <span>{filteredTeachers.length} found</span>
          </div>

          {loading ? (
            <div className="empty-panel">Loading teachers...</div>
          ) : filteredTeachers.length ? (
            <div className="teacher-list">
              {filteredTeachers.map((teacher) => (
                <div
                  className="teacher-row"
                  key={teacher.id || teacher._id || teacher.email}
                >
                  <div className="teacher-meta">
                    <strong>{teacher.name || teacher.username || "Unnamed teacher"}</strong>
                    <span>{teacher.email}</span>
                    <small
                      className={`status-chip ${
                        teacher.status === "active"
                          ? "status-active"
                          : teacher.status === "disabled"
                          ? "status-disabled"
                          : "status-pending"
                      }`}
                    >
                      {teacher.status === "pending_password_setup"
                        ? "Pending setup"
                        : teacher.status || "active"}
                    </small>
                  </div>

                  <div className="teacher-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleEdit(teacher)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleToggleStatus(teacher)}
                    >
                      {teacher.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setDeleteTarget(teacher)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              {searchTerm ? "No teachers match your search." : "No teachers yet. Create one above."}
            </div>
          )}
        </article>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget ? (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Delete teacher?</h3>
            <p>
              This will permanently remove{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong> from
              the system. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete teacher
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default TeacherManagement;

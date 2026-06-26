import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost, authPut } from "../utils/apiClient";
import "./TeacherManagement.css";

const EMPTY_FORM = { name: "", email: "" };

const TeacherManagement = ({ onUpdated }) => {
  const [teachers, setTeachers]         = useState([]);
  const [formData, setFormData]         = useState(EMPTY_FORM);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchTerm, setSearchTerm]     = useState("");
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTeachers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authGet("/api/admin/teachers");
      const list = response.teachers || (Array.isArray(response) ? response : []);
      setTeachers(list);
    } catch (err) {
      setError(err.message || "Unable to load teachers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeachers(); }, []);

  const filteredTeachers = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase();
    if (!kw) return teachers;
    return teachers.filter((t) => {
      const name   = (t.name || t.username || "").toLowerCase();
      const email  = (t.email || "").toLowerCase();
      const status = (t.status || "").toLowerCase();
      return name.includes(kw) || email.includes(kw) || status.includes(kw);
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

    try {
      if (editingTeacher) {
        // Edit name/email only
        const payload = {
          name:  formData.name.trim(),
          email: formData.email.trim(),
        };
        const updated = await authPut(
          `/api/admin/teachers/${editingTeacher.id || editingTeacher._id}`,
          payload
        );
        const updatedTeacher = updated.teacher || updated;
        setTeachers((prev) =>
          prev.map((t) =>
            (t.id || t._id) === (updatedTeacher.id || updatedTeacher._id)
              ? updatedTeacher
              : t
          )
        );
        setSuccess("Teacher updated successfully.");
        setEditingTeacher(null);
        setFormData(EMPTY_FORM);
      } else {
        // Create teacher — backend sends invite email with password-setup link
        const created = await authPost("/api/admin/teachers", {
          name:  formData.name.trim(),
          email: formData.email.trim(),
        });
        const newTeacher = created.teacher || created;
        setTeachers((prev) => [newTeacher, ...prev]);

        const previewUrl = created.previewUrl;
        if (previewUrl) {
          setSuccess(
            `Invite sent! (dev preview) → ${previewUrl}`
          );
        } else {
          setSuccess(
            `Teacher account created. An invitation email has been sent to ${formData.email}.`
          );
        }
        setFormData(EMPTY_FORM);
      }

      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.data?.message || err.message || "Unable to save teacher.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name:  teacher.name  || teacher.username || "",
      email: teacher.email || "",
    });
    setError("");
    setSuccess("");
  };

  const handleResendInvite = async (teacher) => {
    setError("");
    setSuccess("");
    try {
      const res = await authPost("/api/admin/teachers/resend-invite", {
        email: teacher.email,
      });
      const previewUrl = res.previewUrl;
      if (previewUrl) {
        setSuccess(`Invite resent! (dev preview) → ${previewUrl}`);
      } else {
        setSuccess(`Invitation email resent to ${teacher.email}.`);
      }
    } catch (err) {
      setError(err.message || "Unable to resend invite.");
    }
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
          (t.id || t._id) === (updatedTeacher.id || updatedTeacher._id)
            ? updatedTeacher
            : t
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
      await authDelete(
        `/api/admin/teachers/${deleteTarget.id || deleteTarget._id}`
      );
      setTeachers((prev) =>
        prev.filter(
          (t) => (t.id || t._id) !== (deleteTarget.id || deleteTarget._id)
        )
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
      {/* Top bar */}
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
            <h3>{editingTeacher ? "Edit teacher" : "Invite teacher"}</h3>
            {editingTeacher && (
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          {/* Invite notice — only shown when creating */}
          {!editingTeacher && (
            <div className="invite-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              The teacher will receive an email with a secure link to set their own password. No password is created here.
            </div>
          )}

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

            {error   && <div className="feedback error">{error}</div>}
            {success && <div className="feedback success">{success}</div>}

            <button type="submit" className="primary-btn" disabled={saving}>
              {saving
                ? "Saving..."
                : editingTeacher
                ? "Update teacher"
                : "Send invitation"}
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
                <div className="teacher-row" key={teacher.id || teacher._id || teacher.email}>
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

                    {/* Resend invite only for pending teachers */}
                    {teacher.status === "pending_password_setup" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleResendInvite(teacher)}
                      >
                        Resend invite
                      </button>
                    )}

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
              {searchTerm
                ? "No teachers match your search."
                : "No teachers yet. Send an invitation above."}
            </div>
          )}
        </article>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Delete teacher?</h3>
            <p>
              This will permanently remove{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong> from the system.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                style={{ padding: "10px 18px", fontSize: "0.88rem" }}
                onClick={handleDelete}
              >
                Delete teacher
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TeacherManagement;

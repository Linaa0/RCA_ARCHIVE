import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost, authPut } from "../utils/apiClient";
import "./TeacherManagement.css";

const EMPTY_FORM = { name: "", email: "" };

const StudentManagement = ({ onUpdated }) => {
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authGet("/api/admin/students");
      setStudents(response.students || []);
    } catch (err) {
      setError(err.message || "Unable to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter((student) =>
      [student.name, student.username, student.email, student.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [searchTerm, students]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingStudent(null);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingStudent) {
        const response = await authPut(
          `/api/admin/students/${editingStudent.id || editingStudent._id}`,
          { name: formData.name.trim(), email: formData.email.trim() },
        );
        const updated = response.student || response;
        setStudents((current) =>
          current.map((student) =>
            (student.id || student._id) === (updated.id || updated._id)
              ? updated
              : student,
          ),
        );
        setSuccess("Student updated successfully.");
        resetForm();
      } else {
        const response = await authPost("/api/admin/students", {
          name: formData.name.trim(),
          email: formData.email.trim(),
        });
        setStudents((current) => [response.student, ...current]);
        setSuccess(
          response.previewUrl
            ? `Invitation sent. Dev preview: ${response.previewUrl}`
            : "Invitation sent to the student's inbox.",
        );
        setFormData(EMPTY_FORM);
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.data?.message || err.message || "Unable to save student.");
    } finally {
      setSaving(false);
    }
  };

  const resendInvite = async (student) => {
    try {
      const response = await authPost("/api/admin/students/resend-invite", {
        email: student.email,
      });
      setSuccess(
        response.previewUrl
          ? `Invitation resent. Dev preview: ${response.previewUrl}`
          : `Invitation resent to ${student.email}.`,
      );
    } catch (err) {
      setError(err.message || "Unable to resend invitation.");
    }
  };

  const toggleStatus = async (student) => {
    try {
      const response = await authPut(
        `/api/admin/students/${student.id || student._id}`,
        { status: student.status === "disabled" ? "active" : "disabled" },
      );
      const updated = response.student || response;
      setStudents((current) =>
        current.map((item) =>
          (item.id || item._id) === (updated.id || updated._id)
            ? updated
            : item,
        ),
      );
      setSuccess(
        updated.status === "disabled"
          ? "Student disabled."
          : "Student re-enabled.",
      );
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to update student status.");
    }
  };

  const deleteStudent = async () => {
    if (!deleteTarget) return;
    try {
      await authDelete(
        `/api/admin/students/${deleteTarget.id || deleteTarget._id}`,
      );
      setStudents((current) =>
        current.filter(
          (student) =>
            (student.id || student._id) !==
            (deleteTarget.id || deleteTarget._id),
        ),
      );
      setSuccess("Student deleted successfully.");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to delete student.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <section className="teacher-management student-management">
      <div className="teacher-topbar">
        <div>
          <p className="section-kicker">Student management</p>
          <h2>
            {editingStudent ? "Edit student" : "Create & manage students"}
          </h2>
        </div>
        <div className="teacher-tools">
          <input
            type="search"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button
            type="button"
            className="ghost-btn"
            onClick={loadStudents}
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      <div className="teacher-layout">
        <article className="teacher-card">
          <div className="card-header">
            <h3>{editingStudent ? "Edit student" : "Add student"}</h3>
            {editingStudent && (
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
          {!editingStudent && (
            <div className="invite-notice">
              The student will receive a secure email link to set their own
              password. Students may also create their own account through the
              public sign up page.
            </div>
          )}
          <form className="teacher-form" onSubmit={handleSubmit}>
            <label>
              <span>Full name</span>
              <input
                name="name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="Student's full name"
                required
              />
            </label>
            <label>
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData({ ...formData, email: event.target.value })
                }
                placeholder="student@rca.ac.rw"
                required
              />
            </label>
            {error && <div className="feedback error">{error}</div>}
            {success && <div className="feedback success">{success}</div>}
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving
                ? "Saving..."
                : editingStudent
                  ? "Update student"
                  : "Send invitation"}
            </button>
          </form>
        </article>

        <article className="teacher-card teacher-list-card">
          <div className="card-header">
            <h3>All students</h3>
            <span>{filteredStudents.length} found</span>
          </div>
          {loading ? (
            <div className="empty-panel">Loading students...</div>
          ) : filteredStudents.length ? (
            <div className="teacher-list">
              {filteredStudents.map((student) => (
                <div
                  className="teacher-row"
                  key={student.id || student._id || student.email}
                >
                  <div className="teacher-meta">
                    <strong>
                      {student.name || student.username || "Unnamed student"}
                    </strong>
                    <span>{student.email}</span>
                    <small
                      className={`status-chip ${student.status === "disabled" ? "status-disabled" : "status-active"}`}
                    >
                      {student.status || "active"}
                    </small>
                  </div>
                  <div className="teacher-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setEditingStudent(student);
                        setFormData({
                          name: student.name || student.username || "",
                          email: student.email || "",
                        });
                      }}
                    >
                      Edit
                    </button>
                    {student.status === "pending_password_setup" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => resendInvite(student)}
                      >
                        Resend invite
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => toggleStatus(student)}
                    >
                      {student.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setDeleteTarget(student)}
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
                ? "No students match your search."
                : "No students yet."}
            </div>
          )}
        </article>
      </div>

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Delete student?</h3>
            <p>
              This will permanently remove{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong> from
              the system.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={deleteStudent}
              >
                Delete student
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default StudentManagement;

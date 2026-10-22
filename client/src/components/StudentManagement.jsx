import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost, authPut } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import { RCA_CLASSES } from "./ui/ClassChips";
import { EditIcon, TrashIcon, SearchIcon } from "./ui/Icons";

const EMPTY_FORM = { name: "", email: "", class: "Y1A" };

export default function StudentManagement({ onUpdated }) {
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleOpenModal = () => {
      setEditingStudent(null);
      setFormData(EMPTY_FORM);
      setError("");
      setSuccess("");
      setIsModalOpen(true);
    };

    window.addEventListener("open-create-student-modal", handleOpenModal);
    return () => {
      window.removeEventListener("open-create-student-modal", handleOpenModal);
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase();
    if (!kw) return students;
    return students.filter((s) => {
      const name = (s.name || s.username || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const cls = (s.class || "").toLowerCase();
      return name.includes(kw) || email.includes(kw) || cls.includes(kw);
    });
  }, [searchTerm, students]);

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || student.username || "",
      email: student.email || "",
      class: student.class || "Y1A",
    });
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    setFormData(EMPTY_FORM);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingStudent) {
        const response = await authPut(
          `/api/admin/students/${editingStudent.id || editingStudent._id}`,
          {
            name: formData.name.trim(),
            email: formData.email.trim(),
            class: formData.class,
          }
        );
        const updated = response.student || response;
        setStudents((prev) =>
          prev.map((s) =>
            (s.id || s._id) === (updated.id || updated._id) ? updated : s
          )
        );
        setSuccess("Student record updated successfully.");
        handleCloseModal();
      } else {
        const response = await authPost("/api/admin/students", {
          name: formData.name.trim(),
          email: formData.email.trim(),
          class: formData.class,
        });
        const created = response.student || response;
        setStudents((prev) => [created, ...prev]);
        setSuccess("Student invitation dispatched.");
        handleCloseModal();
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.data?.message || err.message || "Failed to save student.");
    } finally {
      setSaving(false);
    }
  };

  const resendInvite = async (student) => {
    try {
      await authPost("/api/admin/students/resend-invite", {
        email: student.email,
      });
      setSuccess(`Invitation email resent to ${student.email}.`);
    } catch (err) {
      setError(err.message || "Unable to resend invitation.");
    }
  };

  const toggleStatus = async (student) => {
    const nextStatus = student.status === "disabled" ? "active" : "disabled";
    try {
      const response = await authPut(
        `/api/admin/students/${student.id || student._id}/status`,
        { status: nextStatus }
      );
      const updated = response.student || response;
      setStudents((prev) =>
        prev.map((s) =>
          (s.id || s._id) === (updated.id || updated._id) ? updated : s
        )
      );
      setSuccess(`Student account is now ${nextStatus}.`);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to update student status.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authDelete(
        `/api/admin/students/${deleteTarget.id || deleteTarget._id}`
      );
      setStudents((prev) =>
        prev.filter(
          (s) => (s.id || s._id) !== (deleteTarget.id || deleteTarget._id)
        )
      );
      setSuccess("Student deleted successfully.");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Unable to delete student.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      title: "Student",
      key: "name",
      render: (_, s) => (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Avatar name={s.name || s.username || s.email} size="sm" variant="boy" />
          <div>
            <strong style={{ display: "block", color: "var(--color-ink, #1B2142)", fontSize: "0.92rem" }}>
              {s.name || s.username || "Unnamed Student"}
            </strong>
            <span style={{ fontSize: "0.78rem", color: "var(--color-muted, #6A7399)" }}>
              Cohort {s.class || "General"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Email Address",
      key: "email",
      render: (email) => (
        <span style={{ color: "var(--color-ink, #1B2142)", fontFamily: "monospace", fontSize: "0.86rem" }}>
          {email}
        </span>
      ),
    },
    {
      title: "Class",
      key: "class",
      render: (cls) => (
        <Badge variant="indigo" size="sm">
          {cls || "Y1A"}
        </Badge>
      ),
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
      render: (_, student) => {
        const isPending = student.status === "pending_password_setup";
        const isDisabled = student.status === "disabled";
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
            <IconButton
              icon={<EditIcon size={15} />}
              title="Edit student"
              size="sm"
              onClick={() => handleOpenEdit(student)}
            />

            {isPending && (
              <IconButton
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                }
                title="Resend invitation"
                size="sm"
                variant="subtle"
                onClick={() => resendInvite(student)}
              />
            )}

            <IconButton
              icon={
                isDisabled ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                )
              }
              title={isDisabled ? "Re-enable student" : "Disable student"}
              size="sm"
              variant={isDisabled ? "subtle" : "ghost"}
              onClick={() => toggleStatus(student)}
            />

            <IconButton
              icon={<TrashIcon size={15} />}
              title="Delete student"
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(student)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-card, 24px)",
        padding: "32px",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        boxShadow: "var(--shadow-card, 0 8px 24px -4px rgba(35, 44, 107, 0.06))",
      }}
    >
      {/* Top Bar with Search & Create Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ flex: 1, maxWidth: "340px" }}>
          <Input
            icon={<SearchIcon size={16} />}
            placeholder="Search students by name, email, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ margin: 0 }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStudents}
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingStudent(null);
              setFormData(EMPTY_FORM);
              setIsModalOpen(true);
            }}
          >
            + Create Student
          </Button>
        </div>
      </div>

      {success && (
        <div
          style={{
            padding: "12px 18px",
            background: "rgba(16, 185, 129, 0.10)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#10B981",
            borderRadius: "14px",
            marginBottom: "20px",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 18px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#EF4444",
            borderRadius: "14px",
            marginBottom: "20px",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Student Table */}
      <Table
        columns={columns}
        data={filteredStudents}
        loading={loading}
        emptyMessage={
          searchTerm
            ? "No students match your search criteria."
            : "No students registered yet. Students can sign up via self-service or be invited above."
        }
      />

      {/* Create / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingStudent ? "Edit Student Account" : "Add Student"}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {!editingStudent && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--color-indigo-50, #F4F6FD)",
                borderRadius: "14px",
                fontSize: "0.85rem",
                color: "var(--color-indigo-900, #232C6B)",
                lineHeight: 1.45,
                border: "1px solid rgba(91, 115, 224, 0.18)",
              }}
            >
              The student will receive an invitation email to set up their password. Students may also register themselves through public sign-up.
            </div>
          )}

          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. Grace Stanley"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            placeholder="grace.stanley@rca.ac.rw"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            required
          />

          <Select
            label="Class Cohort"
            name="class"
            value={formData.class}
            onChange={(e) => setFormData((prev) => ({ ...prev, class: e.target.value }))}
            options={RCA_CLASSES.map((c) => ({ value: c.id, label: `${c.label} (Year ${c.year})` }))}
          />

          {error && (
            <span style={{ color: "#EF4444", fontSize: "0.82rem", fontWeight: 500 }}>
              {error}
            </span>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {editingStudent ? "Update Student" : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Student"
      >
        <p style={{ color: "var(--color-ink-subtle, #3A4269)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "20px" }}>
          Are you sure you want to delete student{" "}
          <strong>{deleteTarget?.name || deleteTarget?.email}</strong>?
          Their downloads and activity records will be archived.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <Button
            variant="secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete Student
          </Button>
        </div>
      </Modal>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost, authPut } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import { EditIcon, TrashIcon, SearchIcon, CloseIcon } from "./ui/Icons";
import "./TeacherManagement.css";

const EMPTY_FORM = { name: "", email: "" };

export default function TeacherManagement({ onUpdated }) {
  const [teachers, setTeachers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    loadTeachers();

    const handleOpenModal = () => {
      setEditingTeacher(null);
      setFormData(EMPTY_FORM);
      setError("");
      setSuccess("");
      setIsModalOpen(true);
    };

    window.addEventListener("open-invite-teacher-modal", handleOpenModal);
    return () => {
      window.removeEventListener("open-invite-teacher-modal", handleOpenModal);
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase();
    if (!kw) return teachers;
    return teachers.filter((t) => {
      const name = (t.name || t.username || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const status = (t.status || "").toLowerCase();
      return name.includes(kw) || email.includes(kw) || status.includes(kw);
    });
  }, [searchTerm, teachers]);

  const handleOpenEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name || teacher.username || "",
      email: teacher.email || "",
    });
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTeacher(null);
    setFormData(EMPTY_FORM);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingTeacher) {
        const payload = {
          name: formData.name.trim(),
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
        handleCloseModal();
      } else {
        const created = await authPost("/api/admin/teachers", {
          name: formData.name.trim(),
          email: formData.email.trim(),
        });
        const newTeacher = created.teacher || created;
        setTeachers((prev) => [newTeacher, ...prev]);
        setSuccess("Teacher invitation sent successfully.");
        handleCloseModal();
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Failed to save teacher.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (teacher) => {
    const newStatus = teacher.status === "disabled" ? "active" : "disabled";
    try {
      const updated = await authPut(
        `/api/admin/teachers/${teacher.id || teacher._id}/status`,
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

  const handleResendInvite = async (teacher) => {
    try {
      await authPost("/api/admin/teachers/resend-invite", {
        email: teacher.email,
      });
      setSuccess(`Invitation email resent to ${teacher.email}.`);
    } catch (err) {
      setError(err.message || "Unable to resend invite.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
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
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      title: "Teacher",
      key: "name",
      render: (_, t) => (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Avatar name={t.name || t.username || t.email} size="sm" variant="initials" />
          <div>
            <strong style={{ display: "block", color: "var(--color-ink, #1B2142)", fontSize: "0.92rem" }}>
              {t.name || t.username || "Unnamed Teacher"}
            </strong>
            <span style={{ fontSize: "0.78rem", color: "var(--color-muted, #6A7399)" }}>
              Faculty Member
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
      title: "Account Status",
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
            {isPending ? "Pending Password Setup" : isDisabled ? "Disabled" : "Active"}
          </Badge>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, teacher) => {
        const isPending = teacher.status === "pending_password_setup";
        const isDisabled = teacher.status === "disabled";
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
            <IconButton
              icon={<EditIcon size={15} />}
              title="Edit teacher details"
              size="sm"
              onClick={() => handleOpenEdit(teacher)}
            />

            {isPending && (
              <IconButton
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                }
                title="Resend invitation link"
                size="sm"
                variant="subtle"
                onClick={() => handleResendInvite(teacher)}
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
              title={isDisabled ? "Re-enable account" : "Disable account"}
              size="sm"
              variant={isDisabled ? "subtle" : "ghost"}
              onClick={() => handleToggleStatus(teacher)}
            />

            <IconButton
              icon={<TrashIcon size={15} />}
              title="Delete teacher"
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(teacher)}
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
      {/* Top Bar with Search & Invite Button */}
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
            placeholder="Search teachers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ margin: 0 }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTeachers}
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingTeacher(null);
              setFormData(EMPTY_FORM);
              setIsModalOpen(true);
            }}
          >
            + Invite Teacher
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

      {/* Teachers Table */}
      <Table
        columns={columns}
        data={filteredTeachers}
        loading={loading}
        emptyMessage={
          searchTerm
            ? "No teachers match your search query."
            : "No teachers enrolled yet. Click '+ Invite Teacher' to send an invitation."
        }
      />

      {/* Invite / Edit Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTeacher ? "Edit Teacher Account" : "Invite Faculty Member"}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {!editingTeacher && (
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
              The teacher will receive an email with a secure link to set their own password.
            </div>
          )}

          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. John Doe"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            placeholder="teacher@rca.ac.rw"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            required
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
              {editingTeacher ? "Update Teacher" : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Teacher"
      >
        <p style={{ color: "var(--color-ink-subtle, #3A4269)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "20px" }}>
          Are you sure you want to delete teacher{" "}
          <strong>{deleteTarget?.name || deleteTarget?.email}</strong>?
          Their uploaded past papers will remain in the archive under faculty records.
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
            Delete Teacher
          </Button>
        </div>
      </Modal>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet, authPost } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import EmptyState from "./ui/EmptyState";
import { TrashIcon, SearchIcon, UsersIcon } from "./ui/Icons";
import "./TeacherManagement.css";

const EMPTY_FORM = { name: "", email: "" };

export default function TeacherManagement({ onUpdated }) {
  const [teachers, setTeachers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(EMPTY_FORM);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const created = await authPost("/api/admin/teachers", {
        name: formData.name.trim(),
        email: formData.email.trim(),
      });
      const newTeacher = created.teacher || created;
      setTeachers((prev) => [newTeacher, ...prev]);
      setSuccess("Teacher invitation sent successfully.");
      handleCloseModal();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Failed to invite teacher.");
    } finally {
      setSaving(false);
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
      render: (_, t) => {
        const displayName = t.name || t.username || "Unnamed Teacher";
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
                Faculty Member
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Email Address",
      key: "email",
      render: (email) => (
        <span
          title={email}
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
      render: (_, teacher) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            icon={<TrashIcon size={15} />}
            title={`Delete ${teacher.name || teacher.email}`}
            variant="danger"
            size="sm"
            onClick={() => setDeleteTarget(teacher)}
          />
        </div>
      ),
    },
  ];

  return (
    <section
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        padding: "32px",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
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
              setFormData(EMPTY_FORM);
              setIsModalOpen(true);
            }}
          >
            Invite Teacher
          </Button>
        </div>
      </div>

      {success && (
        <div
          role="status"
          style={{
            padding: "10px 16px",
            background: "rgba(16, 185, 129, 0.10)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#10B981",
            borderRadius: "var(--radius-sm)",
            marginBottom: "18px",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 16px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#EF4444",
            borderRadius: "var(--radius-sm)",
            marginBottom: "18px",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading && teachers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-secondary)" }}>
          Loading faculty records...
        </div>
      ) : filteredTeachers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={36} />}
          title={searchTerm ? "No Matching Faculty Members" : "No Faculty Enrolled"}
          description={
            searchTerm
              ? `No teacher records match "${searchTerm}".`
              : "Click 'Invite Teacher' above to onboard your first faculty member."
          }
        />
      ) : (
        <Table
          columns={columns}
          data={filteredTeachers}
          rowKey={(t) => t.id || t._id}
        />
      )}

      {/* Invite Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Invite Faculty Member"
        description="The teacher will receive an email with instructions to set their password."
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. John Doe"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            autoFocus
          />

          <Input
            label="Faculty Email Address"
            type="email"
            name="email"
            placeholder="teacher@rca.ac.rw"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            required
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <Button variant="secondary" size="sm" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={saving}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Teacher"
        description={`Are you sure you want to delete teacher "${deleteTarget?.name || deleteTarget?.email}"? Their uploaded past papers will remain preserved in the archive under faculty records.`}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
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

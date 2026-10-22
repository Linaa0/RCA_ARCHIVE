import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import EmptyState from "./ui/EmptyState";
import { TrashIcon, SearchIcon, UsersIcon } from "./ui/Icons";

export default function StudentManagement({ onUpdated }) {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authGet("/api/admin/students");
      const list = response.students || (Array.isArray(response) ? response : []);
      setStudents(list);
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
    const kw = searchTerm.trim().toLowerCase();
    if (!kw) return students;
    return students.filter((s) => {
      const name = (s.name || s.username || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const cls = (s.class || "").toLowerCase();
      return name.includes(kw) || email.includes(kw) || cls.includes(kw);
    });
  }, [searchTerm, students]);

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
      render: (_, s) => {
        const displayName = s.name || s.username || "Unnamed Student";
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
                Cohort: {s.class || "General"}
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
      render: (_, student) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            icon={<TrashIcon size={15} />}
            title={`Delete ${student.name || student.email}`}
            variant="danger"
            size="sm"
            onClick={() => setDeleteTarget(student)}
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
      {/* Student list search and refresh controls */}
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
            {loading ? "Loading..." : "Refresh"}
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

      {loading && students.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-secondary)" }}>
          Loading student directory...
        </div>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={36} />}
          title={searchTerm ? "No Matching Students" : "No Students Registered"}
          description={
            searchTerm
              ? `No student records match "${searchTerm}".`
              : "Students will appear here once they register for an account."
          }
        />
      ) : (
        <Table
          columns={columns}
          data={filteredStudents}
          rowKey={(s) => s.id || s._id}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Student Deletion"
        description="Are you sure you want to permanently delete this student account? This action cannot be undone."
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
            Delete Student
          </Button>
        </div>
      </Modal>
    </section>
  );
}

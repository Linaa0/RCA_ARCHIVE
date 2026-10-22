import React, { useEffect, useMemo, useState } from "react";
import { authDelete, authGet } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import { TrashIcon, SearchIcon } from "./ui/Icons";

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
        return (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
            {loading ? "Loading..." : "Reload"}
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
            : "No students registered yet. Students can create accounts through sign-up."
        }
      />

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

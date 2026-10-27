import React, { useEffect, useState } from "react";
import { authGet } from "../utils/apiClient";
import Modal from "./ui/Modal";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import { TermBadge, TermFilter, TermMenu } from "./ui";
import { useNavigate } from "react-router-dom";

export default function UserUploadsModal({ user, isOpen, onClose }) {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [termCounts, setTermCounts] = useState({ 1: 0, 2: 0, 3: 0, unset: 0 });
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userId = user?.id || user?._id;

  const loadResources = async (termVal) => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const q = termVal && termVal !== "all" ? `?term=${termVal}` : "";
      const res = await authGet(`/api/admin/users/${userId}/resources${q}`);
      setResources(res.resources || []);
      if (res.termCounts) {
        setTermCounts(res.termCounts);
      }
    } catch (err) {
      setError(err.message || "Failed to load uploads for this user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      setSelectedTerm("all");
      loadResources("all");
    } else {
      setResources([]);
      setError("");
    }
  }, [isOpen, userId]);

  const handleTermFilterChange = (newTerm) => {
    setSelectedTerm(newTerm);
    loadResources(newTerm);
  };

  const handleTermChangedLocally = (itemId, newTermNumber) => {
    setResources((prev) =>
      prev.map((r) => (r.id === itemId || r._id === itemId ? { ...r, term: newTermNumber } : r))
    );
    // Reload counts in background
    loadResources(selectedTerm);
  };

  const columns = [
    {
      title: "Title & Details",
      key: "title",
      render: (_, r) => (
        <div>
          <strong style={{ display: "block", color: "var(--color-text-primary)", fontSize: "0.9rem" }}>
            {r.title || r.originalName || "Untitled"}
          </strong>
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)" }}>
            {r.subject || "General"} | Year {r.year || "N/A"}
          </span>
        </div>
      ),
    },
    {
      title: "Type",
      key: "type",
      render: (type) => (
        <Badge variant="neutral" size="sm">
          {type || "Paper"}
        </Badge>
      ),
    },
    {
      title: "Term",
      key: "term",
      render: (_, r) => <TermBadge term={r.term} size="sm" />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          <TermMenu
            item={r}
            currentTerm={r.term}
            onTermChange={(newTerm) => handleTermChangedLocally(r.id || r._id, newTerm)}
            size="sm"
          />
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate(`/file-viewer/${r.id || r._id}`)}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Uploads by ${user?.name || user?.email || "User"}`}
      description="Review and update academic terms for papers and materials uploaded by this user."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "600px", maxWidth: "100%" }}>
        <TermFilter
          selected={selectedTerm}
          onChange={handleTermFilterChange}
          counts={termCounts}
        />

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm, 8px)",
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#EF4444",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-secondary)" }}>
            Loading user uploads...
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            title="No uploads found"
            description="This user has not uploaded any past papers or materials for the selected filter."
          />
        ) : (
          <Table
            columns={columns}
            data={resources}
            rowKey={(r) => r.id || r._id}
          />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { authGet, authPatch } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import { CheckIcon, CloseIcon } from "./ui/Icons";
import "./DeletionRequests.css";

export default function DeletionRequests({ onUpdated }) {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authGet("/api/admin/deletion-requests");
      const list =
        response.deletionRequests ||
        response.requests ||
        (Array.isArray(response) ? response : []);
      setRequests(list);
    } catch (requestError) {
      setError(requestError.message || "Unable to load deletion requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "Pending"),
    [requests]
  );

  const processedRequests = useMemo(
    () => requests.filter((r) => r.status !== "Pending"),
    [requests]
  );

  const updateRequest = async (requestId, action) => {
    setActionLoading(requestId + action);
    setError("");
    try {
      await authPatch(`/api/admin/deletion-requests/${requestId}/${action}`, {});
      await loadRequests();
      if (onUpdated) onUpdated();
    } catch (updateError) {
      setError(updateError.message || `Unable to ${action} deletion request.`);
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { id: "pending", label: "Pending Review", count: pendingRequests.length },
    { id: "processed", label: "Processed History", count: processedRequests.length },
  ];

  const columns = [
    {
      title: "Target Paper",
      key: "paperTitle",
      render: (title, req) => (
        <div>
          <strong style={{ display: "block", color: "var(--color-ink, #1B2142)", fontSize: "0.95rem" }}>
            {title || "Untitled Document"}
          </strong>
          <span style={{ fontSize: "0.8rem", color: "var(--color-muted, #6A7399)" }}>
            Paper ID: {req.paperId || req.paper || "—"}
          </span>
        </div>
      ),
    },
    {
      title: "Requester",
      key: "requestedBy",
      render: (by, req) => (
        <div>
          <span style={{ display: "block", fontWeight: 600, color: "var(--color-ink, #1B2142)", fontSize: "0.88rem" }}>
            {by || "Unknown"}
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--color-muted, #6A7399)" }}>
            Role: {req.requesterRole || "User"}
          </span>
        </div>
      ),
    },
    {
      title: "Reason Provided",
      key: "reason",
      render: (reason) => (
        <span style={{ fontSize: "0.86rem", color: "var(--color-ink-subtle, #3A4269)", fontStyle: reason ? "normal" : "italic" }}>
          {reason || "No specific reason provided."}
        </span>
      ),
    },
    {
      title: "Requested Date",
      key: "requestedAt",
      render: (date) => (
        <span style={{ fontSize: "0.82rem", color: "var(--color-muted, #6A7399)" }}>
          {date ? new Date(date).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (status) => {
        const isPending = status === "Pending";
        const isApproved = status === "Approved";
        return (
          <Badge
            variant={isPending ? "warning" : isApproved ? "success" : "danger"}
            size="sm"
            dot
          >
            {status}
          </Badge>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, req) => {
        const reqId = req.id || req._id;
        const isPending = req.status === "Pending";

        if (!isPending) {
          return (
            <span style={{ fontSize: "0.8rem", color: "var(--color-tertiary, #949EBF)" }}>
              Processed
            </span>
          );
        }

        return (
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button
              variant="indigo"
              size="sm"
              icon={<CheckIcon size={14} />}
              loading={actionLoading === reqId + "approve"}
              disabled={!!actionLoading}
              onClick={() => updateRequest(reqId, "approve")}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<CloseIcon size={14} />}
              loading={actionLoading === reqId + "reject"}
              disabled={!!actionLoading}
              onClick={() => updateRequest(reqId, "reject")}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const currentData = activeTab === "pending" ? pendingRequests : processedRequests;

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
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={loadRequests}
          disabled={loading}
        >
          {loading ? "Loading..." : "Reload Queue"}
        </Button>
      </div>

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

      <Table
        columns={columns}
        data={currentData}
        loading={loading}
        emptyMessage={
          activeTab === "pending"
            ? "No pending deletion requests. The moderation queue is completely clear!"
            : "No processed deletion requests in history."
        }
      />
    </section>
  );
}

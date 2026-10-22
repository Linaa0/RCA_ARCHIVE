import React, { useEffect, useMemo, useState } from "react";
import { authGet, authPatch } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import EmptyState from "./ui/EmptyState";
import { CheckIcon, CloseIcon, TrashIcon } from "./ui/Icons";
import "./DeletionRequests.css";

export default function DeletionRequests({ onUpdated }) {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authGet("/api/admin/deletion-requests");
      const responseList =
        response.deletionRequests ||
        response.requests ||
        (Array.isArray(response) ? response : []);
      const list = Array.isArray(responseList) ? responseList : [];
      setRequests(list);
    } catch (requestError) {
      setRequests([]);
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
    setNotice("");
    try {
      const result = await authPatch(
        `/api/admin/deletion-requests/${requestId}/${action}`,
        {}
      );
      setNotice(result.message || `Deletion request ${action}d successfully.`);
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
        <div style={{ maxWidth: "240px", minWidth: 0 }}>
          <strong
            title={title || "Untitled Document"}
            style={{
              display: "block",
              color: "var(--color-text-primary)",
              fontSize: "0.92rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title || "Untitled Document"}
          </strong>
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)" }}>
            Paper ID: {req.paperId || req.paper || "N/A"}
          </span>
        </div>
      ),
    },
    {
      title: "Requester",
      key: "requestedBy",
      render: (by, req) => (
        <div style={{ maxWidth: "180px", minWidth: 0 }}>
          <span
            title={by || "Unknown"}
            style={{
              display: "block",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              fontSize: "0.88rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {by || "Unknown"}
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
            Role: {req.requesterRole || "User"}
          </span>
        </div>
      ),
    },
    {
      title: "Reason Provided",
      key: "reason",
      render: (reason) => (
        <div style={{ maxWidth: "260px", minWidth: 0 }}>
          <span
            title={reason || "No specific reason provided."}
            style={{
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {reason || "No specific reason provided."}
          </span>
        </div>
      ),
    },
    {
      title: "Requested Date",
      key: "requestedAt",
      render: (date) => (
        <span style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
          {date ? new Date(date).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (status, req) => {
        const isPending = status === "Pending";
        const isApproved = status === "Approved";
        const reqId = req.id || req._id;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isPending && (
              <div style={{ display: "flex", flexWrap: "nowrap", gap: "6px" }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckIcon size={14} />}
                  loading={actionLoading === reqId + "approve"}
                  disabled={Boolean(actionLoading)}
                  onClick={() => updateRequest(reqId, "approve")}
                  style={{ padding: "6px 14px" }}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<CloseIcon size={14} />}
                  loading={actionLoading === reqId + "reject"}
                  disabled={Boolean(actionLoading)}
                  onClick={() => updateRequest(reqId, "reject")}
                  style={{ padding: "6px 14px" }}
                >
                  Reject
                </Button>
              </div>
            )}
            {!isPending && (
              <Badge
                variant={isApproved ? "success" : "danger"}
                size="sm"
                dot
              >
                {status}
              </Badge>
            )}
          </div>
        );
      },
    },
  ];

  const currentData = activeTab === "pending" ? pendingRequests : processedRequests;

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

      {notice && (
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
          {notice}
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

      {loading && requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-secondary)" }}>
          Loading deletion queue...
        </div>
      ) : currentData.length === 0 ? (
        <EmptyState
          icon={<TrashIcon size={36} />}
          title={activeTab === "pending" ? "No Pending Requests" : "No Processed Requests"}
          description={
            activeTab === "pending"
              ? "All paper deletion requests have been reviewed."
              : "No historical deletion requests found."
          }
        />
      ) : (
        <Table
          columns={columns}
          data={currentData}
          rowKey={(r) => r.id || r._id}
        />
      )}
    </section>
  );
}

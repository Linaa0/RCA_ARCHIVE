import React, { useEffect, useMemo, useState } from "react";
import { authGet, authPatch } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import { CheckIcon, CloseIcon } from "./ui/Icons";
import "./DeletionRequests.css";

const DEMO_REQUESTS = [
  {
    id: "demo-pending-1",
    paperId: "PPR-2025-014",
    paperTitle: "Mathematics — Year 2 Term 1 CAT",
    requestedBy: "Demo Student",
    requesterRole: "Student",
    reason: "This upload is a duplicate of the corrected paper.",
    requestedAt: "2025-04-12T09:30:00.000Z",
    status: "Pending",
    isDemo: true,
  },
  {
    id: "demo-pending-2",
    paperId: "PPR-2025-008",
    paperTitle: "Physics — Year 1 End of Term Exam",
    requestedBy: "Sample Learner",
    requesterRole: "Student",
    reason: "The file is unreadable and appears to be the wrong document.",
    requestedAt: "2025-04-10T14:15:00.000Z",
    status: "Pending",
    isDemo: true,
  },
  {
    id: "demo-pending-3",
    paperId: "PPR-2025-003",
    paperTitle: "Database — Year 3 Revision Paper",
    requestedBy: "Test Account",
    requesterRole: "Teacher",
    reason: "This resource contains outdated course material.",
    requestedAt: "2025-04-08T11:00:00.000Z",
    status: "Pending",
    isDemo: true,
  },
  {
    id: "demo-processed-1",
    paperId: "PPR-2025-001",
    paperTitle: "Programming — Year 1 Practice CAT",
    requestedBy: "Demo Student",
    requesterRole: "Student",
    reason: "Duplicate upload.",
    requestedAt: "2025-04-02T08:45:00.000Z",
    status: "Approved",
    isDemo: true,
  },
  {
    id: "demo-processed-2",
    paperId: "PPR-2024-022",
    paperTitle: "Networking — Year 2 Mock Exam",
    requestedBy: "Sample Learner",
    requesterRole: "Student",
    reason: "The paper is still needed by other students.",
    requestedAt: "2025-03-28T13:20:00.000Z",
    status: "Rejected",
    isDemo: true,
  },
];

export default function DeletionRequests({ onUpdated }) {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [showingDemoData, setShowingDemoData] = useState(false);

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
      const hasRequests = Array.isArray(list) && list.length > 0;
      setShowingDemoData(import.meta.env.DEV && !hasRequests);
      setRequests(
        import.meta.env.DEV && !hasRequests ? DEMO_REQUESTS : list
      );
    } catch (requestError) {
      setShowingDemoData(false);
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
    const request = requests.find((item) => (item.id || item._id) === requestId);
    if (request?.isDemo) {
      const status = action === "approve" ? "Approved" : "Rejected";
      setRequests((currentRequests) =>
        currentRequests.map((item) =>
          (item.id || item._id) === requestId ? { ...item, status } : item
        )
      );
      setNotice(`Example request marked ${status.toLowerCase()}; this change is not saved.`);
      return;
    }

    setActionLoading(requestId + action);
    setError("");
    setNotice("");
    try {
      const result = await authPatch(
        `/api/admin/deletion-requests/${requestId}/${action}`,
        {}
      );
      setNotice(result.message || `Deletion request ${action}d.`);
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
      render: (status, req) => {
        const isPending = status === "Pending";
        const isApproved = status === "Approved";
        const reqId = req.id || req._id;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isPending && (
              <div style={{ display: "flex", flexWrap: "nowrap", gap: "6px" }}>
                <Button
                  variant="indigo"
                  size="sm"
                  icon={<CheckIcon size={14} />}
                  loading={actionLoading === reqId + "approve"}
                  disabled={!!actionLoading}
                  onClick={() => updateRequest(reqId, "approve")}
                  style={{ padding: "8px 12px" }}
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
                  style={{ padding: "8px 12px" }}
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

      {showingDemoData && (
        <div
          role="status"
          style={{
            padding: "12px 18px",
            background: "rgba(91, 115, 224, 0.08)",
            border: "1px solid rgba(91, 115, 224, 0.2)",
            color: "var(--color-indigo-900, #232C6B)",
            borderRadius: "14px",
            marginBottom: "20px",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          Example requests are for display only. Decisions on examples change this view but are not saved.
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            padding: "12px 18px",
            background: "rgba(16, 185, 129, 0.10)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#047857",
            borderRadius: "14px",
            marginBottom: "20px",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {notice}
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

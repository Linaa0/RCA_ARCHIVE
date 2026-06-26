import React, { useEffect, useMemo, useState } from "react";
import { authGet, authPatch } from "../utils/apiClient";
import "./DeletionRequests.css";

const DeletionRequests = ({ onUpdated }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authGet("/api/admin/deletion-requests");
      // backend returns { deletionRequests: [...] }
      const list = response.deletionRequests || response.requests || (Array.isArray(response) ? response : []);
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
      // Reload fresh list after action
      await loadRequests();
      if (onUpdated) onUpdated();
    } catch (updateError) {
      setError(updateError.message || `Unable to ${action} deletion request.`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="deletion-requests">
      <div className="deletion-header">
        <div>
          <p className="section-kicker">Paper deletion requests</p>
          <h2>Approve or reject paper removal requests</h2>
        </div>

        <button type="button" className="ghost-btn" onClick={loadRequests} disabled={loading}>
          {loading ? "Loading..." : "Reload requests"}
        </button>
      </div>

      {error ? <div className="feedback error">{error}</div> : null}

      <div className="deletion-grid">
        <article className="deletion-card">
          <div className="card-header">
            <h3>Pending</h3>
            <span className="badge badge-pending">{pendingRequests.length}</span>
          </div>

          {loading ? (
            <div className="empty-panel">Loading pending requests...</div>
          ) : pendingRequests.length ? (
            <div className="request-list">
              {pendingRequests.map((request) => {
                const reqId = request.id || request._id;
                return (
                  <div key={reqId} className="request-item">
                    <div className="request-meta">
                      <strong>{request.paperTitle || "Untitled paper"}</strong>
                      <span>
                        Requested by <strong>{request.requestedBy || "unknown"}</strong>{" "}
                        ({request.requesterRole || "user"})
                      </span>
                      <p className="request-reason">{request.reason || "No reason provided."}</p>
                      <small>{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : ""}</small>
                    </div>

                    <div className="request-actions">
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={!!actionLoading}
                        onClick={() => updateRequest(reqId, "approve")}
                      >
                        {actionLoading === reqId + "approve" ? "Approving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={!!actionLoading}
                        onClick={() => updateRequest(reqId, "reject")}
                      >
                        {actionLoading === reqId + "reject" ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">No pending deletion requests.</div>
          )}
        </article>

        <article className="deletion-card">
          <div className="card-header">
            <h3>Processed</h3>
            <span className="badge">{processedRequests.length}</span>
          </div>

          {processedRequests.length ? (
            <div className="request-list compact">
              {processedRequests.map((request) => {
                const reqId = request.id || request._id;
                return (
                  <div key={reqId} className="processed-row">
                    <div className="processed-meta">
                      <strong>{request.paperTitle || "Untitled paper"}</strong>
                      <span>{request.requestedBy || "unknown"}</span>
                      {request.reason ? <p className="request-reason">{request.reason}</p> : null}
                    </div>
                    <span className={`status-badge status-${(request.status || "").toLowerCase()}`}>
                      {request.status || "Processed"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">No processed requests yet.</div>
          )}
        </article>
      </div>
    </section>
  );
};

export default DeletionRequests;

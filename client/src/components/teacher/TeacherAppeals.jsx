import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import { ForumIcon, CheckIcon } from "../ui/Icons";
import { formatDateTime, toLocalInput, errorMessage } from "../assignments/common";
import "../assignments/assignments.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const notifyChanged = () => window.dispatchEvent(new Event("appeals-changed"));

export default function TeacherAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [mode, setMode] = useState(null); // null | "extend" | "reject"
  const [newDeadline, setNewDeadline] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/appeals");
      const items = data.appeals || [];
      setAppeals(items);
      setError("");
    } catch (err) {
      setAppeals([]);
      setError(errorMessage(err, "Could not load student appeals."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = appeals.find((a) => a.id === openId) || null;

  const openAppeal = (a) => {
    setOpenId(a.id);
    setMode(null);
    setNote("");
    setNewDeadline(toLocalInput(null, 3));
    setModalError("");
  };

  const run = async (fn) => {
    setBusy(true);
    setModalError("");
    try {
      await fn();
      await load();
      notifyChanged();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const markRead = async () => {
    setBusy(true);
    setModalError("");
    try {
      await api.patch(`/appeals/${open.id}/read`);
      await load();
      setTab("read");
      notifyChanged();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const giveMoreTime = () =>
    run(async () => {
      if (!newDeadline) {
        setModalError("Choose the new deadline.");
        return;
      }
      await api.patch(`/appeals/${open.id}/approve`, { newDeadline: new Date(newDeadline).toISOString(), note });
      setMode(null);
    });

  const reject = () =>
    run(async () => {
      await api.patch(`/appeals/${open.id}/reject`, { note });
      setMode(null);
    });

  const shown = appeals.filter((a) => (tab === "unread" ? !a.read : tab === "read" ? a.read : true));
  const unread = appeals.filter((a) => !a.read).length;

  return (
    <div className="asg-page" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            FACULTY INBOX
          </span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "4px",
              marginBottom: "4px",
              letterSpacing: "-0.02em",
            }}
          >
            Assignment Appeals Inbox
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            Review and grant deadline extension requests submitted by enrolled students.
          </p>
        </div>
      </header>

      {error && <div className="asg-alert error">{error}</div>}

      <div className="asg-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`asg-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "unread" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "28px 32px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {loading ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>Loading appeals...</p>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<ForumIcon size={36} />}
            title="No Appeals Found"
            description="Students who require extensions will appear here."
          />
        ) : (
          <div className="th-table-wrap">
            <div className="th-table">
              {shown.map((a) => (
                <button type="button" key={a.id} className={`th-appeal-row ${a.read ? "" : "unread"}`} onClick={() => openAppeal(a)}>
                  <div className="th-cell-title" style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.studentName}>
                    {a.studentName}
                  </div>
                  <div className="th-cell-time" style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.assignmentTitle}>
                    {a.assignmentTitle}
                  </div>
                  <div><span className="th-chip">{a.classLabel || "General"}</span></div>
                  <div className="th-cell-sub">{formatDateTime(a.createdAt)}</div>
                  <div>{a.read ? <Badge variant="neutral" size="sm">Read</Badge> : <Badge variant="warning" size="sm">New</Badge>}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Appeal Details Modal */}
      <Modal isOpen={Boolean(open)} onClose={() => setOpenId(null)} title="Student Appeal Details" maxWidth="560px">
        {open && (
          <div className="asg-modal-scroll" style={{ marginTop: "12px" }}>
            {modalError && <div className="asg-alert error">{modalError}</div>}

            <dl className="th-detail">
              <dt>Assignment</dt>
              <dd>{open.assignmentTitle}</dd>
              <dt>Student</dt>
              <dd>{open.studentName}</dd>
              <dt>Class</dt>
              <dd>{open.classLabel || "General"}</dd>
              <dt>Original Deadline</dt>
              <dd>{formatDateTime(open.originalDeadline)}</dd>
              <dt>Appeal Submitted</dt>
              <dd>{formatDateTime(open.createdAt)}</dd>
            </dl>

            <div className="asg-section-title" style={{ marginTop: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
              Reason Provided
            </div>
            <div className="asg-quote" style={{ marginTop: 4, background: "var(--color-bg)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
              {open.reason}
            </div>

            {open.status !== "pending" && (
              <div className="asg-alert info" style={{ marginTop: 14 }}>
                {open.status === "approved" ? `Extension granted until ${formatDateTime(open.newDeadline)}.` : "This appeal was rejected."}
              </div>
            )}

            {mode === "extend" && (
              <div className="asg-field" style={{ marginTop: 14 }}>
                <label htmlFor="ap-deadline" style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
                  New Extension Deadline
                </label>
                <input id="ap-deadline" type="datetime-local" className="asg-input" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
                <label htmlFor="ap-note" style={{ display: "block", marginTop: "10px", marginBottom: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
                  Message to Student (optional)
                </label>
                <textarea id="ap-note" className="asg-textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <div className="asg-form-actions" style={{ display: "flex", gap: "10px", marginTop: "12px", justifyContent: "flex-end" }}>
                  <Button variant="secondary" size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  <Button size="sm" loading={busy} onClick={giveMoreTime}>Confirm Deadline Extension</Button>
                </div>
              </div>
            )}

            {mode === "reject" && (
              <div className="asg-field" style={{ marginTop: 14 }}>
                <label htmlFor="ap-note2" style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
                  Message to Student (optional)
                </label>
                <textarea id="ap-note2" className="asg-textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <div className="asg-form-actions" style={{ display: "flex", gap: "10px", marginTop: "12px", justifyContent: "flex-end" }}>
                  <Button variant="secondary" size="sm" onClick={() => setMode(null)}>Cancel</Button>
                  <Button variant="danger" size="sm" loading={busy} onClick={reject}>Confirm Rejection</Button>
                </div>
              </div>
            )}

            {!mode && (
              <div className="asg-actions" style={{ marginTop: 20, display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <Button size="sm" loading={busy} disabled={open.read} onClick={markRead}>
                  {open.read ? "Acknowledged" : "Acknowledge"}
                </Button>
                {open.status === "pending" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMode("extend")}>Grant More Time</Button>
                    <Button variant="ghost" size="sm" style={{ color: "#DC2626" }} onClick={() => setMode("reject")}>Reject Appeal</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

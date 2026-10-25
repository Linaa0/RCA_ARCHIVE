import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { EyeIcon } from "../ui/Icons";
import { formatDateTime, errorMessage, AppealBadge, StudentStatusBadge } from "../assignments/common";
import { downloadFrom } from "../assignments/fileUtils";
import "../assignments/assignments.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "overdue", label: "Overdue" },
];

// Assignments the student marked "no appeal needed" disappear until the teacher gives a new one
function isDismissed(a) {
  return Boolean(a.appealDismissed) && !a.appeal;
}

function isAssignmentOverdue(a) {
  const effective = a.effectiveDeadline || a.deadline;
  return new Date() > new Date(effective);
}

function matchesTab(a, tab) {
  const overdue = isAssignmentOverdue(a);
  if (tab === "todo") return !overdue;
  if (tab === "overdue") return overdue;
  return true;
}

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [appealFor, setAppealFor] = useState(null);
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/assignments");
      setAssignments(data.assignments || []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Could not load your assignments."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const openAppeal = (a) => {
    setAppealFor(a);
    setReason("");
    setModalError("");
  };

  const appealWordCount = reason.trim().split(/\s+/).filter(Boolean).length;

  const sendNoAppeal = async (a) => {
    setModalError("");
    setSaving(true);
    try {
      await api.post(`/assignments/${a.id}/no-appeal`);
      setAssignments((prev) => prev.map((item) => (item.id === a.id ? { ...item, appealDismissed: true, canAppeal: false } : item)));
      setAppealFor(null);
      setNotice(`Okay. "${a.title}" will not ask you to appeal.`);
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendAppeal = async (e) => {
    e.preventDefault();
    setModalError("");

    if (appealWordCount < 50 || appealWordCount > 100) {
      return setModalError(`Your appeal reason must be between 50 and 100 words. Currently: ${appealWordCount} word(s).`);
    }

    setSaving(true);
    try {
      await api.post(`/assignments/${appealFor.id}/appeal`, { reason });
      setNotice(`Your appeal for "${appealFor.title}" was sent to ${appealFor.teacherName || "your teacher"}.`);
      setAppealFor(null);
      load();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const shown = assignments.filter((a) => !(isDismissed(a) && isAssignmentOverdue(a)) && matchesTab(a, tab));

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">My work</span>
          <h1 className="asg-title">My assignments</h1>
          <p className="asg-sub">Review your class assignments and deadlines. If you missed a deadline, you can submit an appeal to your teacher.</p>
        </div>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {notice && <div className="asg-alert success">{notice}</div>}

      <div className="asg-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`asg-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="asg-sub">Loading...</p>
      ) : shown.length === 0 ? (
        <div className="asg-panel asg-empty">No assignments here.</div>
      ) : (
        <div className="asg-list">
          {shown.map((a) => {
            const overdue = isAssignmentOverdue(a);
            const statusKey = overdue ? "overdue" : (a.appeal?.status === "approved" ? "extended" : "pending");

            return (
              <div className="asg-card" key={a.id}>
                <div className="asg-card-top">
                  <div>
                    <div className="asg-card-title">{a.title}</div>
                    <div className="asg-meta">
                      {a.subject || "General"} • From {a.teacherName || "your teacher"}
                      <br />
                      Deadline {formatDateTime(a.effectiveDeadline)}
                      {a.appeal?.status === "approved" && <> (extended from {formatDateTime(a.deadline)})</>}
                    </div>
                  </div>
                  <div className="asg-badges">
                    <StudentStatusBadge status={statusKey} />
                    {a.appeal && <AppealBadge status={a.appeal.status} />}
                  </div>
                </div>

                {a.description && <div className="asg-desc">{a.description}</div>}

                {a.hasAttachment && (
                  <div style={{ marginTop: 10, display: "flex", gap: "10px", alignItems: "center" }}>
                    <a
                      href={`/view/${a.id}?type=assignment&name=${encodeURIComponent(a.attachmentName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <Button size="sm" variant="primary">
                        <EyeIcon size={14} /> View
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFrom(`/assignments/${a.id}/attachment`, a.attachmentName).catch(() => setError("Could not download the file."))}
                    >
                      Download {a.attachmentName}
                    </Button>
                  </div>
                )}

                {a.appeal && (
                  <>
                    <div className="asg-quote">
                      <strong>Your appeal:</strong> {a.appeal.reason}
                      {a.appeal.status === "approved" && (
                        <>
                          {"\n"}<strong>Approved.</strong> New deadline: {formatDateTime(a.appeal.newDeadline)}
                        </>
                      )}
                      {a.appeal.status === "rejected" && (
                        <>
                          {"\n"}<strong>Rejected.</strong>
                        </>
                      )}
                      {a.appeal.teacherNote && (
                        <>
                          {"\n"}<strong>Teacher:</strong> {a.appeal.teacherNote}
                        </>
                      )}
                    </div>
                    {a.appeal.teacherHasRead && (
                      <div className="asg-alert success" style={{ marginTop: 10, marginBottom: 0 }}>
                        Your teacher has acknowledged that your appeal has been read.
                      </div>
                    )}
                  </>
                )}

                {overdue && !a.appeal && (
                  <div className="asg-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <Button size="sm" variant="outline" onClick={() => openAppeal(a)}>
                      Appeal to teacher
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => sendNoAppeal(a)}>
                      No appeal
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(appealFor)} onClose={() => setAppealFor(null)} title={`Appeal: ${appealFor?.title || ""}`} maxWidth="540px">
        {appealFor && (
          <form className="asg-form" onSubmit={sendAppeal}>
            {modalError && <div className="asg-alert error">{modalError}</div>}
            <div className="asg-alert info">
              The deadline was {formatDateTime(appealFor.deadline)}. You can send one appeal per assignment.
            </div>
            <div className="asg-field">
              <label htmlFor="appeal-reason">Why did you miss the deadline?</label>
              <textarea
                id="appeal-reason"
                className="asg-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                placeholder="Explain clearly why you missed the deadline (between 50 and 100 words)..."
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "6px",
                  fontSize: "0.8rem",
                  color: appealWordCount >= 50 && appealWordCount <= 100
                    ? "var(--color-primary)"
                    : "var(--color-muted)",
                }}
              >
                <span>Required: 50 to 100 words</span>
                <span style={{ fontWeight: 600 }}>{appealWordCount} / 100 words</span>
              </div>
            </div>
            <div className="asg-form-actions">
              <Button variant="secondary" onClick={() => setAppealFor(null)}>Cancel</Button>
              <Button variant="secondary" loading={saving} onClick={() => sendNoAppeal(appealFor)}>
                No appeal needed, I did the work
              </Button>
              <Button type="submit" loading={saving} disabled={appealWordCount < 50 || appealWordCount > 100}>
                Send appeal
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { formatDateTime, errorMessage, AppealBadge, StudentStatusBadge } from "../assignments/common";
import { downloadFrom } from "../assignments/fileUtils";
import "../assignments/assignments.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "overdue", label: "Overdue" },
  { key: "submitted", label: "Submitted" },
];

function matchesTab(a, tab) {
  if (tab === "todo") return a.status === "pending" || a.status === "extended";
  if (tab === "overdue") return a.status === "overdue";
  if (tab === "submitted") return a.status === "submitted";
  return true;
}

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [submitFor, setSubmitFor] = useState(null);
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState(null);

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

  const openSubmit = (a) => {
    setSubmitFor(a);
    setAnswer("");
    setFile(null);
    setModalError("");
  };

  const openAppeal = (a) => {
    setAppealFor(a);
    setReason("");
    setModalError("");
  };

  const sendSubmission = async (e) => {
    e.preventDefault();
    setModalError("");
    if (!answer.trim() && !file) return setModalError("Write your answer or attach a file.");

    const body = new FormData();
    body.append("text", answer);
    if (file) body.append("file", file);

    setSaving(true);
    try {
      await api.post(`/assignments/${submitFor.id}/submit`, body);
      setNotice(`“${submitFor.title}” submitted.`);
      setSubmitFor(null);
      load();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendAppeal = async (e) => {
    e.preventDefault();
    setModalError("");
    if (reason.trim().length < 10) return setModalError("Please explain your reason (at least 10 characters).");

    setSaving(true);
    try {
      await api.post(`/assignments/${appealFor.id}/appeal`, { reason });
      setNotice(`Your appeal for “${appealFor.title}” was sent to ${appealFor.teacherName || "your teacher"}.`);
      setAppealFor(null);
      load();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const shown = assignments.filter((a) => matchesTab(a, tab));

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">My work</span>
          <h1 className="asg-title">My assignments</h1>
          <p className="asg-sub">Submit before the deadline. If you miss it, you can send an appeal to your teacher.</p>
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
        <p className="asg-sub">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="asg-panel asg-empty">No assignments here.</div>
      ) : (
        <div className="asg-list">
          {shown.map((a) => (
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
                  <StudentStatusBadge status={a.status} />
                  {a.appeal && <AppealBadge status={a.appeal.status} />}
                </div>
              </div>

              {a.description && <div className="asg-desc">{a.description}</div>}

              {a.hasAttachment && (
                <div style={{ marginTop: 10 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFrom(`/assignments/${a.id}/attachment`, a.attachmentName).catch(() => setError("Could not download the file."))}
                  >
                    Download {a.attachmentName}
                  </Button>
                </div>
              )}

              {a.submission && (
                <div className="asg-meta" style={{ marginTop: 10 }}>
                  Submitted {formatDateTime(a.submission.submittedAt)}
                  {a.submission.fileName && <> • {a.submission.fileName}</>}
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

              {(a.canSubmit || a.canAppeal) && (
                <div className="asg-actions">
                  {a.canSubmit && <Button size="sm" onClick={() => openSubmit(a)}>Submit work</Button>}
                  {a.canAppeal && (
                    <Button size="sm" variant="outline" onClick={() => openAppeal(a)}>
                      Appeal to teacher
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(submitFor)} onClose={() => setSubmitFor(null)} title={`Submit: ${submitFor?.title || ""}`} maxWidth="580px">
        {submitFor && (
          <form className="asg-form" onSubmit={sendSubmission}>
            {modalError && <div className="asg-alert error">{modalError}</div>}
            <div className="asg-field">
              <label htmlFor="sub-text">Your answer</label>
              <textarea id="sub-text" className="asg-textarea" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer, a link to your work, or notes for the teacher…" />
            </div>
            <div className="asg-field">
              <label htmlFor="sub-file">Attach a file (optional, max 20 MB)</label>
              <input id="sub-file" type="file" className="asg-input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="asg-form-actions">
              <Button variant="secondary" onClick={() => setSubmitFor(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>Submit</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(appealFor)} onClose={() => setAppealFor(null)} title={`Appeal: ${appealFor?.title || ""}`} maxWidth="540px">
        {appealFor && (
          <form className="asg-form" onSubmit={sendAppeal}>
            {modalError && <div className="asg-alert error">{modalError}</div>}
            <div className="asg-alert info">
              The deadline was {formatDateTime(appealFor.deadline)}. You can send one appeal per assignment.
            </div>
            <div className="asg-field">
              <label htmlFor="appeal-reason">Why did you miss the deadline?</label>
              <textarea id="appeal-reason" className="asg-textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} placeholder="Explain honestly so your teacher can decide…" />
            </div>
            <div className="asg-form-actions">
              <Button variant="secondary" onClick={() => setAppealFor(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>Send appeal</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

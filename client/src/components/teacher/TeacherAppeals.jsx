import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import { formatDateTime, toLocalInput, errorMessage } from "../assignments/common";
import { DEMO_APPEALS } from "./demoData";
import "../assignments/assignments.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

// tells the sidebar to refresh its unread counter
const notifyChanged = () => window.dispatchEvent(new Event("appeals-changed"));

export default function TeacherAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
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
      setIsDemo(items.length === 0);
      setAppeals(items.length ? items : DEMO_APPEALS);
      setError("");
    } catch (err) {
      setAppeals(DEMO_APPEALS);
      setIsDemo(true);
      setError(errorMessage(err, "Could not load appeals."));
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
    if (open.isDemo) {
      setAppeals((current) => current.map((appeal) => (appeal.id === open.id ? { ...appeal, read: true } : appeal)));
      setTab("read");
      return;
    }
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
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">Appeals</span>
          <h1 className="asg-title">Appealed assignments</h1>
          <p className="asg-sub">Students who missed a deadline explain why. Click a name to read the appeal.</p>
        </div>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {isDemo && <div className="asg-alert info">Showing sample teacher data for preview. Acknowledging a sample appeal only changes this preview.</div>}

      <div className="asg-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`asg-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "unread" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      <div className="asg-panel">
        {loading ? (
          <p className="asg-sub">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="asg-empty">No appeals here.</div>
        ) : (
          <div className="th-table-wrap">
            <div className="th-table">
              {shown.map((a) => (
                <button type="button" key={a.id} className={`th-appeal-row ${a.read ? "" : "unread"}`} onClick={() => openAppeal(a)}>
                  <div className="th-cell-title">{a.studentName}</div>
                  <div className="th-cell-time">{a.assignmentTitle}</div>
                  <div><span className="th-chip">{a.classLabel}</span></div>
                  <div className="th-cell-sub">{formatDateTime(a.createdAt)}</div>
                  <div>{a.read ? <Badge variant="neutral" size="sm">Read</Badge> : <Badge variant="warning" size="sm">New</Badge>}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(open)} onClose={() => setOpenId(null)} title="Appeal" maxWidth="560px">
        {open && (
          <div className="asg-modal-scroll">
            {modalError && <div className="asg-alert error">{modalError}</div>}
            {open.isDemo && <div className="asg-alert info">This is sample appeal data. Acknowledgement is simulated and will not notify a real student.</div>}

            <dl className="th-detail">
              <dt>Assignment</dt>
              <dd>{open.assignmentTitle}</dd>
              <dt>Student</dt>
              <dd>{open.studentName}</dd>
              <dt>Class</dt>
              <dd>{open.classLabel}</dd>
              <dt>Deadline was</dt>
              <dd>{formatDateTime(open.originalDeadline)}</dd>
              <dt>Appeal sent</dt>
              <dd>{formatDateTime(open.createdAt)}</dd>
            </dl>

            <div className="asg-section-title" style={{ marginTop: 4 }}>Reason for not doing the assignment</div>
            <div className="asg-quote" style={{ marginTop: 0 }}>{open.reason}</div>

            {open.status !== "pending" && (
              <div className="asg-alert info" style={{ marginTop: 12 }}>
                {open.status === "approved" ? `You gave more time until ${formatDateTime(open.newDeadline)}.` : "You rejected this appeal."}
              </div>
            )}

            {mode === "extend" && (
              <div className="asg-field" style={{ marginTop: 14 }}>
                <label htmlFor="ap-deadline">New deadline</label>
                <input id="ap-deadline" type="datetime-local" className="asg-input" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
                <label htmlFor="ap-note">Message to the student (optional)</label>
                <textarea id="ap-note" className="asg-textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <div className="asg-form-actions">
                  <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
                  <Button loading={busy} onClick={giveMoreTime}>Confirm new deadline</Button>
                </div>
              </div>
            )}

            {mode === "reject" && (
              <div className="asg-field" style={{ marginTop: 14 }}>
                <label htmlFor="ap-note2">Message to the student (optional)</label>
                <textarea id="ap-note2" className="asg-textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <div className="asg-form-actions">
                  <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
                  <Button variant="danger" loading={busy} onClick={reject}>Confirm reject</Button>
                </div>
              </div>
            )}

            {!mode && (
              <div className="asg-actions" style={{ marginTop: 18 }}>
                <Button loading={busy} disabled={open.read} onClick={markRead}>
                  {open.read ? "Acknowledged ✓" : "Acknowledge"}
                </Button>
                {!open.isDemo && open.status === "pending" && (
                  <>
                    <Button variant="outline" onClick={() => setMode("extend")}>Give more time</Button>
                    <Button variant="ghost" style={{ color: "#DC2626" }} onClick={() => setMode("reject")}>Reject</Button>
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

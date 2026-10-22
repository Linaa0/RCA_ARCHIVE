import React, { useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import { DownloadIcon } from "../ui/Icons";
import { formatDateTime, errorMessage } from "../assignments/common";
import { downloadFrom, fetchBlob, saveBlob } from "../assignments/fileUtils";
import { DEMO_SUBMISSION_CLASSES, DEMO_SUBMISSIONS } from "./demoData";
import "../assignments/assignments.css";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export default function TeacherSubmissions() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [selected, setSelected] = useState(null); // { key, label }
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/teacher/submissions/classes")
      .then(({ data }) => {
        const classes = data.classes || [];
        setIsDemo(classes.length === 0);
        setCards(classes.length ? classes : DEMO_SUBMISSION_CLASSES);
      })
      .catch((err) => {
        setCards(DEMO_SUBMISSION_CLASSES);
        setIsDemo(true);
        setError(errorMessage(err, "Could not load submissions."));
      })
      .finally(() => setLoading(false));
  }, []);

  const openClass = async (card) => {
    setSelected(card);
    setRows([]);
    setRowsLoading(true);
    setError("");
    if (card.isDemo) {
      setRows(DEMO_SUBMISSIONS[card.key] || []);
      setRowsLoading(false);
      return;
    }
    try {
      const { data } = await api.get(`/teacher/submissions?class=${encodeURIComponent(card.key)}`);
      setRows(data.submissions || []);
    } catch (err) {
      setError(errorMessage(err, "Could not load this class."));
    } finally {
      setRowsLoading(false);
    }
  };

  const downloadOne = async (row) => {
    try {
      if (row.hasFile) {
        await downloadFrom(`/submissions/${row.id}/file`, row.fileName);
      } else {
        saveBlob(new Blob([row.text || ""], { type: "text/plain" }), `${row.studentName} - ${row.assignmentTitle}.txt`);
      }
    } catch {
      setError("Download failed.");
    }
  };

  const viewSubmission = async (row) => {
    const previewTab = window.open("about:blank", "_blank");
    if (!previewTab) {
      setError("Allow pop-ups to open the submission in a new tab.");
      return;
    }
    previewTab.opener = null;
    previewTab.document.title = row.assignmentTitle;
    previewTab.document.body.textContent = "Opening submission…";

    try {
      if (!row.hasFile) {
        const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(row.assignmentTitle)}</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:900px;margin:48px auto;padding:0 24px;color:#1b2142}h1{font-size:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}</style></head><body><h1>${escapeHtml(row.assignmentTitle)}</h1><pre>${escapeHtml(row.text || "No written response was included.")}</pre></body></html>`;
        previewTab.location.href = URL.createObjectURL(new Blob([page], { type: "text/html" }));
        return;
      }

      const blob = await fetchBlob(`/submissions/${row.id}/file?inline=1`);
      previewTab.location.href = URL.createObjectURL(blob);
    } catch {
      previewTab.close();
      setError("Could not open this submission.");
    }
  };

  const downloadAll = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadFrom(`/teacher/submissions/download-all?class=${encodeURIComponent(selected.key)}`, `${selected.label} submissions.zip`);
    } catch (err) {
      // blob responses hide the JSON error, so use a generic message
      setError(err?.response?.status === 413 ? "Too many files for one download. Download them one by one." : "Could not download all files.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">Submissions</span>
          <h1 className="asg-title">Submissions by class</h1>
          <p className="asg-sub">Select a class to see who handed in their work.</p>
        </div>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {isDemo && <div className="asg-alert info">Showing sample teacher data for preview.</div>}

      {loading ? (
        <p className="asg-sub">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="asg-panel asg-empty">You haven’t given an assignment to a class yet.</div>
      ) : (
        <>
          <div className="th-class-cards">
            {cards.map((c) => (
              <button
                type="button"
                className={`th-class-card ${selected?.key === c.key ? "active" : ""}`}
                key={c.key}
                onClick={() => openClass(c)}
                aria-pressed={selected?.key === c.key}
              >
                <div className="badge-tile">{c.key === "none" ? "?" : c.key.replace("GenAI", "AI")}</div>
                <h3>{c.label} submission</h3>
                <p>
                  {c.submissionCount} submitted • {c.assignmentCount} assignment{c.assignmentCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <section className="asg-panel" style={{ marginTop: 22 }}>
              <div className="asg-header" style={{ marginBottom: 14 }}>
                <div>
                  <h2 className="asg-title" style={{ fontSize: "1.25rem" }}>{selected.label} submissions</h2>
                  <p className="asg-sub">{rowsLoading ? "Loading submissions…" : `${rows.length} submission${rows.length === 1 ? "" : "s"} received`}</p>
                </div>
                <Button icon={<DownloadIcon size={16} />} loading={busy} disabled={rows.length === 0 || selected.isDemo || rowsLoading} onClick={downloadAll}>
                  Download all
                </Button>
              </div>

              {selected.isDemo && <div className="asg-alert info">Showing sample submission data for preview.</div>}
              {rowsLoading ? (
                <p className="asg-sub">Loading…</p>
              ) : rows.length === 0 ? (
                <div className="asg-empty">Nobody in this class has submitted yet.</div>
              ) : (
                rows.map((r) => (
                  <div className="th-sub-row" key={r.id}>
                    <div>
                      <div className="th-cell-title">{r.studentName}</div>
                      <div className="th-cell-sub">{formatDateTime(r.submittedAt)} {r.late && "• late (extended)"}</div>
                    </div>
                    <div>
                      <div className="th-cell-title" style={{ fontWeight: 600 }}>{r.assignmentTitle}</div>
                    </div>
                    <div className="th-row-actions">
                      <Button size="sm" variant="outline" onClick={() => viewSubmission(r)}>View</Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadOne(r)}>Download</Button>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}
        </>
      )}

    </div>
  );
}

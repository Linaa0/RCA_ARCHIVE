import React, { useEffect, useState } from "react";
import api from "../services/api";

function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ViewLink({ to }) {
  return (
    <a href={to} target="_blank" rel="noopener noreferrer" className="view-btn">
      View
    </a>
  );
}

// Teacher notes, teacher past papers and assignments for one subject, whatever the class.
// Assignments stay on the list after their deadline.
export default function SubjectMaterials({ subject }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setData(null);
    setError("");
    api
      .get("/subject-materials", { params: { subject } })
      .then(({ data: body }) => {
        if (isMounted) setData(body);
      })
      .catch(() => {
        if (isMounted) setError("Could not load teacher materials for this subject.");
      });
    return () => {
      isMounted = false;
    };
  }, [subject]);

  if (error) return <p role="alert" style={{ marginTop: 24 }}>{error}</p>;
  if (!data) return null;

  const notes = data.resources.filter((r) => r.kind === "notes");
  const pastPapers = data.resources.filter((r) => r.kind === "past-paper");
  if (!notes.length && !pastPapers.length && !data.assignments.length) return null;

  const resourceCard = (r) => (
    <div key={r.id} className="paper-card">
      <div className="paper-info">
        <strong>{r.title}</strong>
        <span className="paper-meta">
          {r.kind === "past-paper" ? "Past Paper" : "Notes"}
          {r.year ? ` • ${r.year}` : ""} • Uploaded by {r.teacherName || "a teacher"} • {new Date(r.uploadedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="paper-actions">
        <ViewLink to={`/view/${r.id}?type=resource&name=${encodeURIComponent(r.originalName || r.title)}`} />
      </div>
    </div>
  );

  return (
    <div className="results" style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 8 }}>Teacher materials for {data.subject}</h3>

      {notes.length > 0 && (
        <>
          <h4>Notes ({notes.length})</h4>
          {notes.map(resourceCard)}
        </>
      )}

      {pastPapers.length > 0 && (
        <>
          <h4>Past papers from teachers ({pastPapers.length})</h4>
          {pastPapers.map(resourceCard)}
        </>
      )}

      {data.assignments.length > 0 && (
        <>
          <h4>Assignments ({data.assignments.length})</h4>
          {data.assignments.map((a) => (
            <div key={a.id} className="paper-card">
              <div className="paper-info">
                <strong>{a.title}</strong>
                <span className="paper-meta">
                  Given to: {a.givenTo.length ? a.givenTo.join(", ") : "N/A"}
                </span>
                <span className="paper-meta">
                  By {a.teacherName || "a teacher"} • Given {formatDate(a.givenAt)} • Deadline {formatDate(a.deadline)}
                  {a.isPastDeadline ? " (deadline passed)" : ""}
                </span>
              </div>
              <div className="paper-actions">
                {a.canOpenFile && (
                  <ViewLink to={`/view/${a.id}?type=assignment&name=${encodeURIComponent(a.attachmentName || "attachment")}`} />
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

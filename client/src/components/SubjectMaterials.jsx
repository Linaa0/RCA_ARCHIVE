import React, { useEffect, useState } from "react";
import api from "../services/api";
import { TermBadge, TermMenu } from "./ui";
import { getStoredUser } from "../utils/auth";

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
// Grouped into sections: Term 1, Term 2, Term 3, and Term not set (when present).
export default function SubjectMaterials({ subject }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const user = getStoredUser();
  const canEditResource = (r) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "teacher") {
      return !r.teacherId || String(r.teacherId) === String(user.id);
    }
    return false;
  };

  const loadMaterials = (isMounted = true) => {
    api
      .get("/subject-materials", { params: { subject } })
      .then(({ data: body }) => {
        if (isMounted) setData(body);
      })
      .catch(() => {
        if (isMounted) setError("Could not load teacher materials for this subject.");
      });
  };

  useEffect(() => {
    let isMounted = true;
    setData(null);
    setError("");
    loadMaterials(isMounted);
    return () => {
      isMounted = false;
    };
  }, [subject]);

  if (error) return <p role="alert" style={{ marginTop: 24 }}>{error}</p>;
  if (!data) return null;

  const resources = data.resources || [];
  const assignments = data.assignments || [];

  if (!resources.length && !assignments.length) return null;

  const handleResourceTermChanged = (resourceId, newTerm) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        resources: (prev.resources || []).map((r) =>
          r.id === resourceId ? { ...r, term: newTerm } : r
        ),
      };
    });
  };

  const terms = [
    { key: 1, label: "Term 1" },
    { key: 2, label: "Term 2" },
    { key: 3, label: "Term 3" },
    { key: "unset", label: "Term not set" },
  ];

  const itemsByTerm = {
    1: { resources: [], assignments: [] },
    2: { resources: [], assignments: [] },
    3: { resources: [], assignments: [] },
    unset: { resources: [], assignments: [] },
  };

  resources.forEach((r) => {
    const termKey = [1, 2, 3].includes(r.term) ? r.term : "unset";
    itemsByTerm[termKey].resources.push(r);
  });

  assignments.forEach((a) => {
    const termKey = [1, 2, 3].includes(a.term) ? a.term : "unset";
    itemsByTerm[termKey].assignments.push(a);
  });

  const resourceCard = (r) => (
    <div key={r.id} className="paper-card">
      <div className="paper-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          <strong>{r.title}</strong>
          <TermBadge term={r.term} size="sm" />
        </div>
        <span className="paper-meta">
          {r.kind === "past-paper" ? "Past Paper" : "Notes"}
          {r.year ? ` • ${r.year}` : ""} • Uploaded by {r.teacherName || "a teacher"} • {new Date(r.uploadedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="paper-actions">
        {canEditResource(r) && (
          <TermMenu
            item={r}
            type="resource"
            onTermChanged={(newTerm) => handleResourceTermChanged(r.id, newTerm)}
          />
        )}
        <ViewLink to={`/view/${r.id}?type=resource&name=${encodeURIComponent(r.originalName || r.title)}`} />
      </div>
    </div>
  );

  const assignmentCard = (a) => (
    <div key={a.id} className="paper-card">
      <div className="paper-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          <strong>{a.title}</strong>
          <TermBadge term={a.term} size="sm" />
        </div>
        <span className="paper-meta">
          Given to: {a.givenTo && a.givenTo.length ? a.givenTo.join(", ") : "N/A"}
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
  );

  return (
    <div className="results" style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 16 }}>Teacher materials for {data.subject}</h3>

      {terms.map((t) => {
        const group = itemsByTerm[t.key];
        const totalInTerm = group.resources.length + group.assignments.length;
        if (t.key === "unset" && totalInTerm === 0) return null;

        const notes = group.resources.filter((r) => r.kind === "notes");
        const pastPapers = group.resources.filter((r) => r.kind === "past-paper");

        return (
          <div key={t.key} className="term-materials-section" style={{ marginBottom: 24 }}>
            <h4 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: 12 }}>
              <span>{t.label}</span>
              <span className="term-section-count" style={{ fontSize: "0.82rem", opacity: 0.8 }}>
                ({totalInTerm} {totalInTerm === 1 ? "item" : "items"})
              </span>
            </h4>

            {totalInTerm === 0 ? (
              <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", fontStyle: "italic", margin: "8px 0 16px" }}>
                No teacher materials for {t.label}.
              </p>
            ) : (
              <>
                {notes.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                      Notes ({notes.length})
                    </div>
                    {notes.map(resourceCard)}
                  </div>
                )}

                {pastPapers.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                      Past papers from teachers ({pastPapers.length})
                    </div>
                    {pastPapers.map(resourceCard)}
                  </div>
                )}

                {group.assignments.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                      Assignments ({group.assignments.length})
                    </div>
                    {group.assignments.map(assignmentCard)}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

import React from "react";
import { formatDateTime } from "./common";
import { TermBadge } from "../ui";

function timeLeft(deadline) {
  const ms = new Date(deadline) - new Date();
  if (ms <= 0) return { text: "Deadline passed", cls: "past" };
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return { text: `${days} day${days > 1 ? "s" : ""} left`, cls: days <= 2 ? "soon" : "" };
  if (hours >= 1) return { text: `${hours}h left`, cls: "soon" };
  return { text: `${Math.max(mins, 1)} min left`, cls: "soon" };
}

// "Given to": classes first, then individual students
export function Recipients({ classLabels = [], students = [] }) {
  if (classLabels.length === 0 && students.length === 0) return <span className="th-cell-sub">N/A</span>;
  return (
    <div className="th-chips">
      {classLabels.map((c) => (
        <span key={c} className="th-chip">{c}</span>
      ))}
      {students.map((s) => (
        <span key={s.id} className="th-chip student" title="Individual student">{s.name}</span>
      ))}
    </div>
  );
}

// Columns: name | given to (classes + individual students) | time given | deadline [| actions]
export default function AssignmentTable({ rows, renderActions, emptyText = "Nothing to show." }) {
  const withActions = typeof renderActions === "function";
  if (rows.length === 0) return <div className="asg-empty">{emptyText}</div>;

  return (
    <div className="th-table-wrap">
      <div className="th-table">
        <div className={`th-tr th-th ${withActions ? "with-actions" : ""}`}>
          <div>Assignment</div>
          <div>Given to</div>
          <div>Time given</div>
          <div>Deadline</div>
          {withActions && <div>Actions</div>}
        </div>
        {rows.map((a) => {
          const left = timeLeft(a.deadline);
          return (
            <div className={`th-tr ${withActions ? "with-actions" : ""}`} key={a.id}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                  <span className="th-cell-title">{a.title}</span>
                  <TermBadge term={a.term} size="sm" />
                </div>
                {a.subject && <div className="th-cell-sub">{a.subject}</div>}
              </div>
              <Recipients classLabels={a.classLabels} students={a.students} />
              <div className="th-cell-time">{formatDateTime(a.givenAt || a.createdAt)}</div>
              <div>
                <div className="th-cell-time">{formatDateTime(a.deadline)}</div>
                <span className={`th-left ${left.cls}`}>{left.text}</span>
              </div>
              {withActions && <div className="th-row-actions">{renderActions(a)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatDateTime, StudentStatusBadge } from "../assignments/common";
import "../assignments/assignments.css";

// Small summary shown at the top of the student dashboard
export default function StudentAssignmentsWidget() {
  const [items, setItems] = useState(null);

  // "No appeal": the work was done, so the notice goes away until a new assignment is given
  const dismissAppeal = async (assignment) => {
    try {
      await api.post(`/assignments/${assignment.id}/no-appeal`);
      setItems((prev) => (prev || []).map((a) => (a.id === assignment.id ? { ...a, appealDismissed: true } : a)));
    } catch (_) {}
  };

  useEffect(() => {
    api
      .get("/assignments")
      .then(({ data }) => setItems(data.assignments || []))
      .catch(() => setItems([]));
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        api
          .get("/assignments")
          .then(({ data }) => setItems(data.assignments || []))
          .catch(() => setItems([]));
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  if (!items) return null;

  const todo = items.filter((a) => a.status === "pending" || a.status === "extended");
  const overdue = items.filter((a) => a.status === "overdue" && !a.appeal && !a.appealDismissed);
  const acknowledgedAppeals = items.filter((a) => a.appeal?.teacherHasRead).length;
  const nextUp = [...todo].sort((a, b) => new Date(a.effectiveDeadline) - new Date(b.effectiveDeadline)).slice(0, 3);

  return (
    <div className="asg-panel" style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ marginBottom: 0 }}>My assignments</h3>
        <Link to="/student/assignments" style={{ color: "var(--color-indigo-500, #174F83)", fontWeight: 700, fontSize: "0.88rem" }}>
          Open all →
        </Link>
      </div>

      {overdue.length > 0 && (
        <div className="asg-alert info" style={{ marginTop: 14, marginBottom: 0 }}>
          <div>
            You have {overdue.length} overdue assignment{overdue.length > 1 ? "s" : ""}. You can appeal to the teacher from “My Assignments”, or choose “No appeal” if you already did the work.
          </div>
          {overdue.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <strong>{a.title}</strong>
              <span style={{ display: "flex", gap: 8 }}>
                <Link to="/student/assignments" style={{ fontWeight: 700 }}>Appeal</Link>
                <button
                  type="button"
                  onClick={() => dismissAppeal(a)}
                  style={{ border: "1px solid currentColor", background: "transparent", color: "inherit", borderRadius: 999, padding: "2px 12px", fontWeight: 700, cursor: "pointer" }}
                >
                  No appeal
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {acknowledgedAppeals > 0 && (
        <div className="asg-alert success" style={{ marginTop: 14, marginBottom: 0 }}>
          Your teacher has acknowledged {acknowledgedAppeals === 1 ? "your appeal" : `${acknowledgedAppeals} of your appeals`}.
        </div>
      )}

      {nextUp.length === 0 ? (
        <div className="asg-meta" style={{ marginTop: 12 }}>Nothing due. You are all caught up.</div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {nextUp.map((a) => (
            <div className="asg-row" key={a.id}>
              <div>
                <div className="asg-row-title">{a.title}</div>
                <div className="asg-meta">Due {formatDateTime(a.effectiveDeadline)}</div>
              </div>
              <StudentStatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

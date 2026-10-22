import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatDateTime, StudentStatusBadge } from "../assignments/common";
import "../assignments/assignments.css";

// Small summary shown at the top of the student dashboard
export default function StudentAssignmentsWidget() {
  const [items, setItems] = useState(null);

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
  const overdue = items.filter((a) => a.status === "overdue" && !a.appeal);
  const acknowledgedAppeals = items.filter((a) => a.appeal?.teacherHasRead).length;
  const nextUp = [...todo].sort((a, b) => new Date(a.effectiveDeadline) - new Date(b.effectiveDeadline)).slice(0, 3);

  return (
    <div className="asg-panel" style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ marginBottom: 0 }}>My assignments</h3>
        <Link to="/student/assignments" style={{ color: "#3F4FA8", fontWeight: 700, fontSize: "0.88rem" }}>
          Open all →
        </Link>
      </div>

      {overdue.length > 0 && (
        <div className="asg-alert info" style={{ marginTop: 14, marginBottom: 0 }}>
          You have {overdue.length} overdue assignment{overdue.length > 1 ? "s" : ""}. You can appeal to the teacher from “My Assignments”.
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

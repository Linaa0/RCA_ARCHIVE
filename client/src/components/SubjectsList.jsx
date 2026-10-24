import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./SubjectsList.css";
import api from "../services/api";
import WaterDecoration from "./ui/WaterDecoration";

function getSubjectIcon() {
  return {
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  };
}

function SubjectCard({ promotionId, subject, assignmentChip }) {
  const [count, setCount] = useState(null);
  const iconMeta = getSubjectIcon();

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/papers?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(promotionId)}`)
      .then(({ data }) => {
        if (!cancelled) setCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [subject, promotionId]);

  return (
    <Link to={`/subject/${encodeURIComponent(promotionId)}/${encodeURIComponent(subject)}`} className="subject-card" style={{ position: "relative" }}>
      <WaterDecoration variant="stat" />
      <div className="subject-card-top" style={{ position: "relative", zIndex: 1 }}>
        <div className="subject-icon">
          {iconMeta.svg}
        </div>
        <h3>{subject}</h3>
      </div>
      {assignmentChip && (
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "inline-block",
            fontSize: "0.72rem",
            fontWeight: 700,
            background: "rgba(239, 68, 68, 0.12)",
            color: "var(--color-danger, #EF4444)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "2px 8px",
            borderRadius: "999px",
            marginBottom: "8px",
            width: "fit-content",
          }}
        >
          {assignmentChip}
        </span>
      )}
      <p style={{ position: "relative", zIndex: 1 }}>{count === null ? "0 file(s)" : `${count} file(s)`}</p>
      <div className="subject-card-footer" style={{ position: "relative", zIndex: 1 }}>
        <span className="subject-link-text">Past Papers and Notes</span>
        <span className="subject-arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function SubjectsList({ subjects = [], activePromotion, activeYear }) {
  const promoId = typeof activePromotion === "object" ? activePromotion?.id : activePromotion || (activeYear ? `Y${activeYear}` : "Y1");
  const promoLabel = typeof activePromotion === "object" ? activePromotion?.label : (activePromotion === "Y1GenAI" ? "Year 1 GenAI" : (activeYear ? `Year ${activeYear}` : activePromotion || "Curriculum"));

  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    let active = true;
    api.get("/assignments")
      .then(({ data }) => {
        if (active) {
          setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const getChipForSubject = (subj) => {
    const sName = (subj || "").toLowerCase();
    const match = assignments.find((a) => {
      const aSubj = (a.subject || "").toLowerCase();
      const notExpired = new Date(a.deadline) > new Date();
      return aSubj === sName && notExpired;
    });
    if (!match) return null;
    const target = (match.classes && match.classes[0]) || match.targetClass || "Active";
    const d = new Date(match.deadline);
    const month = d.toLocaleString("default", { month: "short" });
    return `${target}, due ${d.getDate()} ${month}`;
  };

  return (
    <div className="subjects-wrapper-grid-only" id="subjects">
      <div className="subjects-section-header">
        <div>
          <h2 className="subjects-section-title">{promoLabel} Subjects</h2>
          <p className="subjects-section-sub">Browse and access accredited subjects for {promoLabel}</p>
        </div>
        <a href="#subjects" className="view-all-link">
          View all subjects
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
      </div>

      <div className="subjects-grid">
        {subjects.map((subject, index) => (
          <SubjectCard
            key={`${promoId}-${index}`}
            promotionId={promoId}
            subject={subject}
            assignmentChip={getChipForSubject(subject)}
          />
        ))}
      </div>
    </div>
  );
}

export default SubjectsList;
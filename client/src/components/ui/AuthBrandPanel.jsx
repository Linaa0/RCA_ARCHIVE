import React, { useState, useEffect, useRef } from "react";
import Logo from "./Logo";
import { MaterialsIcon, EyeIcon, ShieldIcon } from "./Icons";
import "./AuthBrandPanel.css";

const RESOURCE_CARDS = [
  {
    id: 1,
    cohort: "Y1A",
    subject: "Fundamentals of Programming",
    title: "CAT 1 Past Examination Paper",
    type: "Past Paper",
    format: "PDF Document (12 pages)",
  },
  {
    id: 2,
    cohort: "Y1GenAI",
    subject: "Introduction to Artificial Intelligence",
    title: "Core Concepts and Algorithms Notes",
    type: "Notes",
    format: "Lecture Slides (34 slides)",
  },
  {
    id: 3,
    cohort: "Y2B",
    subject: "Data Structures with C++",
    title: "Binary Search Trees and Graphs Lab",
    type: "Assignment",
    format: "Problem Sheet (4 tasks)",
  },
  {
    id: 4,
    cohort: "Y2C",
    subject: "Software Engineering",
    title: "Agile Development and Architecture",
    type: "Notes",
    format: "PDF Document (18 pages)",
  },
  {
    id: 5,
    cohort: "Y3A",
    subject: "Embedded Systems and Hardware",
    title: "Microcontroller Interfacing Paper",
    type: "Past Paper",
    format: "Final Exam (8 pages)",
  },
  {
    id: 6,
    cohort: "Y3C",
    subject: "Mobile Application Development",
    title: "Cross Platform State Management",
    type: "Assignment",
    format: "Project Specification",
  },
];

export default function AuthBrandPanel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isHovered) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % RESOURCE_CARDS.length);
    }, 4000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  const activeCard = RESOURCE_CARDS[currentIndex];
  const nextCard = RESOURCE_CARDS[(currentIndex + 1) % RESOURCE_CARDS.length];
  const thirdCard = RESOURCE_CARDS[(currentIndex + 2) % RESOURCE_CARDS.length];

  return (
    <section className="auth-brand-pane">
      {/* ── RCA Shield Logo: 96px, knockout white, NO container box ── */}
      <header className="auth-brand-header">
        <Logo variant="knockout" size="auth" wordmarkColor="#FFFFFF" />
      </header>

      {/* ── Center Content ── */}
      <div className="auth-brand-center">
        <div className="auth-headline-box">
          <span className="auth-kicker">Academic Archive Portal</span>
          <h1 className="auth-headline-title">
            Rwanda Coding Academy Past Papers and Materials
          </h1>
          <p className="auth-headline-sub">
            Centralized academic repository providing direct access to lecture notes, past exams, and assignments across all cohorts.
          </p>
        </div>

        {/* ── Rotating Resource Stack Deck (Pause on Hover) ── */}
        <div
          className="auth-stack-container"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Card 3 (furthest back peek: shifted up and right, scale 0.90, opacity 0.82) */}
          <div className="auth-deck-card card-layer-3" key={`preview-3-${thirdCard.id}`}>
            <div className="auth-deck-card-inner">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="auth-card-pill">{thirdCard.cohort}</span>
                <span className="auth-card-type-tag">{thirdCard.type}</span>
              </div>
              <span className="auth-card-preview-title">{thirdCard.subject}</span>
            </div>
          </div>

          {/* Card 2 (middle peek: shifted up and right, scale 0.95, opacity 0.92) */}
          <div className="auth-deck-card card-layer-2" key={`preview-2-${nextCard.id}`}>
            <div className="auth-deck-card-inner">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="auth-card-pill">{nextCard.cohort}</span>
                  <span className="auth-card-type-tag">{nextCard.type}</span>
                </div>
                <span className="auth-card-format">{nextCard.format}</span>
              </div>
              <span className="auth-card-preview-title">{nextCard.title}</span>
            </div>
          </div>

          {/* Card 1 (Front active card: fully visible, light card, dark text) */}
          <div className="auth-deck-card auth-card-front" key={`active-${activeCard.id}`}>
            <div className="auth-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="auth-card-pill active-pill">{activeCard.cohort}</span>
                <span className="auth-card-type-tag">{activeCard.type}</span>
              </div>
              <span className="auth-card-format">{activeCard.format}</span>
            </div>

            <div className="auth-card-body">
              <span className="auth-card-subject">{activeCard.subject}</span>
              <h3 className="auth-card-title">{activeCard.title}</h3>
            </div>
          </div>

          {/* ── Progress Dots ── */}
          <div className="auth-stack-dots">
            {RESOURCE_CARDS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`auth-stack-dot ${idx === currentIndex ? "active" : ""}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Jump to sample resource card ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Trust Points ── */}
      <footer className="auth-trust-strip">
        <div className="auth-trust-chip">
          <EyeIcon size={14} />
          <span>In-browser PDF, document, and code previews</span>
        </div>
        <div className="auth-trust-chip">
          <MaterialsIcon size={14} />
          <span>Organized by cohorts Y1A to Y3C</span>
        </div>
        <div className="auth-trust-chip">
          <ShieldIcon size={14} />
          <span>Official Rwanda Coding Academy credentials</span>
        </div>
      </footer>
    </section>
  );
}

import React, { useState, useEffect } from "react";
import Logo from "./Logo";
import { CheckIcon, EyeIcon, MaterialsIcon, ShieldIcon } from "./Icons";

const HEADLINES = [
  {
    title: "Official RCA Past Papers & Solutions.",
    sub: "Direct access to examination archives, CATs, and verified marking schemes across all terms.",
  },
  {
    title: "Campus Archive Shelf for All Cohorts.",
    sub: "Curriculum-aligned resources structured specifically for Year 1, Year 2, and Year 3 classes.",
  },
  {
    title: "Instant In-Browser Study Previews.",
    sub: "View PDF question papers, lecture slides, and notes on any device without waiting for downloads.",
  },
];

export default function AuthBrandPanel() {
  const [headlineIndex, setHeadlineIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeHeadline = HEADLINES[headlineIndex];

  return (
    <section className="auth-brand-pane">
      {/* Knockout Logo */}
      <div className="auth-brand-header">
        <Logo variant="knockout" size="md" wordmarkColor="#FFFFFF" />
      </div>

      {/* Rotating Headline */}
      <div className="auth-brand-center">
        <div className="auth-headline-box" key={headlineIndex}>
          <span className="auth-kicker">Knowledge Repository</span>
          <h2 className="auth-headline-title">{activeHeadline.title}</h2>
          <p className="auth-headline-sub">{activeHeadline.sub}</p>
        </div>

        {/* Animated Showcase: Stack of Floating Document Shelf Cards */}
        <div className="auth-showcase-stack">
          {/* Background Card 3 */}
          <div className="showcase-card showcase-card-back">
            <span className="doc-pill">Y3 AI</span>
            <span className="doc-name">Machine Learning Exam 2024</span>
          </div>

          {/* Middle Card 2 */}
          <div className="showcase-card showcase-card-mid">
            <span className="doc-pill">Y2 DSA</span>
            <span className="doc-name">Data Structures Final Paper</span>
          </div>

          {/* Front Active Card 1 */}
          <div className="showcase-card showcase-card-front">
            <div className="card-tab-edge" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span className="doc-pill-primary">Y1 DEV</span>
              <span style={{ fontSize: "0.72rem", color: "#6A7399", fontWeight: 600 }}>PDF Document</span>
            </div>
            <strong style={{ fontSize: "0.92rem", color: "#1B2142", display: "block" }}>
              Fundamentals of Programming CAT 1
            </strong>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "0.75rem", color: "#10B981", fontWeight: 600 }}>
              <CheckIcon size={12} /> Verified Answer Scheme
            </div>
          </div>
        </div>
      </div>

      {/* 3 Honest Trust Chips */}
      <div className="auth-trust-strip">
        <div className="auth-trust-chip">
          <EyeIcon size={14} />
          <span>In-browser PDF, DOCX, & PPTX viewer</span>
        </div>
        <div className="auth-trust-chip">
          <MaterialsIcon size={14} />
          <span>Organized by cohorts Y1A to Y3C</span>
        </div>
        <div className="auth-trust-chip">
          <ShieldIcon size={14} />
          <span>Official RCA authentication</span>
        </div>
      </div>
    </section>
  );
}

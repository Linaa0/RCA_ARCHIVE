import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRightIcon as ArrowRight } from "./ui/Icons";
import "./Landing.css";
import Logo from "./ui/Logo";
import Button from "./ui/Button";
import heroAcademicIllustration from "../assets/figures/hero-academic-illustration.webp";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing-root" data-theme="light">
      <nav className="landing-navbar">
        <div className="landing-navbar-container">
          <Link to="/" className="landing-navbar-logo">
            <Logo variant="full" size={36} logoSrc="/rca-logo.png" />
          </Link>

          <div className="landing-navbar-actions">
            <Button
              variant="outline"
              size="md"
              className="landing-sign-in"
              style={{ color: "#1f427d", border: "1px solid #d8deea", boxShadow: "0 2px 5px rgba(24, 40, 78, 0.06)" }}
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="md"
              className="landing-get-started"
              style={{ background: "#1f427d", boxShadow: "0 6px 14px rgba(22, 48, 92, 0.22)" }}
              onClick={() => navigate("/signup")}
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* ====================================================================
          2. HERO SECTION
          Left: Headline, supporting text, 2 CTAs, pill search
          Right: Circular masked visual overlapping bigger pale circle with dots
          ==================================================================== */}
      <header className="landing-hero-section">
        <div className="landing-hero-container">
          {/* Left Column */}
          <div className="landing-hero-left">
            <div className="hero-kicker-pill">
              <span className="hero-kicker-dot" />
              <span>Official Rwanda Coding Academy Portal</span>
            </div>

            <h1 className="hero-title">
              Past papers, assignments and revision notes for RCA students.
            </h1>

            <p className="hero-subtitle">
              The dedicated academic portal for Rwanda Coding Academy students and faculty.
              Search past papers, view comprehensive course notes, and manage class assignments across all terms.
            </p>

            <div className="hero-cta-group">
              <Button
                variant="primary"
                size="lg"
                className="landing-hero-primary"
                iconRight={<ArrowRight size={18} />}
                style={{ background: "#1f427d", boxShadow: "0 6px 14px rgba(22, 48, 92, 0.22)" }}
                onClick={() => navigate("/signup")}
              >
                Access Past Papers
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="landing-hero-secondary"
                style={{ color: "#1f427d", border: "1px solid #d8deea", boxShadow: "0 2px 5px rgba(24, 40, 78, 0.06)" }}
                onClick={() => navigate("/login")}
              >
                Sign In to Archive
              </Button>
            </div>
          </div>

          <div className="landing-hero-right">
            <div className="hero-pale-circle" />

            <div className="hero-decor-dot dot-1" />
            <div className="hero-decor-dot dot-2" />
            <div className="hero-decor-dot dot-3" />
            <div className="hero-decor-dot dot-4" />

            <div className="hero-illustration">
              <img src={heroAcademicIllustration} alt="" fetchPriority="high" decoding="async" />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
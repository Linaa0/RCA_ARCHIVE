import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Landing.css";
import Logo from "./ui/Logo";
import ClassChips, { RCA_CLASSES } from "./ui/ClassChips";
import StatRing from "./ui/StatRing";
import Button from "./ui/Button";
import {
  SearchIcon,
  LessonsIcon,
  MaterialsIcon,
  CalendarIcon,
  StarIcon,
  DownloadIcon,
  EyeIcon,
  UploadIcon,
  CheckIcon,
  UsersIcon,
  UserIcon,
  ShieldIcon,
  ArrowRightIcon,
  MenuIcon,
  CloseIcon,
} from "./ui/Icons";
import api from "../services/api";

const SUBJECTS_BY_YEAR = {
  1: [
    "Fundamentals of Programming",
    "Mathematics I",
    "Database Management",
    "Networking Essentials",
    "Web User Interface",
    "Physics & Mechanics",
    "Embedded Systems",
    "JavaScript Core",
    "Communication & English",
  ],
  2: [
    "Data Structures & Algorithms (C++)",
    "OOP & Web Development (Java)",
    "Software Engineering Principles",
    "Advanced Database Systems",
    "Enterprise Networking",
    "Web3 & Smart Contracts",
    "3D Modelling & Computer Graphics",
    "Discrete Mathematics",
  ],
  3: [
    "Machine Learning & AI (Python)",
    "Cybersecurity & Threat Defense",
    "DevOps & Infrastructure Automation",
    "Intelligent Robotics Systems",
    "Mobile Applications (React Native)",
    "IT Project Management",
    "Microcontroller Architecture",
  ],
};

const MARQUEE_SUBJECTS = [
  "Data Structures & C++",
  "OOP & Java",
  "Machine Learning",
  "DevOps & CI/CD",
  "Cybersecurity",
  "Web3 & Solidity",
  "Embedded Systems",
  "Database Systems",
  "Mobile Apps",
  "Computer Networks",
  "Software Engineering",
  "Mathematics",
];

export default function Landing() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("Y2A");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realStats, setRealStats] = useState({
    papers: 0,
    users: 0,
    subjects: 34,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Fetch real statistics from API
  useEffect(() => {
    let isMounted = true;
    api
      .get("/stats")
      .then(({ data }) => {
        if (!isMounted) return;
        const totalPapers = Number(data?.totalPapers ?? 0);
        const totalUsers = Number(data?.totalUsers ?? 0);
        setRealStats({
          papers: totalPapers,
          users: totalUsers,
          subjects: 34,
        });
        setStatsLoaded(true);
      })
      .catch(() => {
        // Fallback to papers list count
        api
          .get("/papers?limit=100")
          .then(({ data }) => {
            if (!isMounted) return;
            const count = Array.isArray(data) ? data.length : 0;
            setRealStats((prev) => ({ ...prev, papers: count }));
            setStatsLoaded(true);
          })
          .catch(() => {
            setStatsLoaded(false);
          });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/login?redirect=/home&search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate("/login");
    }
  };

  const currentClassObj = RCA_CLASSES.find((c) => c.id === selectedClassId) || RCA_CLASSES[4];
  const classSubjects = SUBJECTS_BY_YEAR[currentClassObj.year] || SUBJECTS_BY_YEAR[2];

  return (
    <div className="landing-page-root">
      {/* ── Sticky Glass Navbar ── */}
      <nav className="landing-nav-glass">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <Logo variant="light" size="sm" showWordmark wordmarkColor="#1B2142" />
          </div>

          {/* Desktop Nav Links with Animated Underline */}
          <div className="landing-nav-links">
            <a href="#shelf" className="landing-nav-link">Class Shelf</a>
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">Workflow</a>
            <a href="#roles" className="landing-nav-link">Roles</a>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="nav-btn-signin"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className="nav-btn-getstarted"
              onClick={() => navigate("/signup")}
            >
              Get Started
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="nav-mobile-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <a href="#shelf" onClick={() => setMobileMenuOpen(false)}>Class Shelf</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Workflow</a>
            <a href="#roles" onClick={() => setMobileMenuOpen(false)}>Roles</a>
            <div className="mobile-nav-drawer-actions">
              <Button variant="secondary" onClick={() => navigate("/login")}>
                Sign In
              </Button>
              <Button variant="primary" onClick={() => navigate("/signup")}>
                Get Started
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section with Animated Gradient Mesh ── */}
      <section className="landing-hero-section">
        <div className="landing-hero-container">
          {/* Left Column: Bold Headline & Search */}
          <div className="landing-hero-left">
            <div className="hero-kicker-pill">
              <span className="hero-kicker-dot" />
              <span>Official Rwanda Coding Academy Portal</span>
            </div>

            <h1 className="hero-title">
              Past Papers, Exams & Notes for Future Tech Leaders.
            </h1>

            <p className="hero-subtitle">
              The dedicated curriculum archive for RCA students and educators.
              Instantly preview, search, and download exam schemes, CATs, and lecture notes
              across all terms and cohorts.
            </p>

            <div className="hero-cta-row">
              <Button
                variant="primary"
                size="lg"
                iconRight={<ArrowRightIcon size={18} />}
                onClick={() => navigate("/signup")}
              >
                Access Past Papers
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/login")}
              >
                Sign In to Archive
              </Button>
            </div>

            {/* Pill Search */}
            <form className="hero-pill-search" onSubmit={handleHeroSearch}>
              <SearchIcon size={18} className="hero-search-icon" />
              <input
                type="text"
                placeholder="Search by topic, subject or year (e.g. Data Structures)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="hero-search-button">
                Search
              </button>
            </form>
          </div>

          {/* Right Column: Layered Product Mockup with Safe Clearances & Rendered Bars */}
          <div className="landing-hero-right">
            {/* Safe Orbiting Chip Left: Clear 20px outside mockup frame */}
            <div className="hero-orbit-chip chip-preview">
              <div className="orbit-chip-icon" style={{ background: "#5B73E0" }}>
                <EyeIcon size={16} />
              </div>
              <div>
                <strong className="orbit-chip-title">Browser PDF Preview</strong>
                <span className="orbit-chip-sub">Direct in-browser reading</span>
              </div>
            </div>

            {/* Safe Orbiting Chip Right: Clear 20px outside mockup frame */}
            <div className="hero-orbit-chip chip-curriculum">
              <div className="orbit-chip-icon" style={{ background: "#10B981" }}>
                <MaterialsIcon size={16} />
              </div>
              <div>
                <strong className="orbit-chip-title">Curriculum Aligned</strong>
                <span className="orbit-chip-sub">Year 1, 2 & 3 modules</span>
              </div>
            </div>

            {/* Main Mockup Frame */}
            <div className="hero-product-frame">
              {/* Mockup Sidebar */}
              <div className="mockup-sidebar">
                <div className="mockup-sidebar-logo">
                  <Logo variant="knockout" size="xs" showWordmark={false} />
                  <span>RCA Archive</span>
                </div>
                <div className="mockup-nav-item active">
                  <LessonsIcon size={16} />
                  <span>Dashboard</span>
                </div>
                <div className="mockup-nav-item">
                  <MaterialsIcon size={16} />
                  <span>Past Papers</span>
                </div>
                <div className="mockup-nav-item">
                  <CalendarIcon size={16} />
                  <span>Subjects</span>
                </div>
              </div>

              {/* Mockup Canvas */}
              <div className="mockup-canvas">
                <div className="mockup-canvas-header">
                  <div>
                    <span className="mockup-welcome">Academic Portal</span>
                    <strong className="mockup-name">Student Dashboard</strong>
                  </div>
                  <span className="mockup-pill-badge">Term Active</span>
                </div>

                {/* Rendered Bar Chart with explicit heights and two-tone fills */}
                <div className="mockup-chart-card">
                  <div className="mockup-chart-header">
                    <div>
                      <span className="mockup-stat-label">Archive by Module</span>
                      <strong className="mockup-stat-num">Curriculum Coverage</strong>
                    </div>
                    <span className="mockup-filter-pill">All Streams ▾</span>
                  </div>

                  <div className="mockup-bar-chart-container">
                    <div className="mockup-bar-item">
                      <div className="mockup-bar-pillar" style={{ height: "72px" }} />
                      <span className="mockup-bar-label">DSA</span>
                    </div>
                    <div className="mockup-bar-item">
                      <div className="mockup-bar-pillar" style={{ height: "94px" }} />
                      <span className="mockup-bar-label">OOP</span>
                    </div>
                    <div className="mockup-bar-item">
                      <div className="mockup-bar-pillar" style={{ height: "58px" }} />
                      <span className="mockup-bar-label">DBMS</span>
                    </div>
                    <div className="mockup-bar-item">
                      <div className="mockup-bar-pillar" style={{ height: "82px" }} />
                      <span className="mockup-bar-label">AI</span>
                    </div>
                    <div className="mockup-bar-item">
                      <div className="mockup-bar-pillar" style={{ height: "64px" }} />
                      <span className="mockup-bar-label">NET</span>
                    </div>
                  </div>
                </div>

                {/* Progress Rings Card */}
                <div className="mockup-rings-card">
                  <span className="mockup-stat-label">Coverage by Year</span>
                  <div className="mockup-rings-row">
                    <StatRing percentage={88} label="Year 1" size={54} color="#3F4FA8" strokeWidth={5} />
                    <StatRing percentage={92} label="Year 2" size={54} color="#5B73E0" strokeWidth={5} />
                    <StatRing percentage={79} label="Year 3" size={54} color="#232C6B" strokeWidth={5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Smooth Marquee Strip of Subject Names ── */}
      <section className="marquee-section">
        <div className="marquee-track">
          <div className="marquee-content">
            {MARQUEE_SUBJECTS.map((sub, idx) => (
              <span key={idx} className="marquee-item">
                <span className="marquee-dot" />
                {sub}
              </span>
            ))}
          </div>
          <div className="marquee-content" aria-hidden="true">
            {MARQUEE_SUBJECTS.map((sub, idx) => (
              <span key={`clone-${idx}`} className="marquee-item">
                <span className="marquee-dot" />
                {sub}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Real Stats Row (Driven by Real API Data) ── */}
      {statsLoaded && (
        <section className="landing-stats-row">
          <div className="stats-container">
            <div className="stat-unit">
              <strong className="stat-big-num num-stat">
                {realStats.papers > 0 ? `${realStats.papers}+` : "Live"}
              </strong>
              <span className="stat-unit-title">Archived Past Papers</span>
              <span className="stat-unit-desc">Available for direct study</span>
            </div>

            <div className="stat-unit">
              <strong className="stat-big-num num-stat">
                {realStats.users > 0 ? `${realStats.users}+` : "Active"}
              </strong>
              <span className="stat-unit-title">Registered Accounts</span>
              <span className="stat-unit-desc">RCA students and faculty</span>
            </div>

            <div className="stat-unit">
              <strong className="stat-big-num num-stat">34+</strong>
              <span className="stat-unit-title">Curriculum Modules</span>
              <span className="stat-unit-desc">Year 1, Year 2 & Year 3</span>
            </div>

            <div className="stat-unit">
              <strong className="stat-big-num num-stat">100%</strong>
              <span className="stat-unit-title">Institutional Focus</span>
              <span className="stat-unit-desc">Tailored to Rwanda Coding Academy</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Interactive Campus "Archive Shelf" Class Selector Motif ── */}
      <section id="shelf" className="campus-shelf-section">
        <div className="section-head-wrap">
          <span className="section-eyebrow">Campus Archive Shelf</span>
          <h2 className="section-main-title">Select your cohort shelf</h2>
          <p className="section-main-sub">
            Browse through RCA cohorts to discover modules, lecture guides, CATs, and final examination archives.
          </p>
        </div>

        <div className="shelf-chips-wrap">
          <ClassChips
            selectedClass={selectedClassId}
            onSelectClass={setSelectedClassId}
            size="md"
          />
        </div>

        {/* Shelf Content Panel (Animated when class changes) */}
        <div className="shelf-display-card">
          <div className="shelf-display-header">
            <div>
              <span className="shelf-cohort-tag">Cohort Focus</span>
              <h3 className="shelf-cohort-title">
                {currentClassObj.label} — Year {currentClassObj.year} Stream {currentClassObj.stream}
              </h3>
            </div>
            <div className="shelf-types-badge-row">
              <span className="shelf-type-pill">Past Papers</span>
              <span className="shelf-type-pill">Marking Schemes</span>
              <span className="shelf-type-pill">Lecture Slides</span>
            </div>
          </div>

          <div className="shelf-subjects-grid">
            {classSubjects.map((subject, idx) => (
              <div
                key={idx}
                className="shelf-subject-item"
                onClick={() =>
                  navigate(`/login?redirect=/subject/${currentClassObj.year}/${encodeURIComponent(subject)}`)
                }
              >
                <div className="shelf-subject-icon">
                  <MaterialsIcon size={18} />
                </div>
                <div className="shelf-subject-info">
                  <strong>{subject}</strong>
                  <span>Year {currentClassObj.year} • View past exams →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid (Strict Grid-Template-Areas, NO Empty Cells) ── */}
      <section id="features" className="bento-features-section">
        <div className="section-head-wrap">
          <span className="section-eyebrow">Engineered for RCA</span>
          <h2 className="section-main-title">Modern academic tools that work</h2>
          <p className="section-main-sub">
            Built from scratch to give RCA students and teachers clean, fast, and structured revision workflows.
          </p>
        </div>

        <div className="bento-strict-grid">
          {/* Card 1: Search & Filtering */}
          <div className="bento-item bento-area-search">
            <div className="bento-item-icon" style={{ background: "#3F4FA8", color: "#FFFFFF" }}>
              <SearchIcon size={22} />
            </div>
            <h3 className="bento-item-title">Instant Search & Class Filters</h3>
            <p className="bento-item-desc">
              Filter by cohort class (Y1A through Y3C), subject module, and exam type. Locate exact past exams within seconds.
            </p>
            <div className="bento-visual-search-demo">
              <span className="demo-chip">Y2A</span>
              <span className="demo-chip active">Data Structures</span>
              <span className="demo-chip">Exam Paper</span>
            </div>
          </div>

          {/* Card 2: In-Browser Document Preview */}
          <div className="bento-item bento-area-preview">
            <div className="bento-item-icon" style={{ background: "#5B73E0", color: "#FFFFFF" }}>
              <EyeIcon size={22} />
            </div>
            <h3 className="bento-item-title">In-Browser Document Preview</h3>
            <p className="bento-item-desc">
              View PDF question papers, DOCX solutions, and PPTX notes seamlessly directly in the application without download delays.
            </p>
            <div className="bento-visual-preview-demo">
              <div className="preview-doc-card">
                <span className="doc-icon">PDF</span>
                <span>CAT_1_Algorithms_2025.pdf</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cryptographic Deduplication */}
          <div className="bento-item bento-area-upload">
            <div className="bento-item-icon" style={{ background: "#10B981", color: "#FFFFFF" }}>
              <UploadIcon size={22} />
            </div>
            <h3 className="bento-item-title">SHA-256 Deduplication</h3>
            <p className="bento-item-desc">
              Automated cryptographic file hashing checks uploads for identical content, preventing repeated duplicates in the repository.
            </p>
            <div className="bento-visual-hash-demo">
              <span className="hash-code">sha256: 7f83b165... verified</span>
            </div>
          </div>

          {/* Card 4: Peer Ratings */}
          <div className="bento-item bento-area-ratings">
            <div className="bento-item-icon" style={{ background: "#F59E0B", color: "#FFFFFF" }}>
              <StarIcon size={22} />
            </div>
            <h3 className="bento-item-title">Verified Peer Ratings</h3>
            <p className="bento-item-desc">
              Students and teachers rate papers to highlight high-yield examination questions and comprehensive solution keys.
            </p>
            <div className="bento-visual-stars-demo">
              {[1, 2, 3, 4, 5].map((s) => (
                <StarIcon key={s} size={18} filled />
              ))}
              <span className="star-rating-text">Peer-reviewed</span>
            </div>
          </div>

          {/* Card 5: Class-Based Organisation */}
          <div className="bento-item bento-area-classes">
            <div className="bento-item-icon" style={{ background: "#232C6B", color: "#FFFFFF" }}>
              <MaterialsIcon size={22} />
            </div>
            <h3 className="bento-item-title">Campus Cohort Organisation</h3>
            <p className="bento-item-desc">
              All 10 campus classes (Y1A, Y1B, Y1C, Y1GenAI, Y2A, Y2B, Y2C, Y3A, Y3B, Y3C) have dedicated archive shelf spaces.
            </p>
            <div className="bento-visual-classes-demo">
              <span className="cohort-mini-tag">10 Campus Cohorts</span>
              <span className="cohort-mini-tag">Structured Terms</span>
            </div>
          </div>

          {/* Card 6: Role-Based Access Control */}
          <div className="bento-item bento-area-rbac">
            <div className="bento-item-icon" style={{ background: "#3F4FA8", color: "#FFFFFF" }}>
              <ShieldIcon size={22} />
            </div>
            <h3 className="bento-item-title">Role-Based Access & Moderation</h3>
            <p className="bento-item-desc">
              Distinct permissions for Students, Teachers, and Administrators, with a formal deletion request queue for content moderation.
            </p>
            <div className="bento-visual-rbac-demo">
              <span className="role-pill-student">Student</span>
              <span className="role-pill-teacher">Teacher</span>
              <span className="role-pill-admin">Administrator</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (3 Steps with Connected Line) ── */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-head-wrap">
          <span className="section-eyebrow">Straightforward Workflow</span>
          <h2 className="section-main-title">How to get started in 3 steps</h2>
          <p className="section-main-sub">
            Designed to fit directly into your daily revision habits and exam preparations.
          </p>
        </div>

        <div className="steps-connected-grid">
          <div className="step-card-box">
            <div className="step-circle-badge">01</div>
            <h3 className="step-heading">Create Account or Sign In</h3>
            <p className="step-description">
              Sign in with your verified RCA credentials, or register with 6-digit email OTP verification.
            </p>
          </div>

          <div className="step-card-box">
            <div className="step-circle-badge">02</div>
            <h3 className="step-heading">Select Year or Class Shelf</h3>
            <p className="step-description">
              Choose your cohort stream or search across all curriculum modules to pinpoint relevant materials.
            </p>
          </div>

          <div className="step-card-box">
            <div className="step-circle-badge">03</div>
            <h3 className="step-heading">Preview, Study & Download</h3>
            <p className="step-description">
              Study directly in the responsive viewer, download files for offline study, and rate helpful solutions.
            </p>
          </div>
        </div>
      </section>

      {/* ── Roles Section (3 Distinct Cards) ── */}
      <section id="roles" className="roles-overview-section">
        <div className="section-head-wrap">
          <span className="section-eyebrow">Tailored Experience</span>
          <h2 className="section-main-title">Built for the entire RCA community</h2>
          <p className="section-main-sub">
            Distinct tools and permissions designed for learners, instructors, and academy administration.
          </p>
        </div>

        <div className="roles-cards-container">
          {/* Student Card */}
          <div className="role-user-card">
            <div className="role-card-icon" style={{ background: "#E4E8FA", color: "#3F4FA8" }}>
              <UserIcon size={24} />
            </div>
            <h3 className="role-card-title">Students</h3>
            <p className="role-card-summary">
              Prepare effectively with previous term examination papers, quizzes, notes, and peer solution guides.
            </p>
            <ul className="role-bullets">
              <li><CheckIcon size={14} /> Cohort-filtered past exams</li>
              <li><CheckIcon size={14} /> Full in-browser PDF preview</li>
              <li><CheckIcon size={14} /> Upload paper contributions</li>
            </ul>
          </div>

          {/* Teacher Card */}
          <div className="role-user-card">
            <div className="role-card-icon" style={{ background: "#EEF0F6", color: "#5B73E0" }}>
              <UsersIcon size={24} />
            </div>
            <h3 className="role-card-title">Teachers</h3>
            <p className="role-card-summary">
              Publish official past exams, curriculum slides, and lesson supplements to your cohort effortlessly.
            </p>
            <ul className="role-bullets">
              <li><CheckIcon size={14} /> Upload past papers with metadata</li>
              <li><CheckIcon size={14} /> Verified faculty contributor tag</li>
              <li><CheckIcon size={14} /> Review student engagement</li>
            </ul>
          </div>

          {/* Administrator Card */}
          <div className="role-user-card">
            <div className="role-card-icon" style={{ background: "#F4F6FD", color: "#232C6B" }}>
              <ShieldIcon size={24} />
            </div>
            <h3 className="role-card-title">Administrators</h3>
            <p className="role-card-summary">
              Maintain institutional standards with moderation queues, user directories, and system audit logs.
            </p>
            <ul className="role-bullets">
              <li><CheckIcon size={14} /> Paper deletion moderation queue</li>
              <li><CheckIcon size={14} /> Teacher and student account management</li>
              <li><CheckIcon size={14} /> Live repository analytics</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Final CTA Band ── */}
      <section className="landing-final-cta">
        <div className="final-cta-card">
          <h2 className="final-cta-heading">Ready to start preparing for exams?</h2>
          <p className="final-cta-subtitle">
            Join Rwanda Coding Academy students and educators sharing past papers and curriculum solutions.
          </p>
          <Button
            variant="glass"
            size="lg"
            onClick={() => navigate("/signup")}
            style={{ fontWeight: 700 }}
          >
            Create Your Account
          </Button>
        </div>
      </section>

      {/* ── Modern Clean Footer ── */}
      <footer className="landing-footer-clean">
        <div className="footer-grid">
          <div className="footer-brand-pane">
            <Logo variant="light" size="sm" showWordmark wordmarkColor="#1B2142" />
            <p className="footer-tagline">
              Official past papers and academic study repository for Rwanda Coding Academy.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Portal</h4>
            <a href="#shelf">Class Shelf</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#roles">Role Access</a>
          </div>

          <div className="footer-links-col">
            <h4>Cohorts</h4>
            <Link to="/login?redirect=/home?year=1">Year 1 Curriculum</Link>
            <Link to="/login?redirect=/home?year=2">Year 2 Curriculum</Link>
            <Link to="/login?redirect=/home?year=3">Year 3 Curriculum</Link>
          </div>

          <div className="footer-links-col">
            <h4>Account</h4>
            <Link to="/login">Sign In</Link>
            <Link to="/signup">Register</Link>
            <Link to="/reset-password">Reset Password</Link>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <span>© {new Date().getFullYear()} Rwanda Coding Academy. All rights reserved.</span>
          <span>Academic Knowledge Repository</span>
        </div>
      </footer>
    </div>
  );
}
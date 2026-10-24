import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  SearchIcon as Search,
  EyeIcon as Eye,
  FileTextIcon as FileText,
  ShieldIcon as Shield,
  GraduationCapIcon as GraduationCap,
  UsersIcon as Users,
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  MenuIcon as Menu,
  CloseIcon as X,
  BookOpenIcon as BookOpen,
  SparklesIcon as Sparkles,
  LayersIcon as Layers,
  CalendarIcon as Calendar,
  LockIcon as Lock,
} from "./ui/Icons";
import "./Landing.css";
import Logo from "./ui/Logo";
import Button from "./ui/Button";
import ProgressRing from "./ui/ProgressRing";
import ThemeToggle from "./ui/ThemeToggle";
import WaterDecoration from "./ui/WaterDecoration";
import curriculumService from "../services/curriculum";
import api from "../services/api";

export default function Landing() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState(() => curriculumService.getPromotions());
  const [selectedPromoIndex, setSelectedPromoIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realStats, setRealStats] = useState({ papers: 0, users: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Sync with curriculum updates
  useEffect(() => {
    const handleCurriculum = (e) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        setPromotions(e.detail);
      }
    };
    window.addEventListener("curriculum-updated", handleCurriculum);
    curriculumService.fetchCurriculum().then((data) => {
      if (Array.isArray(data) && data.length > 0) setPromotions(data);
    });
    return () => window.removeEventListener("curriculum-updated", handleCurriculum);
  }, []);

  // Fetch verified stats from API without inventing numbers
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.get("/papers").catch(() => ({ data: [] })),
      api.get("/stats").catch(() => ({ data: {} })),
    ]).then(([papersRes, statsRes]) => {
      if (!isMounted) return;
      const papersCount = Array.isArray(papersRes.data)
        ? papersRes.data.length
        : Number(statsRes.data?.totalPapers || 0);
      const usersCount = Number(statsRes.data?.totalUsers || 0);
      setRealStats({ papers: papersCount, users: usersCount });
      setStatsLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const currentPromo = promotions[selectedPromoIndex] || promotions[0] || {
    id: "Y1",
    label: "Year 1",
    classes: ["Y1A", "Y1B", "Y1C"],
    subjects: [],
  };

  const handlePrevPromo = () => {
    setSelectedPromoIndex((prev) => (prev === 0 ? promotions.length - 1 : prev - 1));
  };

  const handleNextPromo = () => {
    setSelectedPromoIndex((prev) => (prev === promotions.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="landing-root">
      {/* ====================================================================
          1. STICKY CLEAN NAVBAR
          ==================================================================== */}
      <nav className="landing-navbar">
        <div className="landing-navbar-container">
          <Link to="/" className="landing-navbar-logo">
            <Logo variant="full" size="navbar" />
          </Link>

          {/* Desktop Nav Links */}
          <div className="landing-navbar-links">
            <a href="#classes" className="nav-link">Classes</a>
            <a href="#services" className="nav-link">Features</a>
            <a href="#steps" className="nav-link">How it works</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#roles" className="nav-link">Roles</a>
          </div>

          {/* Auth Actions */}
          <div className="landing-navbar-actions">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/signup")}
            >
              Get Started
            </Button>
            <button
              type="button"
              className="landing-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="landing-mobile-drawer">
            <a href="#classes" onClick={() => setMobileMenuOpen(false)}>Classes</a>
            <a href="#services" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#steps" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a href="#roles" onClick={() => setMobileMenuOpen(false)}>Roles</a>
            <div className="mobile-drawer-auth">
              <Button variant="outline" size="md" onClick={() => navigate("/login")}>
                Sign In
              </Button>
              <Button variant="primary" size="md" onClick={() => navigate("/signup")}>
                Get Started
              </Button>
            </div>
          </div>
        )}
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
              Past papers, assignments and revision notes for RCA leaders.
            </h1>

            <p className="hero-subtitle">
              The dedicated academic portal for Rwanda Coding Academy students and faculty.
              Search past papers, view comprehensive course notes, and manage class assignments across all terms.
            </p>

            <div className="hero-cta-group">
              <Button
                variant="primary"
                size="lg"
                iconRight={<ArrowRight size={18} />}
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
          </div>

          {/* Right Column: Circular Masked Mockup with Pale Overlap & Scattered Dots */}
          <div className="landing-hero-right">
            {/* Background Pale Circle Decoration */}
            <div className="hero-pale-circle" />

            {/* Scattered Decorative Dots */}
            <div className="hero-decor-dot dot-1" />
            <div className="hero-decor-dot dot-2" />
            <div className="hero-decor-dot dot-3" />
            <div className="hero-decor-dot dot-4" />

            {/* Floating Safe Card 1 (Top Left, 16px+ Clearance) */}
            <div className="hero-floating-card float-card-1">
              <div className="floating-card-icon" style={{ backgroundColor: "#5B73E0" }}>
                <Eye size={16} color="#FFFFFF" />
              </div>
              <div>
                <strong className="floating-card-title">In-Browser Reader</strong>
                <span className="floating-card-sub">Instant PDF and note preview</span>
              </div>
            </div>

            {/* Floating Safe Card 2 (Bottom Right, 16px+ Clearance) */}
            <div className="hero-floating-card float-card-2">
              <div className="floating-card-icon" style={{ backgroundColor: "#10B981" }}>
                <Check size={16} color="#FFFFFF" />
              </div>
              <div>
                <strong className="floating-card-title">Curriculum Aligned</strong>
                <span className="floating-card-sub">Year 1 to Year 3 streams</span>
              </div>
            </div>

            {/* Circular Masked Visual Container */}
            <div className="hero-circle-mask">
              <div className="hero-mockup-inner">
                {/* Mockup Header */}
                <div className="mockup-top-bar">
                  <div className="mockup-logo-row">
                    <span className="mockup-dot-indicator" />
                    <strong>RCA Archive</strong>
                  </div>
                  <span className="mockup-term-chip">Term Active</span>
                </div>

                {/* Mockup Bar Chart Area */}
                <div className="mockup-metrics-box">
                  <div className="mockup-box-head">
                    <span>Curriculum Coverage</span>
                    <span className="mockup-badge-mini">All Streams</span>
                  </div>
                  <div className="mockup-bars-row">
                    <div className="mockup-bar-col">
                      <div className="mockup-bar" style={{ height: "68px", background: "linear-gradient(180deg, #5B73E0 0%, #3F4FA8 100%)" }} />
                      <span>DSA</span>
                    </div>
                    <div className="mockup-bar-col">
                      <div className="mockup-bar" style={{ height: "92px", background: "linear-gradient(180deg, #5B73E0 0%, #3F4FA8 100%)" }} />
                      <span>OOP</span>
                    </div>
                    <div className="mockup-bar-col">
                      <div className="mockup-bar" style={{ height: "54px", background: "linear-gradient(180deg, #5B73E0 0%, #3F4FA8 100%)" }} />
                      <span>DBMS</span>
                    </div>
                    <div className="mockup-bar-col">
                      <div className="mockup-bar" style={{ height: "80px", background: "linear-gradient(180deg, #5B73E0 0%, #3F4FA8 100%)" }} />
                      <span>AI</span>
                    </div>
                    <div className="mockup-bar-col">
                      <div className="mockup-bar" style={{ height: "62px", background: "linear-gradient(180deg, #5B73E0 0%, #3F4FA8 100%)" }} />
                      <span>NET</span>
                    </div>
                  </div>
                </div>

                {/* Progress Rings Card */}
                <div className="mockup-rings-box">
                  <span className="mockup-box-label">Archive Progress</span>
                  <div className="mockup-rings-grid">
                    <ProgressRing percentage={88} label="Year 1" size={54} color="#3F4FA8" strokeWidth={5} />
                    <ProgressRing percentage={94} label="Year 2" size={54} color="#5B73E0" strokeWidth={5} />
                    <ProgressRing percentage={82} label="Year 3" size={54} color="#232C6B" strokeWidth={5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ====================================================================
          3. ROW OF 4 SERVICE CARDS (STRICT CSS GRID, ONE SOLID INDIGO)
          ==================================================================== */}
      <section id="services" className="landing-services-section">
        <div className="landing-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">Academic Architecture</span>
            <h2 className="section-title">Designed for rapid revision and study</h2>
            <p className="section-subtext">
              Four tailored features that keep students focused and educators organized.
            </p>
          </div>

          <div className="services-strict-grid">
            {/* Card 1: Search & Filters */}
            <div className="service-card">
              <div className="service-icon-box" style={{ backgroundColor: "#F4F6FD", color: "#3F4FA8" }}>
                <Search size={22} />
              </div>
              <h3 className="service-card-title">Search and Filters</h3>
              <p className="service-card-desc">
                Filter past exams by academic year, cohort class, module, and examination type in seconds.
              </p>
              <div className="service-card-footer">
                <span className="service-tag">Exact module matching</span>
              </div>
            </div>

            {/* Card 2: In-browser Preview */}
            <div className="service-card">
              <div className="service-icon-box" style={{ backgroundColor: "#F4F6FD", color: "#5B73E0" }}>
                <Eye size={22} />
              </div>
              <h3 className="service-card-title">In-Browser Preview</h3>
              <p className="service-card-desc">
                Read PDF questions, solution schemes, and lecture presentations instantly without downloading clutter.
              </p>
              <div className="service-card-footer">
                <span className="service-tag">Direct file viewing</span>
              </div>
            </div>

            {/* Card 3: HIGHLIGHTED SOLID INDIGO CARD */}
            <div className="service-card card-highlight-indigo">
              <div className="service-icon-box highlight-icon-box">
                <Layers size={22} color="#FFFFFF" />
              </div>
              <h3 className="service-card-title highlight-title">Class-Based Resources</h3>
              <p className="service-card-desc highlight-desc">
                Structured repository spaces for all 10 campus cohorts from Year 1 to Year 3, separating lectures, CATs, and exams.
              </p>
              <div className="service-card-footer">
                <span className="service-tag highlight-tag">10 Campus Cohorts</span>
              </div>
            </div>

            {/* Card 4: Role-Based Access */}
            <div className="service-card">
              <div className="service-icon-box" style={{ backgroundColor: "#F4F6FD", color: "#10B981" }}>
                <Shield size={22} />
              </div>
              <h3 className="service-card-title">Role-Based Access</h3>
              <p className="service-card-desc">
                Dedicated dashboards and permission flows for Students, Instructors, and Academy Administrators.
              </p>
              <div className="service-card-footer">
                <span className="service-tag">Secure roles</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. FULL-WIDTH INDIGO BAND WITH NUMBERED SIMPLE STEPS
          ==================================================================== */}
      <section id="steps" className="landing-steps-band">
        <div className="landing-container">
          <div className="steps-band-grid">
            {/* Left: Numbered Steps */}
            <div className="steps-content-left">
              <span className="steps-eyebrow">Straightforward Workflow</span>
              <h2 className="steps-headline">Simple steps to academic success</h2>
              <p className="steps-lead">
                Built to integrate cleanly into your daily revision schedule and examination prep.
              </p>

              <div className="numbered-steps-list">
                <div className="step-item">
                  <div className="step-number-circle">1</div>
                  <div className="step-item-body">
                    <strong className="step-item-title">Create account</strong>
                    <p className="step-item-desc">
                      Register with your name, verified RCA email address, and 6-digit confirmation code.
                    </p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number-circle">2</div>
                  <div className="step-item-body">
                    <strong className="step-item-title">Choose your class</strong>
                    <p className="step-item-desc">
                      Select your cohort stream from Y1A through Y3C to access syllabus modules and assignments.
                    </p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number-circle">3</div>
                  <div className="step-item-body">
                    <strong className="step-item-title">Study and contribute</strong>
                    <p className="step-item-desc">
                      Preview past exams, submit assignment work, and contribute helpful study materials.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Circular Visual Beside Steps */}
            <div className="steps-visual-right">
              <div className="steps-circle-visual">
                <div className="steps-inner-graphic">
                  <div className="graphic-badge-row">
                    <span className="graphic-badge"><Check size={14} /> Marking Scheme</span>
                    <span className="graphic-badge"><Calendar size={14} /> Term 1 to 3</span>
                  </div>
                  <div className="graphic-center-card">
                    <GraduationCap size={44} color="#3F4FA8" />
                    <strong>RCA Archive</strong>
                    <span>Academic Resource Library</span>
                  </div>
                  <div className="graphic-pill-row">
                    <span className="graphic-pill">Past Papers</span>
                    <span className="graphic-pill">CATs</span>
                    <span className="graphic-pill">Solutions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          5. ABOUT SECTION WITH DEVICE MOCKUP INSIDE CIRCLE
          ==================================================================== */}
      <section id="about" className="landing-about-section">
        <div className="landing-container">
          <div className="about-layout-grid">
            {/* Left: Device Mockup inside Circle */}
            <div className="about-visual-col">
              <div className="about-circle-container">
                <div className="about-circle-backdrop" />
                <div className="about-device-mockup">
                  <div className="device-screen-top">
                    <span className="device-camera-dot" />
                  </div>
                  <div className="device-screen-content">
                    <div className="device-app-header">
                      <Logo variant="knockout" size="xs" showWordmark={false} />
                      <span className="device-header-title">Student Portal</span>
                    </div>
                    <div className="device-card-mock">
                      <div className="device-card-header">
                        <span className="device-class-tag">{currentPromo.label}</span>
                        <span className="device-status-badge">Active</span>
                      </div>
                      <strong className="device-subject-name">{currentPromo.subjects?.[0] || "Programming"}</strong>
                      <span className="device-meta">{currentPromo.label} Curriculum</span>
                    </div>
                    <div className="device-card-mock subtle">
                      <div className="device-card-header">
                        <span className="device-class-tag">{currentPromo.label}</span>
                      </div>
                      <strong className="device-subject-name">{currentPromo.subjects?.[1] || "Mathematics"}</strong>
                      <span className="device-meta">{currentPromo.label} Curriculum</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Informational Copy */}
            <div className="about-text-col">
              <span className="section-eyebrow">Institutional Heritage</span>
              <h2 className="section-title">Built for the future tech leaders of Rwanda</h2>
              <p className="about-paragraph">
                Rwanda Coding Academy combines rigorous high school academics with specialized software engineering, embedded systems, and artificial intelligence tracks.
              </p>
              <p className="about-paragraph">
                The RCA Archive serves as the central digital repository for curriculum materials, preserving previous years' examination standards, instructor notes, and student project documentation in one unified system.
              </p>

              <div className="about-bullets-grid">
                <div className="about-bullet">
                  <div className="about-bullet-icon"><Check size={16} /></div>
                  <div>
                    <strong>Historical Continuity</strong>
                    <span>Access questions dating back across multiple cohorts.</span>
                  </div>
                </div>
                <div className="about-bullet">
                  <div className="about-bullet-icon"><Check size={16} /></div>
                  <div>
                    <strong>Stream Separation</strong>
                    <span>Separate spaces for Software, Embedded, and GenAI streams.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          6. BROWSE BY PROMOTION CAROUSEL WITH ARROWS
          ==================================================================== */}
      <section id="classes" className="landing-classes-section">
        <div className="landing-container">
          <div className="classes-header-row">
            <div>
              <span className="section-eyebrow">Academic Curriculum</span>
              <h2 className="section-title">Browse by promotion</h2>
              <p className="section-subtext">
                Select an accredited RCA promotion to preview syllabus subjects and revision past papers.
              </p>
            </div>

            {/* Carousel Control Arrows */}
            <div className="carousel-nav-arrows">
              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={handlePrevPromo}
                aria-label="Previous promotion"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={handleNextPromo}
                aria-label="Next promotion"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Interactive Promotion Chips Track */}
          <div className="classes-chips-track">
            {promotions.map((promo, idx) => {
              const isSelected = selectedPromoIndex === idx;
              return (
                <button
                  key={promo.id}
                  type="button"
                  className={`class-chip-pill ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedPromoIndex(idx)}
                >
                  {promo.label}
                </button>
              );
            })}
          </div>

          {/* Promotion Content Showcase Card */}
          <div className="class-showcase-panel" style={{ position: "relative", overflow: "hidden" }}>
            <WaterDecoration variant="stat" />

            <div className="class-showcase-header" style={{ position: "relative", zIndex: 1 }}>
              <div>
                <span className="showcase-cohort-tag">Curriculum Focus</span>
                <h3 className="showcase-cohort-title">
                  {currentPromo.label} ({currentPromo.classes ? currentPromo.classes.join(", ") : currentPromo.id})
                </h3>
              </div>
              <div className="showcase-types-row">
                <span className="showcase-pill">Notes</span>
                <span className="showcase-pill">Assignments</span>
                <span className="showcase-pill">Past Papers</span>
              </div>
            </div>

            <div className="showcase-modules-grid" style={{ position: "relative", zIndex: 1 }}>
              {(currentPromo.subjects || []).map((sub, sIdx) => (
                <div
                  key={sIdx}
                  className="showcase-module-card"
                  onClick={() => navigate(`/login?redirect=/subject/${encodeURIComponent(currentPromo.id)}/${encodeURIComponent(sub)}`)}
                >
                  <div className="module-card-icon">
                    <BookOpen size={18} />
                  </div>
                  <div className="module-card-info">
                    <strong>{sub}</strong>
                    <span>{currentPromo.label} Curriculum</span>
                  </div>
                  <ArrowRight size={16} className="module-card-arrow" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          7. ROLES OVERVIEW SECTION
          ==================================================================== */}
      <section id="roles" className="landing-roles-section">
        <div className="landing-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">Permission Architecture</span>
            <h2 className="section-title">Built for the entire RCA community</h2>
            <p className="section-subtext">
              Distinct workflows designed specifically for learners, instructors, and system administrators.
            </p>
          </div>

          <div className="roles-cards-grid">
            {/* Student Role */}
            <div className="role-card">
              <div className="role-card-badge" style={{ backgroundColor: "#F4F6FD", color: "#3F4FA8" }}>
                <GraduationCap size={24} />
              </div>
              <h3 className="role-card-name">Students</h3>
              <p className="role-card-desc">
                Study with previous years' examination papers, verify solution steps, and review assignment criteria.
              </p>
              <ul className="role-checklist">
                <li><Check size={15} /> Cohort-filtered past exams</li>
                <li><Check size={15} /> Direct in-browser PDF preview</li>
                <li><Check size={15} /> Peer paper uploads</li>
              </ul>
            </div>

            {/* Teacher Role */}
            <div className="role-card">
              <div className="role-card-badge" style={{ backgroundColor: "#F4F6FD", color: "#5B73E0" }}>
                <Users size={24} />
              </div>
              <h3 className="role-card-name">Teachers</h3>
              <p className="role-card-desc">
                Publish official examination materials, curriculum slides, and manage assignment submission deadlines.
              </p>
              <ul className="role-checklist">
                <li><Check size={15} /> Manage class assignments</li>
                <li><Check size={15} /> Review and resolve appeals</li>
                <li><Check size={15} /> Publish curriculum solution notes</li>
              </ul>
            </div>

            {/* Admin Role */}
            <div className="role-card">
              <div className="role-card-badge" style={{ backgroundColor: "#F4F6FD", color: "#232C6B" }}>
                <Shield size={24} />
              </div>
              <h3 className="role-card-name">Administrators</h3>
              <p className="role-card-desc">
                Complete platform supervision, user provisioning, faculty invitations, and content deletion reviews.
              </p>
              <ul className="role-checklist">
                <li><Check size={15} /> Faculty account invitations</li>
                <li><Check size={15} /> Content deletion moderation</li>
                <li><Check size={15} /> Real-time system analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          8. CALL TO ACTION BAR OVERLAPPING FOOTER
          ==================================================================== */}
      <section className="landing-cta-section">
        <div className="landing-container">
          <div className="cta-overlap-card">
            <div className="cta-text-left">
              <h2 className="cta-headline">Ready to excel in your RCA courses?</h2>
              <p className="cta-subheadline">
                Join your classmates and start preparing with comprehensive past papers and solution keys today.
              </p>
            </div>
            <div className="cta-buttons-right">
              <Button
                variant="primary"
                size="lg"
                iconRight={<ArrowRight size={18} />}
                onClick={() => navigate("/signup")}
              >
                Create Account
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/login")}
                style={{ backgroundColor: "transparent", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.4)" }}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          9. MULTI-COLUMN FOOTER
          ==================================================================== */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-columns-grid">
            {/* Col 1: Brand Info */}
            <div className="footer-brand-col">
              <Logo variant="knockout" size="footer" />
              <p className="footer-brand-text">
                Rwanda Coding Academy academic knowledge archive and curriculum revision portal.
                Dedicated to empowering young software engineering talents.
              </p>
              <span className="footer-brand-sub">Nyabihu Campus, Western Province, Rwanda</span>
            </div>

            {/* Col 2: Academic Streams */}
            <div className="footer-links-col">
              <strong className="footer-col-title">Academic Years</strong>
              <ul>
                <li><Link to="/home">Year 1 Curriculum</Link></li>
                <li><Link to="/home">Year 2 Curriculum</Link></li>
                <li><Link to="/home">Year 3 Curriculum</Link></li>
                <li><Link to="/home">General AI Track</Link></li>
              </ul>
            </div>

            {/* Col 3: Portal Links */}
            <div className="footer-links-col">
              <strong className="footer-col-title">Portal Access</strong>
              <ul>
                <li><Link to="/login">Sign In</Link></li>
                <li><Link to="/signup">Student Registration</Link></li>
                <li><Link to="/teacher">Teacher Dashboard</Link></li>
                <li><Link to="/admin">Administration</Link></li>
              </ul>
            </div>

            {/* Col 4: Support */}
            <div className="footer-links-col">
              <strong className="footer-col-title">Institutional Support</strong>
              <ul>
                <li><Link to="/report-issue">Report an Issue</Link></li>
                <li><a href="mailto:support@rca.ac.rw">Technical Helpdesk</a></li>
                <li><Link to="/login">Account Recovery</Link></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span>Copyright Rwanda Coding Academy Archive. All rights reserved.</span>
            <span>Educational Knowledge Base</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
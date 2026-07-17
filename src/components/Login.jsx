import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthStorage, getStoredUser, isAuthenticated, persistAuth } from "../utils/auth";
import api from "../api";
import "./Login.css";
import rcaLogo from "../rca.png";

// ─── Small reusable pieces ────────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let animId;
    let points = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      points = Array.from({ length: 50 }, () => ({
        x: Math.random() * canvas.width * 0.45,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.4 + 0.4,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      points.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width * 0.45) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(96,165,250,.3)";
        ctx.fill();
      });
      points.forEach((a, i) => {
        points.slice(i + 1).forEach((b) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 75) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(96,165,250,${0.1 * (1 - d / 75)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" style={{ position: "absolute", inset: 0 }} />;
}

function TypingText() {
  const phrases = useMemo(
    () => ["Access past papers & study materials", "Built for RCA students", "Your archive, anytime, anywhere"],
    []
  );
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIndex];
    let delay = deleting ? 38 : 58;
    if (!deleting && charIndex === current.length) delay = 1800;
    const t = setTimeout(() => {
      if (!deleting && charIndex === current.length) { setDeleting(true); return; }
      if (deleting && charIndex === 0) { setDeleting(false); setPhraseIndex((v) => (v + 1) % phrases.length); return; }
      setCharIndex((v) => v + (deleting ? -1 : 1));
    }, delay);
    return () => clearTimeout(t);
  }, [charIndex, deleting, phraseIndex, phrases]);

  return <div className="typing-text">{phrases[phraseIndex].slice(0, charIndex)}</div>;
}

function Feature({ icon, text }) {
  return (
    <div className="feature">
      <span>{icon}</span>
      {text}
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="brand-panel" aria-label="RCA Archive">
      <div className="brand-logo">
        <img src={rcaLogo} alt="RCA Logo" />
      </div>
      <div className="brand-name">RCA ARCHIVE+</div>
      <div className="brand-school">RWANDA CODING ACADEMY</div>
      <TypingText />
      <div className="feature-list">
        <Feature icon={<DocumentIcon />} text="Complete study materials" />
        <Feature icon={<ClockIcon />} text="Past exam papers" />
        <Feature icon={<StarIcon />} text="Quality resources" />
      </div>
      <div className="stat-row">
        <StatCard value="200+" label="Students" />
        <StatCard value="300+" label="Papers" />
        <StatCard value="24+" label="Subjects" />
      </div>
    </section>
  );
}

// ─── Main Login component ─────────────────────────────────────────────────────

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      const { role } = getStoredUser();
      navigate(role === "admin" ? "/admin" : "/", { replace: true });
    } else {
      clearAuthStorage();
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Login submit ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/login", formData);

      persistAuth({
        token: data.token,
        email: data.email || formData.email,
        username: data.username || data.name || data.email,
        role: data.role || "student",
      });

      navigate(data.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password submit ────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { data } = await api.post("/forgot-password", { email: forgotEmail });

      setInfo(data.message || "If this email is registered, a reset link has been sent.");

      // If SMTP is not configured, show preview link for dev convenience
      if (data.previewUrl) {
        setForgotPreview(data.previewUrl);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || "Unable to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const [forgotPreview, setForgotPreview] = useState(null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="login-page">
      <div className="archive-auth-shell">
        <ParticleCanvas />
        <BrandPanel />

        <section className="auth-panel" aria-label={mode === "login" ? "Sign in form" : "Forgot password form"}>
          <div className="auth-card">
            {mode === "login" ? (
              <>
                <h1 className="form-title">Sign in</h1>
                <p className="form-subtitle">
                  Access your papers, reports, and administrative tools from one secure place.
                </p>

                {error ? <div className="error-msg">{error}</div> : null}

                <form className="login-form" onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="auth-label active" htmlFor="email">Email</label>
                    <div className="input-shell">
                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        autoComplete="email"
                        required
                      />
                      <span className="input-icon"><MailIcon /></span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="auth-label active" htmlFor="password">Password</label>
                    <div className="input-shell">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <span 
                        className="input-icon" 
                        style={{ cursor: "pointer" }} 
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </span>
                    </div>
                  </div>

                  <div className="forgot-password-row">
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className="login-btn" disabled={loading}>
                    <span className={loading ? "button-text hidden" : "button-text"}>Sign in</span>
                    {loading && <span className="button-spinner" />}
                  </button>
                </form>
                <div className="form-footer">
                  <p style={{ color: "rgba(30,64,175,0.7)", fontSize: "0.85rem", margin: 0 }}>
                    New student?{" "}
                    <button
                      type="button"
                      className="toggle-link"
                      onClick={() => navigate("/signup")}
                    >
                      Create account
                    </button>
                  </p>
                
                </div>
              </>
            ) : (
              <>
                <h1 className="form-title">Reset password</h1>
                <p className="form-subtitle">
                  Enter your email and we'll send you a reset link.
                </p>

                {error ? <div className="error-msg">{error}</div> : null}
                {info ? <div className="success-msg">{info}</div> : null}
                {forgotPreview ? (
                  <div className="success-msg" style={{ wordBreak: "break-all" }}>
                    Dev preview link:{" "}
                    <a href={forgotPreview} target="_blank" rel="noopener noreferrer">
                      {forgotPreview}
                    </a>
                  </div>
                ) : null}

                <form className="login-form" onSubmit={handleForgot}>
                  <div className="form-group">
                    <label className="auth-label active" htmlFor="forgot-email">Email</label>
                    <div className="input-shell">
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                      <span className="input-icon"><MailIcon /></span>
                    </div>
                  </div>

                  <button type="submit" className="login-btn" disabled={loading}>
                    <span className={loading ? "button-text hidden" : "button-text"}>
                      Send reset link
                    </span>
                    {loading && <span className="button-spinner" />}
                  </button>
                </form>

                <div className="auth-divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>
                <div className="form-footer">
                  <button
                    type="button"
                    className="toggle-link"
                    onClick={() => { setMode("login"); setError(""); setInfo(""); setForgotPreview(null); }}
                  >
                    ← Back to Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M12 12l9-9" />
      <path d="M16 7l2 2" />
      <path d="M19 4l2 2" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default Login;

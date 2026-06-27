import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthStorage, getStoredUser, isAuthenticated, persistAuth } from "../utils/auth";
import "./Login.css";
import rcaLogo from "../rca.png";

// ─── Small reusable pieces ─────────────────────────────────────────────────────

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
    () => ["Join the RCA Archive community", "Access all study materials", "Your academic journey starts here"],
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
        <StatCard value="1200k+" label="Students" />
        <StatCard value="340+" label="Papers" />
        <StatCard value="24+" label="Subjects" />
      </div>
    </section>
  );
}

// ─── Main Signup component ──────────────────────────────────────────────────────

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ 
    username: "", 
    email: "", 
    password: "", 
    confirmPassword: "",
    otp: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [otpSent, setOtpSent] = useState(false);

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

  // Helper to parse responses safely (like apiClient.js)
  const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return text ? { message: text } : {};
  };

  const sendOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, operation: "signup" }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");
      setOtpSent(true);
      let infoMsg = "Verification code sent to your email!";
      if (data.previewUrl) {
        infoMsg += ` Preview URL: ${data.previewUrl}`;
      }
      setInfo(infoMsg);
      console.log("📧 Send OTP response data:", data);
    } catch (e) {
      setError(e.message);
      console.error("❌ Send OTP error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!otpSent) {
      await sendOtp();
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          otp: formData.otp
        }),
      });

      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(data.error || data.message || "Signup failed");
      }

      setInfo("Account created! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="archive-auth-shell">
        <ParticleCanvas />
        <BrandPanel />

        <section className="auth-panel" aria-label="Sign up form">
          <div className="auth-card">
            <h1 className="form-title">Create account</h1>
            <p className="form-subtitle">
              Join the RCA Archive and start accessing study materials today.
            </p>

            {error ? <div className="error-msg">{error}</div> : null}
            {info ? <div className="success-msg">{info}</div> : null}

            <form className="login-form" onSubmit={handleSignup}>
              <div className="form-group">
                <label className="auth-label active" htmlFor="username">Username</label>
                <div className="input-shell">
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                  />
                  <span className="input-icon"><UserIcon /></span>
                </div>
              </div>

              <div className="form-group">
                <label className="auth-label active" htmlFor="signup-email">Email</label>
                <div className="input-shell">
                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    autoComplete="email"
                    required
                    disabled={otpSent}
                  />
                  <span className="input-icon"><MailIcon /></span>
                </div>
              </div>

              <div className="form-group">
                <label className="auth-label active" htmlFor="signup-password">Password</label>
                <div className="input-shell">
                  <input
                    id="signup-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    required
                  />
                  <span className="input-icon"><KeyIcon /></span>
                </div>
              </div>

              <div className="form-group">
                <label className="auth-label active" htmlFor="confirm-password">Confirm Password</label>
                <div className="input-shell">
                  <input
                    id="confirm-password"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    required
                  />
                  <span className="input-icon"><KeyIcon /></span>
                </div>
              </div>

              {otpSent && (
                <div className="form-group">
                  <label className="auth-label active" htmlFor="otp">Verification Code</label>
                  <div className="input-shell">
                    <input
                      id="otp"
                      type="text"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      placeholder="Enter code from email"
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="login-btn" disabled={loading}>
                <span className={loading ? "button-text hidden" : "button-text"}>
                  {otpSent ? "Create account" : "Send verification code"}
                </span>
                {loading && <span className="button-spinner" />}
              </button>
            </form>

            <div className="auth-divider">
              <span />
              <small>Students only</small>
              <span />
            </div>
            <div className="form-footer">
              <p style={{ color: "rgba(30,64,175,0.7)", fontSize: "0.85rem", margin: 0 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  className="toggle-link"
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </p>
              <p style={{ color: "rgba(30,64,175,0.5)", fontSize: "0.78rem", marginTop: "8px" }}>
                Teacher accounts are created by the admin.
              </p>
            </div>
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

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

export default Signup;

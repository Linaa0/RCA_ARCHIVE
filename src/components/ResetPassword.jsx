import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api";
import "./Login.css";
import rcaLogo from "../rca.png";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const { token: routeToken = "" } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token") || routeToken || "";
    setToken(tokenParam);
  }, [searchParams, routeToken]);

  // If a token is in the URL it's a setup/reset link — detect if it's a teacher setup
  const isSetupFlow = Boolean(routeToken || searchParams.get("token"));
  const pageTitle = isSetupFlow ? "Set Password" : "Reset Password";
  const pageSubtitle = isSetupFlow
    ? "Welcome to RCA Archive. Create a password to activate your teacher account."
    : "Set a new password to restore access to your account.";
  const buttonLabel = isSetupFlow ? "Set Password" : "Reset Password";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset token is missing. Check your reset link.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/reset-password", {
        token,
        newPassword: password,
      });
      setSuccess(data.message || "Password reset successfully.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="archive-auth-shell">
        <ParticleCanvas />

        <div className={`auth-toast ${success ? "visible" : ""}`}>
          <CheckIcon />
          {success || "Password reset successfully!"}
        </div>

        <BrandPanel />

        <section className="auth-panel" aria-label="Reset password form">
          <div className="auth-card">
            <h1 className="form-title">{pageTitle}</h1>
            <p className="form-subtitle">{pageSubtitle}</p>

            <Message error={error} success={success && !loading ? success : ""} />

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="auth-label active" htmlFor="password">
                  New password
                </label>
                <div className="input-shell">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="form-group">
                <label className="auth-label active" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <div className="input-shell">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span 
                    className="input-icon" 
                    style={{ cursor: "pointer" }} 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </span>
                </div>
              </div>

              <SubmitButton loading={loading}>
                {buttonLabel}
              </SubmitButton>
            </form>

            <div className="auth-divider">
              <span />
              <small>or</small>
              <span />
            </div>

            <div className="form-footer">
              <button type="button" className="toggle-link" onClick={() => navigate("/login")}>
                ← Back to Login
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ParticleCanvas() {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current?.parentElement;
    if (!canvas || !shell) return undefined;

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let animationId = 0;
    let points = [];

    const resize = () => {
      width = canvas.width = shell.offsetWidth;
      height = canvas.height = shell.offsetHeight;
      points = Array.from({ length: 50 }, () => ({
        x: Math.random() * width * 0.45,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.4 + 0.4,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      points.forEach((point) => {
        point.x += point.vx;
        point.y += point.vy;

        if (point.x < 0 || point.x > width * 0.45) point.vx *= -1;
        if (point.y < 0 || point.y > height) point.vy *= -1;

        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(96,165,250,.3)";
        ctx.fill();
      });

      points.forEach((a, index) => {
        points.slice(index + 1).forEach((b) => {
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 75) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(96,165,250,${0.1 * (1 - distance / 75)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <span ref={shellRef} className="particle-anchor" aria-hidden="true">
      <canvas ref={canvasRef} className="particle-canvas" />
    </span>
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

    if (!deleting && charIndex === current.length) {
      delay = 1800;
    }

    const timeout = setTimeout(() => {
      if (!deleting && charIndex === current.length) {
        setDeleting(true);
        return;
      }

      if (deleting && charIndex === 0) {
        setDeleting(false);
        setPhraseIndex((value) => (value + 1) % phrases.length);
        return;
      }

      setCharIndex((value) => value + (deleting ? -1 : 1));
    }, delay);

    return () => clearTimeout(timeout);
  }, [charIndex, deleting, phraseIndex, phrases]);

  return <div className="typing-text">{phrases[phraseIndex].slice(0, charIndex)}</div>;
}

function SubmitButton({ children, loading }) {
  return (
    <button className="login-btn" type="submit" disabled={loading}>
      <span className={loading ? "button-text hidden" : "button-text"}>{children}</span>
      {loading && <span className="button-spinner" />}
    </button>
  );
}

function Message({ error, success }) {
  if (error) return <div className="error-msg">{error}</div>;
  if (success) return <div className="success-msg">{success}</div>;
  return null;
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

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3.5 3.5L11 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

export default ResetPassword;

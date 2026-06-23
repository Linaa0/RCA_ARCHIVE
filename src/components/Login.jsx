import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import api from "../api";
import rcaLogo from "../rca.png";

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [role, setRole] = useState("student");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpSending, setResetOtpSending] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [ripples, setRipples] = useState([]);
  const [otpPreviewUrl, setOtpPreviewUrl] = useState("");
  const navigate = useNavigate();

  const resetForm = () => {
    setRole("student");
    setUsername("");
    setEmail("");
    setPassword("");
    setOtp("");
    setOtpSent(false);
    setResetEmail("");
    setResetOtp("");
    setResetOtpSent(false);
    setOtpPreviewUrl("");
    setError("");
    setSuccess("");
    setShowPassword(false);
    setFocusedField("");
  };

  useEffect(() => {
    resetForm();
  }, []);

  const passwordStrength = useMemo(() => {
    if (!password) return { width: 0, color: "", label: "" };

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    const index = Math.min(score, 3);
    return {
      width: [25, 50, 75, 100][index],
      color: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"][index],
      label: ["Weak", "Fair", "Good", "Strong"][index],
    };
  }, [password]);

  const handleSendOtp = async (operation) => {
    setError("");
    setSuccess("");
    setOtpPreviewUrl("");

    const targetEmail = operation === "reset-password" ? resetEmail : email;
    
    if (!targetEmail) {
      setError(`Enter your email before requesting an OTP.`);
      return;
    }

    const sendingState = operation === "reset-password" ? setResetOtpSending : setOtpSending;
    const sentState = operation === "reset-password" ? setResetOtpSent : setOtpSent;
    
    sendingState(true);
    try {
      const { data } = await api.post("/send-otp", { email: targetEmail, operation });
      setSuccess(data.message);
      if (data.previewUrl) {
        setOtpPreviewUrl(data.previewUrl);
      }
      if (data.otp) {
        setOtp(data.otp);
      }
      sentState(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send OTP. Please try again.");
    } finally {
      sendingState(false);
    }
  };

  const addRipple = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = {
      id: Date.now(),
      size,
      left: event.clientX - rect.left - size / 2,
      top: event.clientY - rect.top - size / 2,
    };

    setRipples((items) => [...items, ripple]);
    setTimeout(() => {
      setRipples((items) => items.filter((item) => item.id !== ripple.id));
    }, 520);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isSignup && !username.trim()) {
      setError("Please enter the username you want to use in the system.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // Only require OTP for signup
    if (isSignup) {
      if (!otpSent) {
        setError(`Request OTP for your email before proceeding.`);
        return;
      }
      
      if (!otp) {
        setError("Enter the OTP sent to your email.");
        return;
      }
    }

    const endpoint = isSignup ? "/signup" : "/login";
    const payload = isSignup 
      ? { email, password, role, username, otp }
      : { email, password };

    setLoading(true);
    try {
      const { data } = await api.post(endpoint, payload);

      if (isSignup) {
        setSuccess(
          `Account created successfully! Role assigned: ${data.role}. You can now log in.`
        );
        setIsSignup(false);
        setUsername("");
        setEmail("");
        setPassword("");
        setOtp("");
        setOtpSent(false);
        setShowPassword(false);
      } else {
        setSuccess("Logged in! Redirecting...");
        localStorage.setItem("token", data.token);
        localStorage.setItem("email", data.email);
        localStorage.setItem("username", data.username);
        localStorage.setItem("role", data.role);
        setTimeout(() => {
          navigate("/");
          window.location.reload();
        }, 650);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    
    if (!resetOtpSent) {
      setError("Request OTP first before setting new password.");
      return;
    }
    
    if (!resetOtp) {
      setError("Enter the OTP sent to your email.");
      return;
    }
    
    if (!password) {
      setError("Enter your new password.");
      return;
    }
    
    setLoading(true);

    try {
      const { data } = await api.post("/reset-password", { 
        email: resetEmail, 
        otp: resetOtp, 
        newPassword: password 
      });
      setSuccess(data.message || "Password reset successfully! You can now log in.");
      setResetEmail("");
      setResetOtp("");
      setResetOtpSent(false);
      setPassword("");
      setTimeout(() => {
        setIsForgotPassword(false);
        resetForm();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignup((value) => !value);
    setIsForgotPassword(false);
    resetForm();
  };

  return (
    <main className="login-page">
      <div className="archive-auth-shell">
        <ParticleCanvas />

        <div className={`auth-toast ${success ? "visible" : ""}`}>
          <CheckIcon />
          {success || "Logged in! Redirecting..."}
        </div>

        <BrandPanel />

        <section className="auth-panel" aria-label={isSignup ? "Sign up form" : "Login form"}>
          <div className="auth-card">
            {isForgotPassword ? (
              <>
                <button className="back-btn" type="button" onClick={() => { setIsForgotPassword(false); resetForm(); }}>
                  Back to Login
                </button>
                <h1 className="form-title">Reset password</h1>
                <p className="form-subtitle">Enter your email, verify with OTP, and set a new password.</p>

                <Message error={error} success={success} previewUrl={otpPreviewUrl} />

                <form className="login-form" onSubmit={handleForgotPassword}>
                  <Field
                    id="reset-email"
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    focusedField={focusedField}
                    icon={<MailIcon />}
                    onFocus={() => setFocusedField("reset-email")}
                    onBlur={() => setFocusedField("")}
                    onChange={(event) => {
                      setResetEmail(event.target.value);
                      setResetOtpSent(false);
                      setResetOtp("");
                    }}
                    required
                  />
                  
                  {!resetOtpSent ? (
                    <button
                      type="button"
                      className="otp-btn"
                      onClick={() => handleSendOtp("reset-password")}
                      disabled={loading || resetOtpSending}
                      style={{ marginBottom: "16px" }}
                    >
                      {resetOtpSending ? "Sending OTP..." : "Send OTP"}
                    </button>
                  ) : (
                    <>
                      <Field
                        id="reset-otp"
                        label="OTP Code"
                        type="text"
                        placeholder="Enter OTP from email"
                        value={resetOtp}
                        focusedField={focusedField}
                        icon={<KeyIcon />}
                        onFocus={() => setFocusedField("reset-otp")}
                        onBlur={() => setFocusedField("")}
                        onChange={(event) => setResetOtp(event.target.value)}
                        required
                      />
                      <div className="form-group">
                        <label className={focusedField === "reset-password" ? "auth-label active" : "auth-label"} htmlFor="reset-password">
                          New Password
                        </label>
                        <div className="input-shell">
                          <input
                            id="reset-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            value={password}
                            onFocus={() => setFocusedField("reset-password")}
                            onBlur={() => setFocusedField("")}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                          />
                          <button
                            className="toggle-password"
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                      </div>
                      <SubmitButton loading={loading} onClick={addRipple} ripples={ripples}>
                        Reset Password
                      </SubmitButton>
                    </>
                  )}
                </form>
              </>
            ) : (
              <>
                <h1 className="form-title">{isSignup ? "Create account" : "Welcome back"}</h1>
                <p className="form-subtitle">
                  {isSignup ? "Sign up to get access to all materials" : "Log in to your account"}
                </p>

                <Message error={error} success={success && !loading ? success : ""} previewUrl={otpPreviewUrl} />

                <form className="login-form" onSubmit={handleSubmit}>
                  {isSignup && (
                    <div className="form-group">
                      <label className="auth-label">Account type</label>
                      <div className="role-select-row">
                        {["student", "teacher"].map((item) => (
                          <label key={item} className={`role-option ${role === item ? "active" : ""}`}>
                            <input
                              type="radio"
                              name="role"
                              value={item}
                              checked={role === item}
                              onChange={() => {
                                setRole(item);
                                setOtpSent(false);
                                setOtp("");
                              }}
                            />
                            {item}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSignup && (
                    <Field
                      id="username"
                      label="Username"
                      type="text"
                      placeholder="Enter your display name"
                      value={username}
                      focusedField={focusedField}
                      icon={<UserIcon />}
                      onFocus={() => setFocusedField("username")}
                      onBlur={() => setFocusedField("")}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                  )}

                  <Field
                    id="email"
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    focusedField={focusedField}
                    icon={<MailIcon />}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField("")}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setOtpSent(false);
                      setOtp("");
                    }}
                    required
                  />

                  <div className="form-group">
                    <label className={focusedField === "password" ? "auth-label active" : "auth-label"} htmlFor="password">
                      Password
                    </label>
                    <div className="input-shell">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField("")}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <button
                        className="toggle-password"
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {isSignup && (
                      <>
                        <div className="strength-track">
                          <span
                            className="strength-fill"
                            style={{
                              width: `${passwordStrength.width}%`,
                              backgroundColor: passwordStrength.color,
                            }}
                          />
                        </div>
                        <div className="strength-label" style={{ color: passwordStrength.color }}>
                          {passwordStrength.label}
                        </div>
                      </>
                    )}
                  </div>

                  {isSignup && (
                    <div className="teacher-otp-block open">
                      {!otpSent ? (
                        <button
                          type="button"
                          className="otp-btn"
                          onClick={() => handleSendOtp("signup")}
                          disabled={loading || otpSending}
                        >
                          {otpSending ? "Sending OTP..." : "Request OTP"}
                        </button>
                      ) : (
                        <Field
                          id="otp"
                          label="OTP Code"
                          type="text"
                          placeholder="Enter OTP from email"
                          value={otp}
                          focusedField={focusedField}
                          icon={<KeyIcon />}
                          onFocus={() => setFocusedField("otp")}
                          onBlur={() => setFocusedField("")}
                          onChange={(event) => setOtp(event.target.value)}
                          required
                        />
                      )}

                      <div className="form-info-box">
                        All signups require OTP verification via email for security.
                      </div>
                    </div>
                  )}

                  {!isSignup && (
                    <div className="forgot-password-row">
                      <button
                        type="button"
                        className="forgot-link"
                        onClick={() => {
                          setIsForgotPassword(true);
                          resetForm();
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <SubmitButton loading={loading} onClick={addRipple} ripples={ripples}>
                    {isSignup ? "Create Account" : "Log In"}
                  </SubmitButton>
                </form>

                <div className="auth-divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>

                <div className="form-footer">
                  {isSignup ? "Already have an account? " : "Don't have an account? "}
                  <button type="button" className="toggle-link" onClick={switchMode}>
                    {isSignup ? "Log in" : "Sign up"}
                  </button>
                </div>
              </>
            )}
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
        <StatCard value="200+" label="Students" />
        <StatCard value="300+" label="Papers" />
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

function Field({ id, label, icon, focusedField, ...props }) {
  return (
    <div className="form-group">
      <label className={focusedField === id ? "auth-label active" : "auth-label"} htmlFor={id}>
        {label}
      </label>
      <div className="input-shell">
        <input id={id} autoComplete="off" {...props} />
        <span className="input-icon">{icon}</span>
      </div>
    </div>
  );
}

function SubmitButton({ children, loading, onClick, ripples }) {
  return (
    <button className="login-btn" type="submit" disabled={loading} onClick={onClick}>
      <span className={loading ? "button-text hidden" : "button-text"}>{children}</span>
      {loading && <span className="button-spinner" />}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple-el"
          style={{
            width: ripple.size,
            height: ripple.size,
            left: ripple.left,
            top: ripple.top,
          }}
        />
      ))}
    </button>
  );
}

function Message({ error, success, previewUrl }) {
  return (
    <>
      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}
      {previewUrl && (
        <div className="form-info-box" style={{ marginTop: "12px", wordBreak: "break-all" }}>
          <strong>Preview URL:</strong>{" "}
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
            {previewUrl}
          </a>
        </div>
      )}
    </>
  );
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

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
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

export default Login;

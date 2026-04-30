import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    resetForm();
  }, []);

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setResetEmail("");
    setError("");
    setSuccess("");
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const endpoint = isSignup ? "/api/signup" : "/api/login";
    const payload = isSignup
      ? { username, email, password, role }
      : { username, password };

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      if (isSignup) {
        setSuccess("Account created successfully! Please log in with your credentials.");
        setUsername("");
        setEmail("");
        setPassword("");
        setIsSignup(false);
        setShowPassword(false);
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("role", data.role);
        navigate("/");
        window.location.reload();
      }
    } catch (err) {
      setError("Cannot connect to server. Make sure backend is running.");
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess("Password reset link sent. Please check your email.");
        setResetEmail("");
      }
    } catch (err) {
      setError("Cannot connect to server. Make sure backend is running.");
    }

    setLoading(false);
  };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  return (
    <div className="login-container">
      {/* Left Section - Branding */}
      <div className="login-branding">
        <div className="branding-content">
          <div className="logo-container">
            <img src="/rwandacoding.png" alt="Rwanda Coding Logo" className="rca-logo" />
          </div>
          <h1 className="brand-title">RCA ARCHIVE+</h1>
          <p className="brand-subtitle">Rwanda Coding Academy</p>
          <p className="brand-description">
            Access comprehensive past papers, notes, and study materials for all years
          </p>
          <div className="brand-features">
            <div className="feature">
              <span className="feature-icon">•</span>
              <span>Complete Study Materials</span>
            </div>
            <div className="feature">
              <span className="feature-icon">•</span>
              <span>Past Exam Papers</span>
            </div>
            <div className="feature">
              <span className="feature-icon">•</span>
              <span>Quality Resources</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Form */}
      <div className="login-form-section">
        <div className="login-box">

          {/* ── FORGOT PASSWORD FORM ── */}
          {isForgotPassword ? (
            <>
              <button className="back-btn" onClick={() => { setIsForgotPassword(false); resetForm(); }}>
                ← Back to Login
              </button>
              <h2 className="form-title">Reset Password</h2>
              <p className="form-subtitle">Enter your email and we'll send you a reset link</p>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <form onSubmit={handleForgotPassword} className="login-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* ── LOGIN / SIGNUP FORM ── */}
              <h2 className="form-title">
                {isSignup ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="form-subtitle">
                {isSignup
                  ? "Sign up to get access to all materials"
                  : "Log in to your account"}
              </p>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                {isSignup && (
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {/* Forgot password — only on login */}
                {!isSignup && (
                  <div className="forgot-password-row">
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => { setIsForgotPassword(true); resetForm(); }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {isSignup && (
                  <div className="form-group">
                    <label>I am a</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                )}

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? "Please wait..." : isSignup ? "Create Account" : "Log In"}
                </button>
              </form>

              <div className="form-footer">
                <p>
                  {isSignup ? "Already have an account? " : "Don't have an account? "}
                  <button
                    className="toggle-link"
                    onClick={() => {
                      setIsSignup(!isSignup);
                      resetForm();
                    }}
                  >
                    {isSignup ? "Log In" : "Sign Up"}
                  </button>
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default Login;
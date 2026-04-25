import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        setSuccess("✅ Account created successfully! Now please log in with your credentials.");
        setUsername("");
        setEmail("");
        setPassword("");
        setIsSignup(false);
      } else {
        // Save token and user info
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

  return (
    <div className="login-container">
      {/* Left Section - Branding */}
      <div className="login-branding">
        <div className="branding-content">
          <div className="logo-container">
            <img src="/rca-logo.png" alt="RCA Logo" className="rca-logo" />
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
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

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
                  setError(""); 
                  setSuccess("");
                  setUsername("");
                  setEmail("");
                  setPassword("");
                }}
              >
                {isSignup ? "Log In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
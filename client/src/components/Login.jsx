import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthBrandPanel from "./ui/AuthBrandPanel";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { EyeIcon } from "./ui/Icons";
import { persistAuth } from "../utils/auth";
import api from "../services/api";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get("redirect") || "/home";

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/login", {
        identifier: identifier.trim(),
        email: identifier.trim(),
        password,
      });

      // Persist auth tokens & user session
      persistAuth(data);

      const userRole = data.user?.role || data.role;
      if (userRole === "admin") {
        navigate(redirectTarget === "/home" ? "/admin" : redirectTarget, { replace: true });
      } else {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      let msg = "Invalid email/username or password.";
      if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
        msg = "Network Error: Could not connect to the backend server. Please check your internet connection or verify the API server is reachable.";
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* ── Left Premium Indigo Mesh Panel ── */}
      <AuthBrandPanel />

      {/* ── Right Auth Form Panel (Compact, 100dvh) ── */}
      <section className="auth-form-pane">
        <div className="auth-form-card">
          {/* Back to Home Link */}
          <Link to="/" className="auth-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to Portal</span>
          </Link>

          <h2 className="auth-form-title">Sign in to Archive</h2>
          <p className="auth-form-subtitle">
            Enter your RCA student or faculty credentials to access past papers and study materials.
          </p>

          {error && <div className="auth-alert-error">{error}</div>}

          <form onSubmit={handleLogin} className="compact-auth-form">
            <Input
              label="Email or Username"
              placeholder="e.g. grace.stanley@rca.ac.rw"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError("");
              }}
              required
              autoFocus
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6A7399" }}
                  >
                    <EyeIcon size={16} />
                  </button>
                }
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                <Link
                  to="/reset-password"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--color-indigo-700, #3F4FA8)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={loading}
              style={{ width: "100%", marginTop: "12px" }}
            >
              Sign In to Account
            </Button>

            <div className="auth-switch-prompt">
              Don't have an account yet?{" "}
              <Link to="/signup">Register Now</Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthBrandPanel from "./ui/AuthBrandPanel";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { EyeIcon } from "./ui/Icons";
import { persistAuth, getHomePathForRole } from "../utils/auth";
import api, { getApiErrorMessage } from "../services/api";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get("redirect");
  const emailParam = searchParams.get("email");

  const [identifier, setIdentifier] = useState(
    () => location.state?.email || emailParam || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const notice = typeof window !== "undefined" ? sessionStorage.getItem("login_notice") : null;
    if (notice) {
      sessionStorage.removeItem("login_notice");
      return notice;
    }
    return "";
  });
  const [successMsg, setSuccessMsg] = useState(
    () => location.state?.message || ""
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/login", {
        email: identifier.trim().toLowerCase(),
        password,
      });

      // Persist auth tokens and user session
      persistAuth(data);

      const role = data.role || data.user?.role;
      const home = getHomePathForRole(role);
      const canUseRedirect = redirectTarget && role === "student";
      navigate(canUseRedirect ? redirectTarget : home, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid email or password."));
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
          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "14px" }}>
            <Link to="/" className="auth-back-link" style={{ margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Back to Portal</span>
            </Link>
          </div>

          <h2 className="auth-form-title">Sign in to Archive</h2>
          <p className="auth-form-subtitle">
            Enter your RCA student or faculty credentials to access past papers and study materials.
          </p>

          {successMsg && !error && (
            <div className="auth-alert-info" style={{ marginBottom: "14px" }}>
              {successMsg}
            </div>
          )}

          {error && <div className="auth-alert-error">{error}</div>}

          <form onSubmit={handleLogin} className="compact-auth-form">
            <Input
              id="login-email"
              name="email"
              label="Email"
              placeholder="e.g. yourname@gmail.com"
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
                id="login-password"
                name="password"
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
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}
                    aria-label="Toggle password visibility"
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
                    color: "var(--color-primary)",
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
              style={{ width: "100%", marginTop: "10px" }}
            >
              Sign In to Account
            </Button>

            <div className="auth-switch-prompt">
              Do not have an account yet?{" "}
              <Link to="/signup">Register Now</Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

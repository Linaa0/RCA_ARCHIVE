import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import AuthBrandPanel from "./ui/AuthBrandPanel";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { EyeIcon } from "./ui/Icons";
import api from "../services/api";
import "./Login.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const { token: routeToken = "" } = useParams();
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const tokenParam = searchParams.get("token") || routeToken || "";
    setToken(tokenParam);
  }, [searchParams, routeToken]);

  const isTokenFlow = Boolean(token);

  // Request reset link (when no token)
  const handleRequestResetLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/forgot-password", {
        email: email.trim(),
      });
      setSuccess(
        data?.message ||
        "A password recovery link has been dispatched to your email address."
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to send recovery link."
      );
    } finally {
      setLoading(false);
    }
  };

  // Set new password (when token is provided)
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/reset-password", {
        token,
        newPassword: password,
      });
      setSuccess(data?.message || "Password updated successfully.");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Password setup link is invalid or has expired."
      );
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
          <Link to="/login" className="auth-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to Sign In</span>
          </Link>

          <h2 className="auth-form-title">
            {isTokenFlow ? "Set Account Password" : "Reset Password"}
          </h2>
          <p className="auth-form-subtitle">
            {isTokenFlow
              ? "Create a secure password to activate or restore access to your account."
              : "Enter your registered email address to receive password recovery instructions."}
          </p>

          {error && <div className="auth-alert-error">{error}</div>}
          {success && <div className="auth-alert-info">{success}</div>}

          {!isTokenFlow ? (
            <form onSubmit={handleRequestResetLink} className="compact-auth-form">
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="student@rca.ac.rw"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                required
                autoFocus
              />

              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={loading}
                style={{ width: "100%", marginTop: "10px" }}
              >
                Send Password Recovery Link
              </Button>

              <div className="auth-switch-prompt">
                Remember your credentials? <Link to="/login">Sign In</Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetNewPassword} className="compact-auth-form">
              <Input
                label="New Password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                autoFocus
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

              <Input
                label="Confirm New Password"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
              />

              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={loading}
                style={{ width: "100%", marginTop: "10px" }}
              >
                Save New Password
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

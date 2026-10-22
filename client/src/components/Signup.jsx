import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthBrandPanel from "./ui/AuthBrandPanel";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";
import { RCA_CLASSES } from "./ui/ClassChips";
import { CheckIcon, EyeIcon } from "./ui/Icons";
import api from "../services/api";
import "./Login.css";

export default function Signup() {
  const navigate = useNavigate();

  // Step 1: name + email
  // Step 2: password + confirmPassword + class
  // Step 3: 6-digit OTP
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    class: "Y1A",
  });

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const otpInputsRef = useRef([]);

  // Resend countdown timer for Step 3
  useEffect(() => {
    let interval;
    if (step === 3 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  // Password strength meter
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    if (!pwd) return { score: 0, label: "Too short", color: "#EF4444" };
    let s = 0;
    if (pwd.length >= 8) s += 1;
    if (/[A-Z]/.test(pwd)) s += 1;
    if (/[0-9]/.test(pwd)) s += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) s += 1;

    if (s <= 1) return { score: 25, label: "Weak", color: "#EF4444" };
    if (s === 2) return { score: 50, label: "Fair", color: "#F59E0B" };
    if (s === 3) return { score: 75, label: "Good", color: "#3B82F6" };
    return { score: 100, label: "Strong", color: "#10B981" };
  }, [formData.password]);

  // Advance from Step 1 to Step 2
  const handleNextStep1 = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setStep(2);
  };

  // Advance from Step 2 to Step 3: Send OTP
  const handleSendOtpStep2 = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/send-otp", {
        email: formData.email.trim(),
        operation: "signup",
      });
      setResendTimer(60);
      setStep(3);
      if (data?.developmentOtpBypass) {
        setInfo(
          "Development mode: enter any 6-digit code. Email verification is required on the live site."
        );
      } else if (data?.previewUrl) {
        setInfo("Development OTP preview is available in the server logs.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to send verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/send-otp", {
        email: formData.email.trim(),
        operation: "signup",
      });
      setResendTimer(60);
      setInfo(
        data?.developmentOtpBypass
          ? "Development mode: enter any 6-digit code. Email verification is required on the live site."
          : "A new verification code has been dispatched."
      );
    } catch (err) {
      setError(err.response?.data?.error || "Unable to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Handle segmented OTP input
  const handleOtpDigitChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Submit Step 3: Complete Registration
  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    const otpCode = otpDigits.join("");
    if (otpCode.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/signup", {
        username: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        class: formData.class,
        otp: otpCode,
      });

      setSignupSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 1600);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Verification failed. Please check the code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* ── Left Premium Indigo Mesh Panel ── */}
      <AuthBrandPanel />

      {/* ── Right Auth Form Panel (Strict 100dvh, Compact, No Scroll) ── */}
      <section className="auth-form-pane">
        <div className="auth-form-card">
          {/* Back Link */}
          <Link to="/" className="auth-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to Portal</span>
          </Link>

          {/* Wizard Step Progress Indicator */}
          <div className="wizard-progress-bar">
            {[1, 2, 3].map((s) => {
              const isPassed = step > s || signupSuccess;
              const isCurrent = step === s && !signupSuccess;
              return (
                <div key={s} className="wizard-step-node">
                  <div
                    className={`step-bubble ${
                      isPassed ? "completed" : isCurrent ? "active" : ""
                    }`}
                  >
                    {isPassed ? <CheckIcon size={12} /> : s}
                  </div>
                  <span className="step-label">
                    {s === 1 ? "Identity" : s === 2 ? "Security" : "Verify"}
                  </span>
                  {s < 3 && <div className={`step-line ${step > s ? "filled" : ""}`} />}
                </div>
              );
            })}
          </div>

          <h2 className="auth-form-title">
            {signupSuccess
              ? "Account Created!"
              : step === 1
              ? "Create your account"
              : step === 2
              ? "Set password & class"
              : "Enter verification code"}
          </h2>
          <p className="auth-form-subtitle">
            {signupSuccess
              ? "Redirecting you to login..."
              : step === 1
              ? "Step 1 of 3: Provide your academy student identity."
              : step === 2
              ? "Step 2 of 3: Choose your cohort class and security."
              : "Step 3 of 3: Enter the 6-digit verification code."}
          </p>

          {error && <div className="auth-alert-error">{error}</div>}
          {info && !error && <div className="auth-alert-info">{info}</div>}

          {/* ── STEP 1: Name + Email ── */}
          {step === 1 && !signupSuccess && (
            <form onSubmit={handleNextStep1} className="compact-auth-form">
              <Input
                label="Full Name"
                name="name"
                placeholder="e.g. Grace Stanley"
                value={formData.name}
                onChange={handleChange}
                required
                autoFocus
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                placeholder="student@rca.ac.rw"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <Button
                variant="primary"
                size="md"
                type="submit"
                style={{ width: "100%", marginTop: "8px" }}
              >
                Continue to Password →
              </Button>

              <div className="auth-switch-prompt">
                Already registered? <Link to="/login">Sign In</Link>
              </div>
            </form>
          )}

          {/* ── STEP 2: Password, Confirm, Class Selector ── */}
          {step === 2 && !signupSuccess && (
            <form onSubmit={handleSendOtpStep2} className="compact-auth-form">
              <div style={{ position: "relative" }}>
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoFocus
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
                {/* Password strength meter */}
                {formData.password && (
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#6A7399", marginBottom: "3px" }}>
                      <span>Strength</span>
                      <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "#E7EBF5", borderRadius: "999px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${passwordStrength.score}%`,
                          background: passwordStrength.color,
                          transition: "width 0.25s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Input
                label="Confirm Password"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />

              <Select
                label="Assigned Cohort Class"
                name="class"
                value={formData.class}
                onChange={handleChange}
                options={RCA_CLASSES.map((c) => ({
                  value: c.id,
                  label: `${c.label} (Year ${c.year})`,
                }))}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  ← Back
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={loading}
                  style={{ flex: 2 }}
                >
                  Send OTP Code
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Segmented 6-digit OTP Input ── */}
          {step === 3 && !signupSuccess && (
            <form onSubmit={handleCompleteSignup} className="compact-auth-form">
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-ink, #1B2142)", display: "block", marginBottom: "8px" }}>
                6-Digit Verification Code
              </label>

              {/* Segmented Inputs */}
              <div className="segmented-otp-row">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="otp-digit-box"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#6A7399", margin: "10px 0" }}>
                <span>Didn't receive code?</span>
                {resendTimer > 0 ? (
                  <span>Resend in {resendTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    style={{ background: "none", border: "none", color: "#3F4FA8", fontWeight: 700, cursor: "pointer" }}
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setStep(2)}
                  style={{ flex: 1 }}
                >
                  ← Back
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={loading}
                  style={{ flex: 2 }}
                >
                  Complete Registration
                </Button>
              </div>
            </form>
          )}

          {/* Success State */}
          {signupSuccess && (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10B981",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                <CheckIcon size={28} />
              </div>
              <p style={{ color: "#6A7399", fontSize: "0.92rem" }}>
                Your account is ready! Taking you to the sign-in screen...
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

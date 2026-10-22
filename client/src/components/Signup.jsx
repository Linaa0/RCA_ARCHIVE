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

  // 3-step registration wizard
  // Step 1: full name + email
  // Step 2: username + password with strength meter + class selection
  // Step 3: 6-digit OTP in segmented input with resend timer
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
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
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-suggest username if untouched
      if (name === "email" && !prev.username && value.includes("@")) {
        next.username = value.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
      }
      return next;
    });
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

  // Step 1 -> Step 2
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
    if (!formData.username.trim()) {
      const defaultUser = formData.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
      setFormData((prev) => ({ ...prev, username: defaultUser }));
    }
    setError("");
    setStep(2);
  };

  // Step 2 -> Step 3: Send OTP
  const handleSendOtpStep2 = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setError("Please enter a username.");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
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
      if (data?.previewUrl) {
        setInfo("Verification code dispatched to your email.");
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
      await api.post("/send-otp", {
        email: formData.email.trim(),
        operation: "signup",
      });
      setResendTimer(60);
      setInfo("A new verification code has been dispatched.");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to resend code.");
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
        username: formData.username.trim(),
        fullName: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        class: formData.class,
        otp: otpCode,
      });

      setSignupSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 1500);
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
      {/* ── Left Premium Indigo Mesh Panel with Rotating Shelf ── */}
      <AuthBrandPanel />

      {/* ── Right Auth Form Panel (Compact, 100dvh, No Scroll) ── */}
      <section className="auth-form-pane">
        <div className="auth-form-card">
          {/* Back to Portal Link */}
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
                    {s === 1 ? "Identity" : s === 2 ? "Account" : "Verify"}
                  </span>
                  {s < 3 && <div className={`step-line ${step > s ? "filled" : ""}`} />}
                </div>
              );
            })}
          </div>

          <h2 className="auth-form-title">
            {signupSuccess
              ? "Account Created"
              : step === 1
              ? "Student Registration"
              : step === 2
              ? "Username and Security"
              : "Verify Email Code"}
          </h2>
          <p className="auth-form-subtitle">
            {signupSuccess
              ? "Redirecting you to sign in..."
              : step === 1
              ? "Step 1 of 3: Provide your full name and student email."
              : step === 2
              ? "Step 2 of 3: Pick a username, password, and class cohort."
              : "Step 3 of 3: Enter the 6 digit code sent to your inbox."}
          </p>

          {error && <div className="auth-alert-error">{error}</div>}
          {info && !error && <div className="auth-alert-info">{info}</div>}

          {/* ── STEP 1: Full Name and Email ── */}
          {step === 1 && !signupSuccess && (
            <form onSubmit={handleNextStep1} className="compact-auth-form">
              <Input
                label="Full Name"
                name="name"
                placeholder="e.g. Jean Dupont"
                value={formData.name}
                onChange={handleChange}
                required
                autoFocus
              />

              <Input
                label="Student Email Address"
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
                style={{ width: "100%", marginTop: "6px" }}
              >
                Continue to Account Setup
              </Button>

              <div className="auth-switch-prompt">
                Already registered? <Link to="/login">Sign In</Link>
              </div>
            </form>
          )}

          {/* ── STEP 2: Username, Password with Strength Meter, and Class ── */}
          {step === 2 && !signupSuccess && (
            <form onSubmit={handleSendOtpStep2} className="compact-auth-form">
              <Input
                label="Username"
                name="username"
                placeholder="e.g. jdupont"
                value={formData.username}
                onChange={handleChange}
                required
                autoFocus
              />

              <div>
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
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
                {formData.password && (
                  <div style={{ marginTop: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--color-text-tertiary)", marginBottom: "3px" }}>
                      <span>Strength</span>
                      <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "var(--color-border)", borderRadius: "999px", overflow: "hidden" }}>
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

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  Back
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

          {/* ── STEP 3: Segmented 6-digit OTP ── */}
          {step === 3 && !signupSuccess && (
            <form onSubmit={handleCompleteSignup} className="compact-auth-form">
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-primary)", display: "block" }}>
                6 Digit Verification Code
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: "4px 0" }}>
                <span>Did not receive code?</span>
                {resendTimer > 0 ? (
                  <span>Resend in {resendTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setStep(2)}
                  style={{ flex: 1 }}
                >
                  Back
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
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10B981",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                <CheckIcon size={26} />
              </div>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.92rem" }}>
                Your account is ready. Taking you to the sign-in screen...
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

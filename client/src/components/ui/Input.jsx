import React, { useState } from "react";

export default function Input({
  label,
  error,
  helperText,
  icon,
  iconRight,
  id,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  style = {},
  inputStyle = {},
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type;
  const inputId = id || (name ? `input-${name}` : undefined);

  return (
    <div
      className={`rca-input-group ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: error ? "var(--color-danger, #EF4444)" : "var(--color-ink, #1B2142)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--color-danger, #EF4444)" }}>*</span>}
        </label>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: "100%",
        }}
      >
        {icon && (
          <span
            style={{
              position: "absolute",
              left: "14px",
              color: "var(--color-muted, #6A7399)",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {icon}
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={actualType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          style={{
            width: "100%",
            height: "46px",
            padding: `0 ${iconRight || isPassword ? "42px" : "16px"} 0 ${icon ? "42px" : "16px"}`,
            borderRadius: "var(--radius-input, 14px)",
            border: error
              ? "1.5px solid var(--color-danger, #EF4444)"
              : "1.5px solid var(--color-border-med, rgba(63, 79, 168, 0.16))",
            backgroundColor: disabled
              ? "var(--color-bg-subtle, #E6E9F2)"
              : "var(--color-surface, #FFFFFF)",
            color: "var(--color-ink, #1B2142)",
            fontFamily: "inherit",
            fontSize: "0.925rem",
            fontWeight: 500,
            outline: "none",
            transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
            boxShadow: error
              ? "0 0 0 3px var(--color-danger-bg, rgba(239, 68, 68, 0.15))"
              : "var(--shadow-xs)",
            ...inputStyle,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--color-indigo-500, #3F4FA8)";
              e.currentTarget.style.boxShadow = "var(--focus-ring)";
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--color-border-med, rgba(63, 79, 168, 0.16))";
              e.currentTarget.style.boxShadow = "var(--shadow-xs)";
            }
          }}
          {...props}
        />

        {iconRight ? (
          <span
            style={{
              position: "absolute",
              right: "14px",
              color: "var(--color-muted, #6A7399)",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              zIndex: 1,
            }}
          >
            {iconRight}
          </span>
        ) : isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: "12px",
              background: "transparent",
              border: "none",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-muted, #6A7399)",
              cursor: "pointer",
              borderRadius: "6px",
              zIndex: 1,
            }}
          >
            {showPassword ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>

      {(error || helperText) && (
        <span
          style={{
            fontSize: "0.8rem",
            color: error ? "var(--color-danger, #EF4444)" : "var(--color-muted, #6A7399)",
            fontWeight: 500,
            marginTop: "2px",
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
}

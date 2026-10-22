import React from "react";

export default function Select({
  label,
  error,
  helperText,
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  options = [],
  children,
  className = "",
  style = {},
  selectStyle = {},
  ...props
}) {
  const selectId = id || (name ? `select-${name}` : undefined);

  return (
    <div
      className={`rca-select-group ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--color-ink, #1B2142)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {label}
          {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative", width: "100%" }}>
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          style={{
            width: "100%",
            height: "46px",
            padding: "0 38px 0 16px",
            borderRadius: "var(--radius-input, 16px)",
            border: error
              ? "1.5px solid #EF4444"
              : "1px solid rgba(63, 79, 168, 0.16)",
            background: disabled ? "var(--color-bg, #EEF0F6)" : "#FFFFFF",
            color: "var(--color-ink, #1B2142)",
            fontSize: "0.92rem",
            outline: "none",
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: error
              ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
              : "0 1px 3px rgba(35, 44, 107, 0.04)",
            ...selectStyle,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--color-indigo-500, #5B73E0)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91, 115, 224, 0.22)";
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "rgba(63, 79, 168, 0.16)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(35, 44, 107, 0.04)";
            }
          }}
          {...props}
        >
          {children ||
            options.map((opt) => {
              const optVal = typeof opt === "object" ? opt.value : opt;
              const optLabel = typeof opt === "object" ? opt.label : opt;
              return (
                <option key={optVal} value={optVal}>
                  {optLabel}
                </option>
              );
            })}
        </select>

        {/* Custom Chevron Arrow */}
        <span
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--color-muted, #6A7399)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {error ? (
        <span style={{ fontSize: "0.78rem", color: "#EF4444", fontWeight: 500 }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: "0.78rem", color: "var(--color-muted, #6A7399)" }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

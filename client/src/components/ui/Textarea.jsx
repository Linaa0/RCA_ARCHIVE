import React from "react";

export default function Textarea({
  label,
  error,
  helperText,
  rows = 4,
  maxLength,
  value = "",
  onChange,
  disabled = false,
  required = false,
  className = "",
  id,
  style = {},
  ...props
}) {
  const inputId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div
      className={`rca-textarea-group ${className}`}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            htmlFor={inputId}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: error ? "var(--color-danger, #EF4444)" : "var(--color-ink, #1B2142)",
            }}
          >
            {label}
            {required && <span style={{ color: "var(--color-danger, #EF4444)", marginLeft: "4px" }}>*</span>}
          </label>
          {maxLength && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-muted, #6A7399)",
                fontFamily: "var(--font-numeric, monospace)",
              }}
            >
              {String(value || "").length} / {maxLength}
            </span>
          )}
        </div>
      )}

      <textarea
        id={inputId}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        style={{
          width: "100%",
          padding: "12px 16px",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          fontWeight: 500,
          color: "var(--color-ink, #1B2142)",
          backgroundColor: disabled ? "var(--color-bg-subtle, #E6E9F2)" : "var(--color-surface, #FFFFFF)",
          border: error
            ? "1.5px solid var(--color-danger, #EF4444)"
            : "1.5px solid var(--color-border-med, rgba(63, 79, 168, 0.16))",
          borderRadius: "var(--radius-input, 14px)",
          boxShadow: "var(--shadow-xs, 0 1px 3px rgba(35, 44, 107, 0.04))",
          resize: "vertical",
          minHeight: "90px",
          outline: "none",
          transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
        }}
        {...props}
      />

      {(error || helperText) && (
        <span
          style={{
            fontSize: "0.8rem",
            color: error ? "var(--color-danger, #EF4444)" : "var(--color-muted, #6A7399)",
            fontWeight: 500,
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
}

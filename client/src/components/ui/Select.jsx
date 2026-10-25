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
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={selectId}
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
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
            boxShadow: error
              ? "0 0 0 3px var(--color-danger-bg, rgba(239, 68, 68, 0.15))"
              : "var(--shadow-xs)",
            ...selectStyle,
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

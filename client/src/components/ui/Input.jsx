import React from "react";

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
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          style={{
            width: "100%",
            height: "46px",
            padding: `0 ${iconRight ? "40px" : "16px"} 0 ${icon ? "42px" : "16px"}`,
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
              e.currentTarget.style.borderColor = "var(--color-indigo-500, #5B73E0)";
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

        {iconRight && (
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
        )}
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

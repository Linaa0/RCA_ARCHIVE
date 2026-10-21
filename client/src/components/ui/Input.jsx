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
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
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
            borderRadius: "var(--radius-input, 16px)",
            border: error
              ? "1.5px solid #EF4444"
              : "1px solid rgba(63, 79, 168, 0.16)",
            background: disabled ? "var(--color-bg, #EEF0F6)" : "#FFFFFF",
            color: "var(--color-ink, #1B2142)",
            fontSize: "0.92rem",
            outline: "none",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: error
              ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
              : "0 1px 3px rgba(35, 44, 107, 0.04)",
            ...inputStyle,
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
        />

        {iconRight && (
          <span
            style={{
              position: "absolute",
              right: "14px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {iconRight}
          </span>
        )}
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

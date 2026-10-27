import React from "react";
import { getTerms, normalizeTerm } from "../../services/curriculum";
import "./TermSelector.css";

export default function TermSelector({
  value,
  onChange,
  error = "",
  disabled = false,
  required = true,
  id = "term-selector",
  label = "Which term is this for?",
}) {
  const terms = getTerms();
  const current = normalizeTerm(value);

  const handleKeyDown = (e, val) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = val === 3 ? 1 : val + 1;
      onChange?.(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = val === 1 ? 3 : val - 1;
      onChange?.(prev);
    }
  };

  return (
    <div className="term-selector-group" id={id}>
      <label className="term-selector-label" id={`${id}-label`}>
        {label}
        {required && <span className="term-selector-required">*</span>}
      </label>

      <div
        className="term-selector-segmented"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-required={required}
      >
        {terms.map((t) => {
          const isSelected = current === t.value;
          const activeClass = isSelected ? `term-selector-btn--active-${t.value}` : "";

          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              className={`term-selector-btn ${activeClass}`.trim()}
              onClick={() => onChange?.(t.value)}
              onKeyDown={(e) => handleKeyDown(e, t.value)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <span className="term-selector-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

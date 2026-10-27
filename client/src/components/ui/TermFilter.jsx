import React from "react";
import "./TermFilter.css";

const FILTER_OPTIONS = [
  { value: "all", label: "All Terms" },
  { value: 1, label: "Term 1" },
  { value: 2, label: "Term 2" },
  { value: 3, label: "Term 3" },
  { value: "unset", label: "Not set" },
];

export default function TermFilter({
  value = "all",
  onChange,
  counts = null,
  showAll = true,
  className = "",
}) {
  const options = showAll ? FILTER_OPTIONS : FILTER_OPTIONS.filter((o) => o.value !== "all");

  const normalizeValue = (v) => {
    if (v === 1 || v === "1") return 1;
    if (v === 2 || v === "2") return 2;
    if (v === 3 || v === "3") return 3;
    if (v === "unset" || v === "none") return "unset";
    return "all";
  };

  const active = normalizeValue(value);

  const getCount = (val) => {
    if (!counts) return null;
    if (val === "all") {
      return (counts[1] || 0) + (counts[2] || 0) + (counts[3] || 0) + (counts.unset || 0);
    }
    return counts[val] !== undefined ? counts[val] : null;
  };

  return (
    <div className={`term-filter-bar ${className}`.trim()} role="group" aria-label="Filter by academic term">
      {options.map((opt) => {
        const isSelected = active === opt.value;
        const count = getCount(opt.value);

        return (
          <button
            key={String(opt.value)}
            type="button"
            className={`term-filter-chip ${isSelected ? "term-filter-chip--active" : ""}`}
            onClick={() => onChange?.(opt.value)}
            aria-pressed={isSelected}
          >
            <span>{opt.label}</span>
            {count !== null && <span className="term-filter-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

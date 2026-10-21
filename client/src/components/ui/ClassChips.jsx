import React from "react";

export const RCA_CLASSES = [
  { id: "Y1A", label: "Y1A", year: 1, stream: "A" },
  { id: "Y1B", label: "Y1B", year: 1, stream: "B" },
  { id: "Y1C", label: "Y1C", year: 1, stream: "C" },
  { id: "Y1GenAI", label: "Y1 GenAI", year: 1, stream: "GenAI" },
  { id: "Y2A", label: "Y2A", year: 2, stream: "A" },
  { id: "Y2B", label: "Y2B", year: 2, stream: "B" },
  { id: "Y2C", label: "Y2C", year: 2, stream: "C" },
  { id: "Y3A", label: "Y3A", year: 3, stream: "A" },
  { id: "Y3B", label: "Y3B", year: 3, stream: "B" },
  { id: "Y3C", label: "Y3C", year: 3, stream: "C" },
];

/**
 * Interactive row of RCA campus class chips (archive shelf motif)
 */
export default function ClassChips({
  selectedClass = null,
  onSelectClass,
  size = "md",
  className = "",
  style = {},
  showAll = false,
  onSelectAll,
}) {
  return (
    <div
      className={`rca-class-chips-scroll ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: size === "sm" ? "6px" : "8px",
        overflowX: "auto",
        padding: "4px 2px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        ...style,
      }}
    >
      {showAll && (
        <button
          type="button"
          onClick={onSelectAll}
          style={{
            padding: size === "sm" ? "5px 12px" : "8px 18px",
            borderRadius: "999px",
            fontSize: size === "sm" ? "0.75rem" : "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            border: selectedClass === null ? "1.5px solid #3F4FA8" : "1px solid rgba(63, 79, 168, 0.12)",
            background: selectedClass === null ? "#3F4FA8" : "#FFFFFF",
            color: selectedClass === null ? "#FFFFFF" : "#3A4269",
            boxShadow: selectedClass === null ? "0 4px 12px rgba(63, 79, 168, 0.22)" : "0 1px 3px rgba(35, 44, 107, 0.04)",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          All Classes
        </button>
      )}

      {RCA_CLASSES.map((cls) => {
        const isSelected = selectedClass === cls.id;
        return (
          <button
            key={cls.id}
            type="button"
            onClick={() => onSelectClass && onSelectClass(cls.id)}
            style={{
              padding: size === "sm" ? "5px 14px" : "8px 18px",
              borderRadius: "999px",
              fontSize: size === "sm" ? "0.75rem" : "0.85rem",
              fontWeight: isSelected ? 700 : 600,
              cursor: "pointer",
              border: isSelected
                ? "1.5px solid #5B73E0"
                : "1px solid rgba(63, 79, 168, 0.12)",
              background: isSelected
                ? "linear-gradient(135deg, #3F4FA8 0%, #232C6B 100%)"
                : "#FFFFFF",
              color: isSelected ? "#FFFFFF" : "#3A4269",
              boxShadow: isSelected
                ? "0 4px 14px rgba(63, 79, 168, 0.28)"
                : "0 2px 6px rgba(35, 44, 107, 0.04)",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {cls.label}
          </button>
        );
      })}
    </div>
  );
}

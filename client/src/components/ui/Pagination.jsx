import React from "react";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className = "",
  style = {},
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={`rca-pagination ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        marginTop: "24px",
        ...style,
      }}
    >
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{
          padding: "8px 14px",
          borderRadius: "999px",
          background: "#FFFFFF",
          border: "1px solid rgba(63, 79, 168, 0.12)",
          fontSize: "0.84rem",
          fontWeight: 600,
          color: currentPage <= 1 ? "#949EBF" : "#1B2142",
          cursor: currentPage <= 1 ? "not-allowed" : "pointer",
          boxShadow: "0 1px 3px rgba(35, 44, 107, 0.04)",
          transition: "all 0.2s ease",
        }}
      >
        Previous
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
        const isCurrent = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: isCurrent
                ? "var(--color-indigo-700, #3F4FA8)"
                : "#FFFFFF",
              border: isCurrent ? "none" : "1px solid rgba(63, 79, 168, 0.12)",
              color: isCurrent ? "#FFFFFF" : "#1B2142",
              fontSize: "0.85rem",
              fontWeight: isCurrent ? 700 : 500,
              cursor: "pointer",
              boxShadow: isCurrent
                ? "0 4px 12px rgba(63, 79, 168, 0.25)"
                : "0 1px 3px rgba(35, 44, 107, 0.04)",
              transition: "all 0.2s ease",
            }}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{
          padding: "8px 14px",
          borderRadius: "999px",
          background: "#FFFFFF",
          border: "1px solid rgba(63, 79, 168, 0.12)",
          fontSize: "0.84rem",
          fontWeight: 600,
          color: currentPage >= totalPages ? "#949EBF" : "#1B2142",
          cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
          boxShadow: "0 1px 3px rgba(35, 44, 107, 0.04)",
          transition: "all 0.2s ease",
        }}
      >
        Next
      </button>
    </div>
  );
}

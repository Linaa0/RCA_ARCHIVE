import React from "react";

export default function Table({
  columns = [],
  data = [],
  keyField = "id",
  loading = false,
  emptyMessage = "No records found.",
  className = "",
  style = {},
}) {
  return (
    <div
      className={`rca-table-wrapper ${className}`}
      style={{
        width: "100%",
        overflowX: "auto",
        borderRadius: "var(--radius-card-sm, 18px)",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
        background: "#FFFFFF",
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          fontSize: "0.88rem",
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--color-surface-subtle, #F8F9FD)",
              borderBottom: "1px solid var(--color-divider, #E7EBF5)",
            }}
          >
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: "14px 20px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-muted, #6A7399)",
                  whiteSpace: "nowrap",
                  textAlign: col.align || "left",
                  width: col.width || "auto",
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "48px 20px",
                  textAlign: "center",
                  color: "var(--color-muted, #6A7399)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "2px solid #C7D2FE",
                      borderTopColor: "#3F4FA8",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Loading records...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "48px 20px",
                  textAlign: "center",
                  color: "var(--color-muted, #6A7399)",
                  fontSize: "0.92rem",
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const rowKey = row[keyField] || row._id || rowIdx;
              return (
                <tr
                  key={rowKey}
                  style={{
                    borderBottom:
                      rowIdx === data.length - 1
                        ? "none"
                        : "1px solid var(--color-border, rgba(63, 79, 168, 0.06))",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#F9FAFE")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      style={{
                        padding: "16px 20px",
                        color: "var(--color-ink, #1B2142)",
                        textAlign: col.align || "left",
                        verticalAlign: "middle",
                      }}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

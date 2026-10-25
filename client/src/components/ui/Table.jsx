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
        borderRadius: "var(--radius-card-sm, 16px)",
        border: "1px solid var(--color-border, rgba(63, 79, 168, 0.09))",
        backgroundColor: "var(--color-surface, #FFFFFF)",
        boxShadow: "var(--shadow-xs)",
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          tableLayout: "fixed",
          borderCollapse: "collapse",
          textAlign: "left",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: "var(--color-surface-subtle, #F8F9FD)",
              borderBottom: "1px solid var(--color-divider, #E4E8F2)",
            }}
          >
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: "14px 18px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-muted, #6A7399)",
                  whiteSpace: "nowrap",
                  textAlign: col.align || "left",
                  width: col.width || undefined,
                  maxWidth: col.maxWidth || undefined,
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
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "2px solid var(--color-indigo-200, #C7D2FE)",
                      borderTopColor: "var(--color-indigo-500, #3F4FA8)",
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
                  fontSize: "0.925rem",
                  fontWeight: 500,
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
                        : "1px solid var(--color-border, rgba(63, 79, 168, 0.08))",
                    transition: "background-color var(--transition-fast)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-surface-hover, #F3F5FC)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {columns.map((col, colIdx) => {
                    const rawVal = row[col.key];
                    const rendered = col.render
                      ? col.render(rawVal, row, rowIdx)
                      : rawVal;

                    const isPrimitive =
                      typeof rendered === "string" ||
                      typeof rendered === "number";

                    return (
                      <td
                        key={col.key || colIdx}
                        style={{
                          padding: "14px 18px",
                          color: "var(--color-ink, #1B2142)",
                          textAlign: col.align || "left",
                          verticalAlign: "middle",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                          maxWidth: col.maxWidth || col.width || "300px",
                        }}
                      >
                        {isPrimitive ? (
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: col.wrap ? "normal" : "nowrap",
                              maxWidth: "100%",
                              overflowWrap: "anywhere",
                            }}
                            title={String(rawVal ?? "")}
                          >
                            {rendered}
                          </div>
                        ) : (
                          rendered
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

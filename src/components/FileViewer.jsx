import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

export default function FileViewer() {
  const { id } = useParams()
  const [paper, setPaper] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/papers`)
      .then((r) => r.json())
      .then((papers) => {
        const found = papers.find((p) => p.id === id)
        if (found) setPaper(found)
        else setError("Paper not found")
      })
      .catch(() => setError("Failed to load paper"))
  }, [id])

  if (error)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          background: "#1a1a1a",
        }}
      >
        <p style={{ color: "#ccc" }}>{error}</p>
      </div>
    )

  if (!paper)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          background: "#1a1a1a",
        }}
      >
        <p style={{ color: "#ccc" }}>Loading...</p>
      </div>
    )

  const fileUrl = `/api/papers/${paper.id}/view`
  const ext = paper.originalName?.split(".").pop().toLowerCase()
  const canEmbed = ["pdf", "png", "jpg", "jpeg"].includes(ext)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "sans-serif",
        background: "#1a1a1a",
      }}
    >

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#111",
          borderBottom: "1px solid #333",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => window.close()}
          style={{
            background: "none",
            border: "1px solid #555",
            color: "#ccc",
            padding: "6px 14px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ✕ Close
        </button>

        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, color: "#fff", fontWeight: 600, fontSize: "15px" }}>
            {paper.title}
          </p>
          <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>
            {paper.subject} • Year {paper.year} • {paper.type}
          </p>
        </div>

        <a
          href={`http://localhost:5077/api/papers/${paper.id}/download`}
          download={paper.originalName}
          style={{
            background: "#2563eb",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: "6px",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          Download
        </a>
      </div>

      {/* File display */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {canEmbed ? (
          <iframe src={fileUrl} title={paper.title} style={{ width: "100%", height: "100%", border: "none" }} />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "16px",
            }}
          >
            <p style={{ color: "#ccc", fontSize: "16px" }}>
              This file type can't be previewed in the browser.
            </p>
            <a
              href={`/api/papers/${paper.id}/download`}
              download={paper.originalName}
              style={{
                background: "#2563eb",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "15px",
              }}
            >
              Download to open
            </a>
          </div>
        )}
      </div>

    </div>
  )
}

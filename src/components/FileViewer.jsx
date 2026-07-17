import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { API_ROOT } from "../config";

export default function FileViewer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState(null);
  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(null);

  const fileUrl = paper ? `${API_ROOT}/api/papers/${paper.id}/view` : null;
  const downloadUrl = paper ? `${API_ROOT}/api/papers/${paper.id}/download` : null;
  const ext = paper?.originalName?.split(".").pop().toLowerCase();

  const iframeExtensions = [
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "html",
    "htm",
  ];
  const audioExtensions = ["mp3", "wav", "ogg"];
  const videoExtensions = ["mp4", "mov", "avi", "webm"];
  const textExtensions = ["txt", "md", "csv", "json"];
  const officeExtensions = [
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "odt",
    "ods",
    "odp",
  ];

  const officeViewerUrl = officeExtensions.includes(ext)
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
    : null;

  const canEmbedInIframe = iframeExtensions.includes(ext) || Boolean(officeViewerUrl);
  const canRenderText = textExtensions.includes(ext);
  const canRenderAudio = audioExtensions.includes(ext);
  const canRenderVideo = videoExtensions.includes(ext);

  useEffect(() => {
    api.get("/papers")
      .then(({ data: papers }) => {
        const found = papers.find((p) => p.id === id);
        if (found) setPaper(found);
        else setError("Paper not found");
      })
      .catch(() => setError("Failed to load paper"));
  }, [id]);

  useEffect(() => {
    if (!paper || !canRenderText) {
      setTextContent("");
      setTextError(null);
      setTextLoading(false);
      return;
    }

    setTextLoading(true);
    setTextError(null);

    fetch(fileUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error("Preview failed");
        return res.text();
      })
      .then((text) => setTextContent(text))
      .catch(() => setTextError("Preview not available"))
      .finally(() => setTextLoading(false));
  }, [fileUrl, paper, canRenderText]);

  if (error)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", background: "#1a1a1a" }}>
        <p style={{ color: "#ccc" }}>{error}</p>
      </div>
    );

  if (!paper)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", background: "#1a1a1a" }}>
        <p style={{ color: "#ccc" }}>Loading...</p>
      </div>
    );

  const handleClose = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif", background: "#1a1a1a" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: "#111", borderBottom: "1px solid #333", flexShrink: 0 }}>
        <button
          onClick={handleClose}
          style={{ background: "none", border: "1px solid #555", color: "#ccc", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
        >
          ✕ Close
        </button>

        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, color: "#fff", fontWeight: 600, fontSize: "15px" }}>{paper.title}</p>
          <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>
            {paper.subject} • Year {paper.year} • {paper.type}
          </p>
        </div>

        {/* FIX 1: Added missing '<a' opening tag here */}
        <a
          href={downloadUrl}
          download={paper.originalName}
          style={{ background: "#2563eb", color: "#fff", padding: "6px 14px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }}
        >
          Download
        </a>
      </div>

      {/* File display */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {canEmbedInIframe ? (
          <iframe
            src={officeViewerUrl || fileUrl}
            title={paper.title}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : canRenderVideo ? (
          <video
            controls
            src={fileUrl}
            style={{ width: "100%", height: "100%", background: "#000" }}
          />
        ) : canRenderAudio ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <audio controls src={fileUrl} style={{ width: "100%" }} />
          </div>
        ) : canRenderText ? (
          <div style={{ padding: "24px", overflowY: "auto", height: "100%", background: "#0f172a", color: "#e2e8f0" }}>
            {textLoading ? (
              <p>Loading text preview...</p>
            ) : textError ? (
              <p>{textError}</p>
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "Consolas, monospace", fontSize: "13px" }}>
                {textContent}
              </pre>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", padding: "20px" }}>
            <p style={{ color: "#ccc", fontSize: "16px", maxWidth: "520px", textAlign: "center" }}>
              This file type is not directly embeddable, but you can still download it or open it in a new tab.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <a
                href={downloadUrl}
                download={paper.originalName}
                style={{ background: "#2563eb", color: "#fff", padding: "10px 24px", borderRadius: "8px", textDecoration: "none", fontSize: "15px" }}
              >
                Download
              </a>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: "#10b981", color: "#fff", padding: "10px 24px", borderRadius: "8px", textDecoration: "none", fontSize: "15px" }}
              >
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
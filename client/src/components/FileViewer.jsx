import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { API_ROOT } from "../services/api";
import { ArrowLeftIcon, DownloadIcon, EyeIcon } from "./ui/Icons";

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

  const handleClose = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/home", { replace: true });
    }
  };

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--color-bg)", color: "var(--color-text-primary)", fontFamily: "var(--font-family)" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-danger, #EF4444)", marginBottom: "16px" }}>{error}</p>
        <button
          onClick={handleClose}
          style={{ padding: "10px 24px", borderRadius: "999px", background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!paper) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--color-bg)", fontFamily: "var(--font-family)" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid rgba(91, 115, 224, 0.2)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ marginTop: "16px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Loading document viewer...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg)", fontFamily: "var(--font-family)" }}>
      {/* Modern Topbar matching Clean Dashboard UI */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 28px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            color: "var(--color-ink)",
            padding: "8px 18px",
            borderRadius: "999px",
            cursor: "pointer",
            fontSize: "0.88rem",
            fontWeight: 600,
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-indigo-500)";
            e.currentTarget.style.color = "var(--color-indigo-500)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "var(--color-ink)";
          }}
        >
          <ArrowLeftIcon size={16} />
          <span>Back</span>
        </button>

        <div style={{ textAlign: "center", maxWidth: "600px", minWidth: 0, overflow: "hidden" }}>
          <h1
            title={paper.title}
            style={{
              margin: 0,
              color: "var(--color-ink)",
              fontWeight: 700,
              fontSize: "1.05rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {paper.title}
          </h1>
          <p style={{ margin: "2px 0 0", color: "var(--color-muted)", fontSize: "0.8rem", fontWeight: 500 }}>
            {paper.subject} • Year {paper.year} • {paper.type || "Past Paper"}
          </p>
        </div>

        <a
          href={downloadUrl}
          download={paper.originalName}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--color-indigo-600)",
            color: "#ffffff",
            padding: "9px 22px",
            borderRadius: "999px",
            textDecoration: "none",
            fontSize: "0.88rem",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(59, 76, 163, 0.25)",
            transition: "all var(--transition-fast)",
          }}
        >
          <DownloadIcon size={16} />
          <span>Download</span>
        </a>
      </header>

      {/* File display */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
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
            <audio controls src={fileUrl} style={{ width: "80%", maxWidth: "600px" }} />
          </div>
        ) : canRenderText ? (
          <div style={{ padding: "32px", overflowY: "auto", height: "100%", background: "var(--color-surface)", color: "var(--color-ink)" }}>
            {textLoading ? (
              <p>Loading text preview...</p>
            ) : textError ? (
              <p style={{ color: "var(--color-danger, #EF4444)" }}>{textError}</p>
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", fontSize: "0.9rem" }}>
                {textContent}
              </pre>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "40px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                background: "var(--color-surface-subtle)",
                color: "var(--color-indigo-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <EyeIcon size={28} />
            </div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-ink)", marginBottom: "8px" }}>
              In-Browser Preview Not Supported for .{ext?.toUpperCase()}
            </h2>
            <p style={{ maxWidth: "420px", color: "var(--color-muted)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "20px" }}>
              This file type cannot be displayed directly in your web browser. You can download the file to inspect it on your computer.
            </p>
            <a
              href={downloadUrl}
              download={paper.originalName}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--color-indigo-600)",
                color: "#ffffff",
                padding: "10px 24px",
                borderRadius: "999px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(63, 79, 168, 0.25)",
              }}
            >
              <DownloadIcon size={16} />
              <span>Download File</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
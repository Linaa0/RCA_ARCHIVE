import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { renderAsync } from "docx-preview";
import api, { API_ROOT } from "../services/api";
import { getStoredToken } from "../utils/auth";
import { ArrowLeftIcon, DownloadIcon, EyeIcon } from "./ui/Icons";

const BLOB_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  txt: "text/plain",
};

// Make sure the browser knows what the blob is, otherwise PDFs may download instead of showing
function retypeBlob(blob, name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  const mime = BLOB_MIME[ext];
  return mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
}

export default function FileViewer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "paper";
  const nameParam = searchParams.get("name") || "";

  const [accessData, setAccessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paperPreviewUrl, setPaperPreviewUrl] = useState(null);
  const [paperPreviewLoading, setPaperPreviewLoading] = useState(false);
  const [paperPreviewError, setPaperPreviewError] = useState(null);

  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(null);

  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState(null);
  // State (not a plain ref) so the render effect runs again once the container really exists
  const [docxContainer, setDocxContainer] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let assignmentObjectUrl = null;
    setLoading(true);
    setError(null);
    setAccessData(null);
    setPaperPreviewUrl(null);

    const token = getStoredToken();
    const tokenQuery = token ? `token=${encodeURIComponent(token)}` : "";

    if (type === "assignment") {
      api
        .get(`/assignments/${id}`)
        .then(({ data: body }) => {
          const data = body.assignment || body;
          const originalName = data.attachmentName || nameParam || "attachment";
          return api
            .get(`/assignments/${id}/view`, { responseType: "blob" })
            .then(({ data: fileBlob }) => {
              if (!isMounted) return;
              assignmentObjectUrl = URL.createObjectURL(retypeBlob(fileBlob, originalName));
              setAccessData({
                title: data.title || "Assignment Attachment",
                originalName,
                viewUrl: assignmentObjectUrl,
                downloadUrl: assignmentObjectUrl,
              });
              setLoading(false);
            });
        })
        .catch(() => {
          if (isMounted) {
            setError("Unable to load assignment file. Please try again or download it instead.");
            setLoading(false);
          }
        });
    } else if (type === "resource") {
      // Notes / past papers uploaded by teachers (listed on the subject pages)
      const originalName = nameParam || "resource";
      api
        .get(`/subject-materials/resources/${id}/file`, { responseType: "blob" })
        .then(({ data: fileBlob, headers }) => {
          if (!isMounted) return;
          const disposition = headers?.["content-disposition"] || "";
          const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          const realName = match ? decodeURIComponent(match[1]) : originalName;
          assignmentObjectUrl = URL.createObjectURL(retypeBlob(fileBlob, realName));
          setAccessData({ title: nameParam || realName, originalName: realName, viewUrl: assignmentObjectUrl, downloadUrl: assignmentObjectUrl });
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) {
            setError("Unable to open this file. It may have been removed.");
            setLoading(false);
          }
        });
    } else {
      // Past paper (default)
      api
        .post(`/papers/${id}/access-link`)
        .then(({ data }) => {
          if (isMounted) {
            setAccessData(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAccessData({
              title: nameParam || "Academic Past Paper",
              originalName: nameParam || "past-paper.pdf",
              viewUrl: `/api/papers/${id}/view?inline=1`,
              downloadUrl: `/api/papers/${id}/download`,
            });
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
      if (assignmentObjectUrl) URL.revokeObjectURL(assignmentObjectUrl);
    };
  }, [id, type, nameParam]);

  useEffect(() => {
    if (type !== "paper" || !accessData?.viewUrl) return undefined;

    let isMounted = true;
    let objectUrl = null;
    setPaperPreviewUrl(null);
    setPaperPreviewLoading(true);
    setPaperPreviewError(null);

    api
      .get(accessData.viewUrl, { responseType: "blob" })
      .then(({ data }) => {
        if (!isMounted) return;
        objectUrl = URL.createObjectURL(retypeBlob(data, accessData.originalName || accessData.title));
        setPaperPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (isMounted) setPaperPreviewError("Unable to load the paper preview. Please download the file instead.");
      })
      .finally(() => {
        if (isMounted) setPaperPreviewLoading(false);
      });

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessData, type]);

  const remoteViewUrl = accessData?.viewUrl
    ? (accessData.viewUrl.startsWith("http") ? accessData.viewUrl : `${API_ROOT}${accessData.viewUrl}`)
    : null;
  // Papers wait for the authenticated blob; everything else is already a blob URL
  const viewUrl = type === "paper" ? paperPreviewUrl : remoteViewUrl;
  const downloadUrl = accessData?.downloadUrl
    ? (accessData.downloadUrl.startsWith("http") ? accessData.downloadUrl : `${API_ROOT}${accessData.downloadUrl}`)
    : null;

  const originalName = accessData?.originalName || accessData?.title || "document";
  const ext = originalName.split(".").pop().toLowerCase();

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

  const isDocx = ext === "docx";
  const canEmbedIframe = iframeExtensions.includes(ext);
  const canRenderText = textExtensions.includes(ext);
  const canRenderAudio = audioExtensions.includes(ext);
  const canRenderVideo = videoExtensions.includes(ext);

  // Text loading effect
  useEffect(() => {
    if (!viewUrl || !canRenderText || accessData?.hasNoFile) return;
    setTextLoading(true);
    setTextError(null);

    fetch(viewUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error("Preview failed");
        return res.text();
      })
      .then((text) => setTextContent(text))
      .catch(() => setTextError("Text preview not available"))
      .finally(() => setTextLoading(false));
  }, [viewUrl, canRenderText]);

  // DOCX rendering with docx-preview
  useEffect(() => {
    if (!viewUrl || !isDocx || !docxContainer) return;
    let isCancelled = false;
    setDocxLoading(true);
    setDocxError(null);

    fetch(viewUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch document");
        return res.blob();
      })
      .then((blob) => {
        if (isCancelled || !docxContainer) return;
        docxContainer.innerHTML = "";
        return renderAsync(blob, docxContainer, null, {
          className: "docx-document",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
      })
      .then(() => {
        if (!isCancelled) setDocxLoading(false);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("DOCX preview error:", err);
          setDocxError("Failed to render Word document preview");
          setDocxLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [viewUrl, isDocx, docxContainer]);

  const handleClose = () => {
    // If opened in a new tab/window, attempt window.close() first
    if (window.opener && window.history.length <= 1) {
      window.close();
      return;
    }
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/home", { replace: true });
    }
  };

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--color-bg)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-family)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "var(--color-danger, #EF4444)",
            marginBottom: "16px",
          }}
        >
          {error}
        </p>
        <button
          onClick={handleClose}
          style={{
            padding: "10px 24px",
            borderRadius: "999px",
            background: "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (loading || !accessData) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--color-bg)",
          fontFamily: "var(--font-family)",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid rgba(63, 79, 168, 0.2)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{
            marginTop: "16px",
            color: "var(--color-muted)",
            fontWeight: 500,
          }}
        >
          Generating secure document view...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--color-bg)",
        fontFamily: "var(--font-family)",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
          flexShrink: 0,
          gap: "16px",
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
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
            e.currentTarget.style.color = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "var(--color-ink)";
          }}
        >
          <ArrowLeftIcon size={16} />
          <span>Back</span>
        </button>

        <div
          style={{
            textAlign: "center",
            maxWidth: "600px",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <h1
            title={accessData.title}
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
            {accessData.title}
          </h1>
          <p
            title={originalName}
            style={{
              margin: "2px 0 0",
              color: "var(--color-muted)",
              fontSize: "0.8rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            File: {originalName}
          </p>
        </div>

        {downloadUrl ? (
        <a
          href={downloadUrl}
          download={originalName}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--color-primary)",
            color: "#ffffff",
            padding: "9px 22px",
            borderRadius: "999px",
            textDecoration: "none",
            fontSize: "0.88rem",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(59, 76, 163, 0.25)",
            transition: "all var(--transition-fast)",
            flexShrink: 0,
          }}
        >
          <DownloadIcon size={16} />
          <span>Download</span>
        </a>
        ) : <span style={{ width: 1 }} />}
      </header>

      {/* Main viewer area */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {type === "paper" && paperPreviewLoading ? (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
            Loading paper preview...
          </div>
        ) : type === "paper" && paperPreviewError ? (
          <div style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <p role="alert">{paperPreviewError}</p>
            <a href={downloadUrl} download={originalName}>Download paper</a>
          </div>
        ) : isDocx ? (
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              padding: "24px",
              background: "var(--color-bg)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {docxLoading && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "60px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "3px solid rgba(63, 79, 168, 0.2)",
                    borderTopColor: "var(--color-primary)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <p style={{ marginTop: "12px", color: "var(--color-muted)", fontWeight: 500 }}>
                  Rendering Word document...
                </p>
              </div>
            )}
            {docxError && (
              <div style={{ textAlign: "center", marginTop: "60px" }}>
                <p style={{ color: "var(--color-danger, #EF4444)", marginBottom: "16px" }}>
                  {docxError}
                </p>
                <a
                  href={downloadUrl}
                  download={originalName}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "var(--color-primary)",
                    color: "#ffffff",
                    padding: "9px 22px",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  <DownloadIcon size={16} />
                  <span>Download Document Instead</span>
                </a>
              </div>
            )}
            <div
              ref={setDocxContainer}
              style={{
                display: docxLoading || docxError ? "none" : "block",
                maxWidth: "850px",
                width: "100%",
                background: "#ffffff",
                color: "#1e293b",
                padding: "40px",
                borderRadius: "8px",
                boxShadow: "var(--shadow-md)",
                minHeight: "100%",
              }}
            />
          </div>
        ) : ext === "pdf" && typeof navigator !== "undefined" && navigator.pdfViewerEnabled === false ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "40px",
              textAlign: "center",
              gap: "16px",
            }}
          >
            <p style={{ color: "var(--color-muted)", maxWidth: "420px", lineHeight: 1.5 }}>
              This browser cannot show PDFs inside the page. Open it in a new tab to read it.
            </p>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "var(--color-primary)",
                color: "#ffffff",
                padding: "10px 24px",
                borderRadius: "999px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Open PDF
            </a>
          </div>
        ) : canEmbedIframe ? (
          <iframe
            src={viewUrl}
            title={accessData.title}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : canRenderVideo ? (
          <video
            controls
            src={viewUrl}
            style={{ width: "100%", height: "100%", background: "#000" }}
          />
        ) : canRenderAudio ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <audio controls src={viewUrl} style={{ width: "80%", maxWidth: "600px" }} />
          </div>
        ) : canRenderText ? (
          <div
            style={{
              padding: "32px",
              overflowY: "auto",
              height: "100%",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
            }}
          >
            {textLoading ? (
              <p>Loading text preview...</p>
            ) : textError ? (
              <p style={{ color: "var(--color-danger, #EF4444)" }}>{textError}</p>
            ) : (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                }}
              >
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
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <EyeIcon size={28} />
            </div>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--color-ink)",
                marginBottom: "8px",
              }}
            >
              In-Browser Preview Not Supported for .{ext?.toUpperCase()}
            </h2>
            <p
              style={{
                maxWidth: "420px",
                color: "var(--color-muted)",
                fontSize: "0.9rem",
                lineHeight: 1.5,
                marginBottom: "20px",
              }}
            >
              This file type cannot be displayed directly in your web browser. You can download the file to inspect it on your computer.
            </p>
            <a
              href={downloadUrl}
              download={originalName}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--color-primary)",
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
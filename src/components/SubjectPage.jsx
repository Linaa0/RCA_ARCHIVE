import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "./SubjectPage.css";

function SubjectPage() {
  const { year, subject } = useParams();

  const [papers, setPapers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [loading, setLoading] = useState(false);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Past Paper");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState({});

  // Popup state
  const [popup, setPopup] = useState(null); // { type: 'success'|'duplicate'|'error', message }

  const token = localStorage.getItem("token");

  // ── Fetch papers ──────────────────────────────────────────────────────────
  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ subject, year });
      if (typeFilter !== "All Types") params.append("type", typeFilter);
      if (search) params.append("search", search);

      params.append("sort", "top");
      const res = await fetch(`http://localhost:5000/api/papers?${params}`);
      const data = await res.json();
      setPapers(data);
    } catch {
      console.error("Could not load papers");
    }
    setLoading(false);
  };

  useEffect(() => { fetchPapers(); }, [subject, year, typeFilter]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { alert("Please select a file"); return; }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("year", year);
    formData.append("type", type);

    try {
      const res = await fetch("http://localhost:5000/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.status === 409) {
        setPopup({ type: "duplicate", message: data.message });
      } else if (res.ok) {
        setPopup({ type: "success", message: "Paper uploaded successfully." });
        setTitle("");
        setFile(null);
        setShowUpload(false);
        fetchPapers();
      } else {
        setPopup({ type: "error", message: data.error || "Upload failed" });
      }
    } catch {
      setPopup({ type: "error", message: "Cannot connect to server." });
    }

    setUploading(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this paper?")) return;

    const res = await fetch(`http://localhost:5000/api/papers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) fetchPapers();
    else {
      const data = await res.json();
      alert(data.error);
    }
  };
  const handleRate = async (paperId) => {
    const ratingValue = Number(selectedRatings[paperId]);
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      setPopup({ type: "error", message: "Please choose a rating between 1 and 5." });
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/papers/${paperId}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: ratingValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPopup({ type: "error", message: data.error || "Unable to save rating." });
        return;
      }
      setPopup({ type: "success", message: "Thank you for your rating." });
      setSelectedRatings((prev) => ({ ...prev, [paperId]: "" }));
      fetchPapers();
    } catch {
      setPopup({ type: "error", message: "Cannot connect to server." });
    }
  };
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");

  return (
    <div className="subject-page">

      {/* ── Popup ── */}
      {popup && (
        <div className="popup-overlay">
          <div className={`popup-box popup-${popup.type}`}>
            <div className="popup-icon">
              {popup.type === "duplicate" ? "Notice" : popup.type === "success" ? "Success" : "Error"}
            </div>
            <h3>
              {popup.type === "duplicate" ? "Paper Already Exists"
                : popup.type === "success" ? "Upload Successful"
                : "Error"}
            </h3>
            <p>{popup.message}</p>
            <button className="popup-close-btn" onClick={() => setPopup(null)}>OK</button>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="subject-nav">
        <Link to="/" className="back-link">← Back to Home</Link>
      </nav>

      <div className="subject-header">
        <h2>{subject}: Year {year}</h2>
        <button className="upload-toggle-btn" onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? "Cancel" : "Upload Paper / Note"}
        </button>
      </div>

      {/* ── Upload Form ── */}
      {showUpload && (
        <div className="upload-form-box">
          <h3>Upload a New Paper or Note</h3>
          <form onSubmit={handleUpload}>
            <label>Title</label>
            <input
              type="text"
              placeholder="e.g. Mathematics Final Exam 2023"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>Past Paper</option>
              <option>Notes</option>
              <option>Assignment</option>
              <option>Quiz</option>
            </select>

            <label>File (PDF, Word, Image, etc.)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />

            <button type="submit" className="upload-btn" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option>All Types</option>
          <option>Past Paper</option>
          <option>Notes</option>
          <option>Assignment</option>
          <option>Quiz</option>
        </select>
        <button className="search-btn" onClick={fetchPapers}>Search</button>
      </div>

      {/* ── Results ── */}
      <div className="results">
        {loading ? (
          <p>Loading...</p>
        ) : papers.length === 0 ? (
          <>
            <p>0 result(s) found</p>
            <p>No papers found. {token ? "Be the first to upload!" : "Login to upload one."}</p>
          </>
        ) : (
          <>
            <p>{papers.length} result(s) found</p>
            {papers.map((paper) => (
              <div key={paper.id} className="paper-card">
                <div className="paper-info">
                  <strong>{paper.title}</strong>
                  <span className="paper-meta">
                    {paper.type} • Uploaded by {paper.uploadedBy} • {new Date(paper.uploadedAt).toLocaleDateString()}
                  </span>
                  <div className="rating-row">
                    <span className="rating-summary">
                      {paper.averageRating.toFixed(1)} / 5 • {paper.ratingCount} rating{paper.ratingCount === 1 ? "" : "s"}
                    </span>
                    <div className="rating-input">
                      <label>Rate:</label>
                      <select
                        value={selectedRatings[paper.id] || ""}
                        onChange={(e) =>
                          setSelectedRatings((prev) => ({ ...prev, [paper.id]: e.target.value }))
                        }
                      >
                        <option value="">Choose</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                      <button className="rate-btn" onClick={() => handleRate(paper.id)}>
                        Rate
                      </button>
                    </div>
                  </div>
                </div>
                <div className="paper-actions">
                  <a
                    href={`http://localhost:5000/uploads/${paper.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="view-btn"
                  >
                    View
                  </a>
                  <a
                    href={`http://localhost:5000/uploads/${paper.filename}`}
                    download={paper.originalName}
                    className="download-btn"
                  >
                    Download
                  </a>
                  {(paper.uploadedBy === username || role === "teacher") && (
                    <button className="delete-btn" onClick={() => handleDelete(paper.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default SubjectPage;
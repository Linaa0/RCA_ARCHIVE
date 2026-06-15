import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "./SubjectPage.css";
import api from '../api';

function SubjectPage() {
  const { year, subject } = useParams();

  const [papers, setPapers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [loading, setLoading] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Past Paper");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState({});

  const [popup, setPopup] = useState(null);

  const token = localStorage.getItem("token");

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ subject, year });
      if (typeFilter !== "All Types") params.append("type", typeFilter);
      if (search) params.append("search", search);

      params.append("sort", "top");
      const { data } = await api.get(`/papers?${params}`);
      setPapers(data);
    } catch {
      console.error("Could not load papers");
    }
    setLoading(false);
  };

  useEffect(() => { fetchPapers(); }, [subject, year, typeFilter]);

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
      const { data } = await api.post("/upload", formData);

      // api.js interceptor handles Authorization automatically
      // Check for duplicate via status — axios throws on non-2xx,
      // so we handle 409 in the catch block
      setPopup({ type: "success", message: "Paper uploaded successfully." });
      setTitle("");
      setFile(null);
      setShowUpload(false);
      fetchPapers();
    } catch (err) {
      if (err.response?.status === 409) {
        setPopup({ type: "duplicate", message: err.response.data.message });
      } else {
        setPopup({ type: "error", message: err.response?.data?.error || "Upload failed" });
      }
    }

    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this paper?")) return;

   
    try {
      await api.delete(`/papers/${id}`);
      fetchPapers();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };
  const handleRate = async (paperId) => {
    const ratingValue = Number(selectedRatings[paperId]);
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      setPopup({ type: "error", message: "Please choose a rating between 1 and 5." });
      return;
    }

     try {
      await api.post(`/papers/${paperId}/rate`, { rating: ratingValue });
      setPopup({ type: "success", message: "Thank you for your rating." });
      setSelectedRatings((prev) => ({ ...prev, [paperId]: "" }));
      fetchPapers();
    } catch (err) {
      setPopup({ type: "error", message: err.response?.data?.error || "Unable to save rating." });
    }
  };
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");

  return (
    <div className="subject-page">

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

      <nav className="subject-nav">
        <Link to="/" className="back-link">← Back to Home</Link>
      </nav>

      <div className="subject-header">
        <h2>{subject}: Year {year}</h2>
        <button className="upload-toggle-btn" onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? "Cancel" : "Upload Paper / Note"}
        </button>
      </div>

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

            <label>File (any type supported)</label>
            <input
              type="file"
              accept="*/*"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />

            <button type="submit" className="upload-btn" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      )}

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
                  {(() => {
                    const baseUrl = paper.viewUrl || `/api/papers/${paper.id}/view`;
                    const ext = paper.originalName?.split(".").pop().toLowerCase();
                    const viewableInBrowser = ["pdf", "png", "jpg", "jpeg"].includes(ext);
                    const viewUrl = viewableInBrowser
                      ? baseUrl
                      : `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + baseUrl)}&embedded=false`;
                    return (
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-btn"
                      >
                        View
                      </a>
                    );
                  })()}
                  <a
                    href={paper.downloadUrl || `/api/papers/${paper.id}/download`}
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
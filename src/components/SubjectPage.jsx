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
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    year: "",
    type: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");
  const canUpload = role === "teacher" || role === "admin";

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await api.post("/upload", formData);

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

  const handleOpenDeleteRequest = (paper) => {
    setDeleteTarget(paper);
    setDeleteReason("");
  };

  const handleOpenEdit = (paper) => {
    setEditTarget(paper);
    setEditForm({
      title: paper.title || "",
      subject: paper.subject || "",
      year: paper.year || "",
      type: paper.type || "",
    });
  };

  const handleEditPaper = async (event) => {
    event.preventDefault();

    if (!editTarget) return;

    if (!editForm.title.trim() || !editForm.subject.trim() || !editForm.year.trim() || !editForm.type.trim()) {
      setPopup({ type: "error", message: "Please fill in all edit fields." });
      return;
    }

    setEditSubmitting(true);
    try {
      const { data } = await api.put(`/papers/${editTarget.id}`, {
        title: editForm.title.trim(),
        subject: editForm.subject.trim(),
        year: editForm.year.trim(),
        type: editForm.type.trim(),
      });
      setPopup({ type: "success", message: data.message || "Paper updated successfully." });
      setEditTarget(null);
      fetchPapers();
    } catch (err) {
      setPopup({
        type: "error",
        message: err.response?.data?.error || "Unable to update paper.",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRequestDelete = async (event) => {
    event.preventDefault();

    if (!deleteTarget) return;
    if (!deleteReason.trim()) {
      setPopup({ type: "error", message: "Please provide a reason for the deletion request." });
      return;
    }

    setDeleteSubmitting(true);
    try {
      const { data } = await api.post(`/papers/${deleteTarget.id}/request-delete`, {
        reason: deleteReason,
      });
      setPopup({ type: "success", message: data.message || "Deletion request submitted." });
      setDeleteTarget(null);
      setDeleteReason("");
      fetchPapers();
    } catch (err) {
      setPopup({
        type: "error",
        message: err.response?.data?.error || "Unable to submit deletion request.",
      });
    } finally {
      setDeleteSubmitting(false);
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

      {editTarget && (
        <div className="delete-request-overlay">
          <div className="delete-request-modal">
            <div className="delete-request-header">
              <div>
                <p className="delete-request-kicker">Edit paper</p>
                <h3>{editTarget.title}</h3>
                <p>Update the paper details below.</p>
              </div>
              <button
                type="button"
                className="delete-request-close"
                onClick={() => setEditTarget(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditPaper} className="delete-request-form">
              <label htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                className="edit-field"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, title: e.target.value }))
                }
              />

              <label htmlFor="edit-subject">Subject</label>
              <input
                id="edit-subject"
                className="edit-field"
                value={editForm.subject}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, subject: e.target.value }))
                }
              />

              <label htmlFor="edit-year">Year</label>
              <input
                id="edit-year"
                className="edit-field"
                value={editForm.year}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, year: e.target.value }))
                }
              />

              <label htmlFor="edit-type">Type</label>
              <input
                id="edit-type"
                className="edit-field"
                value={editForm.type}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, type: e.target.value }))
                }
              />

              <div className="delete-request-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="danger-btn" disabled={editSubmitting}>
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="delete-request-overlay">
          <div className="delete-request-modal">
            <div className="delete-request-header">
              <div>
                <p className="delete-request-kicker">Request deletion</p>
                <h3>{deleteTarget.title}</h3>
                <p>
                  {deleteTarget.subject} • Year {deleteTarget.year} • {deleteTarget.type}
                </p>
              </div>
              <button
                type="button"
                className="delete-request-close"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason("");
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRequestDelete} className="delete-request-form">
              <label htmlFor="delete-reason">Reason for deletion</label>
              <textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explain why this paper should be removed from the archive"
                rows={5}
                required
              />

              <div className="delete-request-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteReason("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="danger-btn" disabled={deleteSubmitting}>
                  {deleteSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <nav className="subject-nav">
        <Link to="/" className="back-link">← Back to Home</Link>
      </nav>

      <div className="subject-header">
        <h2>{subject}: Year {year}</h2>
        {canUpload ? (
          <button className="upload-toggle-btn" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "Cancel" : "Upload Paper / Note"}
          </button>
        ) : (
          <div className="upload-note">Teachers upload papers. Students can request deletions.</div>
        )}
      </div>

      {canUpload && showUpload && (
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
                  <a
                    href={`/view/${paper.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-btn"
                  >
                    View
                  </a>
                  <a
                    href={paper.downloadUrl || `/api/papers/${paper.id}/download`}
                    className="download-btn"
                  >
                    Download
                  </a>
                  {token && (paper.uploadedBy === username || role === "admin") && (
                    <button className="delete-btn" onClick={() => handleOpenEdit(paper)}>
                      Edit
                    </button>
                  )}
                  {token && role !== "admin" && (
                    <button className="delete-btn" onClick={() => handleOpenDeleteRequest(paper)}>
                      Request Deletion
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

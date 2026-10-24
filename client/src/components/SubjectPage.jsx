import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "./SubjectPage.css";
import api from "../services/api";

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
  const canUpload = !!token;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const openMenus = document.querySelectorAll(".more-menu.open");
      openMenus.forEach((menu) => {
        if (!menu.contains(e.target) && !menu.previousElementSibling?.contains(e.target)) {
          menu.classList.remove("open");
        }
      });
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
  useEffect(() => {
    fetchPapers();
  }, [subject, year, typeFilter]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setPopup({ type: "error", title: "Missing File", message: "Please select a file to upload." });
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      setPopup({
        type: "error",
        title: "Unsupported Format",
        message: "Only PDF and Word documents (.pdf, .doc, .docx) are allowed.",
      });
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("year", year);
    formData.append("type", type);

    try {
      await api.post("/upload", formData);
      setPopup({
        type: "success",
        title: "Upload Successful",
        message: `"${title}" has been uploaded to ${subject}.`,
      });
      setTitle("");
      setFile(null);
      setShowUpload(false);
      fetchPapers();
    } catch (err) {
      if (err.response?.status === 409) {
        setPopup({
          type: "duplicate",
          title: "Paper Already Exists",
          message: err.response.data.message,
        });
      } else {
        setPopup({
          type: "error",
          title: "Upload Restriction",
          message: err.response?.data?.error || "Upload failed. Please check your assigned cohort and try again.",
        });
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
      setPopup({ type: "error", title: "Incomplete Form", message: "Please fill in all edit fields." });
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
      setPopup({
        type: "success",
        title: "Paper Updated",
        message: data.message || "Paper updated successfully.",
      });
      setEditTarget(null);
      fetchPapers();
    } catch (err) {
      setPopup({
        type: "error",
        title: "Update Failed",
        message: err.response?.data?.error || "Unable to update paper.",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDirectDelete = async (paper) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${paper.title}"?`)) {
      return;
    }
    try {
      await api.delete(`/papers/${paper.id}`);
      setPopup({
        type: "success",
        title: "Paper Deleted",
        message: `"${paper.title}" has been permanently removed from the archive.`,
      });
      fetchPapers();
    } catch (err) {
      setPopup({
        type: "error",
        title: "Deletion Failed",
        message: err.response?.data?.error || "Unable to delete paper.",
      });
    }
  };

  const handleRequestDelete = async (event) => {
    event.preventDefault();

    if (!deleteTarget) return;
    if (!deleteReason.trim()) {
      setPopup({
        type: "error",
        title: "Missing Reason",
        message: "Please provide a reason for the deletion request.",
      });
      return;
    }

    setDeleteSubmitting(true);
    try {
      const { data } = await api.post(`/papers/${deleteTarget.id}/request-delete`, {
        reason: deleteReason,
      });
      setPopup({
        type: "success",
        title: "Request Submitted",
        message: data.message || "Deletion request submitted for admin review.",
      });
      setDeleteTarget(null);
      setDeleteReason("");
      fetchPapers();
    } catch (err) {
      setPopup({
        type: "error",
        title: "Request Error",
        message: err.response?.data?.error || "Unable to submit deletion request.",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="subject-page">
      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`popup-icon-badge popup-icon-${popup.type}`}>
              {popup.type === "success" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : popup.type === "duplicate" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <h3 className="popup-title">
              {popup.title || (popup.type === "duplicate" ? "Paper Already Exists" : popup.type === "success" ? "Upload Successful" : "Notice")}
            </h3>
            <p className="popup-message">{popup.message}</p>
            <div className="popup-actions">
              <button type="button" className="popup-confirm-btn" onClick={() => setPopup(null)}>
                OK
              </button>
            </div>
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
        <Link to="/home" className="back-link">Back to Home</Link>
      </nav>

      <div className="subject-header">
        <h2>
          {subject}: {year === "Y1GenAI" ? "Year 1 GenAI" : (String(year).toLowerCase().startsWith("y") ? `Year ${year.slice(1)}` : (["1", "2", "3"].includes(String(year)) ? `Year ${year}` : year))}
        </h2>
        {canUpload ? (
          <button className="upload-toggle-btn" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "Cancel" : "Upload Paper or Note"}
          </button>
        ) : null}
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
              <option value="Past Paper">Past Paper</option>
              <option value="Notes">Notes</option>
              {role !== "student" && <option value="Assignment">Assignment</option>}
              <option value="Quiz">Quiz</option>
            </select>

            <label>File (PDF or Word document only)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
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
            {papers.map((paper) => {
              const isOwnerOrAdmin = Boolean(
                token && (paper.uploadedBy === username || role === "admin")
              );

              return (
                <div key={paper.id} className="paper-card">
                  <div className="paper-info">
                    <strong>{paper.title}</strong>
                    <span className="paper-meta">
                      {paper.type} • Uploaded by {paper.uploadedBy} • {new Date(paper.uploadedAt).toLocaleDateString()}
                    </span>
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
                    <div className="more-menu-container">
                      <button
                        type="button"
                        className="more-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          document.querySelectorAll(".more-menu.open").forEach((m) => {
                            if (m !== menu) m.classList.remove("open");
                          });
                          menu.classList.toggle("open");
                        }}
                      >
                        ⋮
                      </button>
                      <div className="more-menu">
                        <a
                          href={paper.downloadUrl || `/api/papers/${paper.id}/download`}
                          className="more-menu-item"
                        >
                          Download
                        </a>
                        {isOwnerOrAdmin && (
                          <button
                            type="button"
                            className="more-menu-item"
                            onClick={() => handleOpenEdit(paper)}
                          >
                            Edit
                          </button>
                        )}
                        {isOwnerOrAdmin ? (
                          <button
                            type="button"
                            className="more-menu-item text-danger"
                            onClick={() => handleDirectDelete(paper)}
                          >
                            Delete
                          </button>
                        ) : (
                          token && (
                            <button
                              type="button"
                              className="more-menu-item"
                              onClick={() => handleOpenDeleteRequest(paper)}
                            >
                              Request Deletion
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export default SubjectPage;

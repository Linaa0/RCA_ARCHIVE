import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import "./SubjectPage.css";
import api, { openPaperDownload } from "../services/api";
import { RCA_CLASSES } from "./ui/ClassChips";
import SubjectMaterials from "./SubjectMaterials";
import { TermSelector, TermBadge, TermMenu, Toast } from "./ui";
import { useRealtime } from "../hooks/useRealtime";

function SubjectPage() {
  const { year, subject } = useParams();

  const [papers, setPapers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadTerm, setUploadTerm] = useState(null);
  const [termError, setTermError] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Past Paper");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadClassId, setUploadClassId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [userClassId, setUserClassId] = useState("");

  const [popup, setPopup] = useState(null);
  const [toast, setToast] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    year: "",
    type: "",
    term: 1,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Jump bar and mobile collapse state
  const [activeJumpSection, setActiveJumpSection] = useState("1");
  const [collapsedSections, setCollapsedSections] = useState({});

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");
  const canUpload = !!token;
  const yearNumber = String(year).match(/[123]/)?.[0];
  const availableClasses = year === "Y1GenAI"
    ? RCA_CLASSES.filter((item) => item.id === "Y1GenAI")
    : RCA_CLASSES.filter((item) => String(item.year) === yearNumber && item.id !== "Y1GenAI");

  const { subscribe } = useRealtime();

  useEffect(() => {
    let isMounted = true;
    api.get("/me")
      .then(({ data }) => {
        const classId = data?.user?.class || "";
        if (!isMounted) return;
        setUserClassId(classId);
        setUploadClassId(availableClasses.some((item) => item.id === classId)
          ? classId
          : availableClasses[0]?.id || "");
      })
      .catch((error) => {
        console.error("Could not load user profile class:", error);
        setUploadClassId((current) => current || availableClasses[0]?.id || "");
      });
    return () => { isMounted = false; };
  }, [year]);

  // Close menus when clicking outside
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
    setFetchError("");
    try {
      const params = new URLSearchParams({ subject, year, withMeta: "1" });
      if (classFilter) params.append("classId", classFilter);
      if (typeFilter !== "All Types") params.append("type", typeFilter);
      if (search) params.append("search", search);
      params.append("sort", "top");

      const { data } = await api.get(`/papers?${params}`);
      const items = Array.isArray(data) ? data : (data?.items || []);
      setPapers(items);
    } catch (err) {
      console.error("Could not load papers:", err);
      setFetchError("Could not load papers for this subject.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [subject, year, typeFilter, classFilter]);

  // Real-time synchronization
  useEffect(() => {
    const unsubCreated = subscribe("paper:created", (paper) => {
      if (paper && String(paper.subject).trim().toLowerCase() === String(subject).trim().toLowerCase()) {
        setPapers((prev) => [paper, ...prev.filter((p) => p.id !== paper.id)]);
      }
    });

    const unsubUpdated = subscribe("paper:updated", (paper) => {
      if (paper) {
        setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...p, ...paper } : p)));
      }
    });

    const unsubDeleted = subscribe("paper:deleted", (data) => {
      const targetId = data?.id || data;
      if (targetId) {
        setPapers((prev) => prev.filter((p) => p.id !== targetId));
      }
    });

    return () => {
      unsubCreated?.();
      unsubUpdated?.();
      unsubDeleted?.();
    };
  }, [subscribe, subject]);

  // Scroll spy for sticky jump bar
  useEffect(() => {
    const handleScroll = () => {
      const sectionKeys = ["1", "2", "3", "unset"];
      const scrollPos = window.scrollY + 120;

      for (let i = sectionKeys.length - 1; i >= 0; i--) {
        const el = document.getElementById(`term-section-${sectionKeys[i]}`);
        if (el && el.offsetTop <= scrollPos) {
          setActiveJumpSection(sectionKeys[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openUploadForTerm = (termNum) => {
    setUploadTerm(termNum);
    setTermError("");
    setShowUpload(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setTermError("");

    if (!uploadTerm) {
      setTermError("Choose Term 1, Term 2 or Term 3");
      return;
    }

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
    formData.append("term", String(uploadTerm));
    if (uploadClassId) formData.append("classId", uploadClassId);
    formData.append("type", type);

    try {
      const res = await api.post("/upload", formData);
      setPopup({
        type: "success",
        title: "Upload Successful",
        message: res.data?.message || `"${title}" has been uploaded to ${subject}.`,
      });
      setTitle("");
      setFile(null);
      setUploadTerm(null);
      setShowUpload(false);
      fetchPapers();
    } catch (err) {
      if (err.response?.status === 409) {
        setPopup({
          type: "duplicate",
          title: "Paper Already Exists",
          message: err.response.data.message,
        });
      } else if (err.response?.data?.field === "term") {
        setTermError(err.response.data.error || "Choose Term 1, Term 2 or Term 3");
      } else {
        setPopup({
          type: "error",
          title: "Upload Error",
          message: err.response?.data?.error || "Upload failed. Please try again.",
        });
      }
    } finally {
      setUploading(false);
    }
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
      term: paper.term || 1,
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
        term: editForm.term,
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

  // Group papers by term
  const term1Papers = useMemo(() => papers.filter((p) => p.term === 1 || p.term === "1"), [papers]);
  const term2Papers = useMemo(() => papers.filter((p) => p.term === 2 || p.term === "2"), [papers]);
  const term3Papers = useMemo(() => papers.filter((p) => p.term === 3 || p.term === "3"), [papers]);
  const unsetPapers = useMemo(() => papers.filter((p) => !p.term || p.term === "unset"), [papers]);

  const sections = useMemo(() => {
    const list = [
      { key: "1", title: "Term 1", termNumber: 1, items: term1Papers, accentClass: "term-section-card--t1" },
      { key: "2", title: "Term 2", termNumber: 2, items: term2Papers, accentClass: "term-section-card--t2" },
      { key: "3", title: "Term 3", termNumber: 3, items: term3Papers, accentClass: "term-section-card--t3" },
    ];
    if (unsetPapers.length > 0) {
      list.push({
        key: "unset",
        title: "Term not set",
        termNumber: null,
        items: unsetPapers,
        accentClass: "term-section-card--unset",
      });
    }
    return list;
  }, [term1Papers, term2Papers, term3Papers, unsetPapers]);

  // Set initial open collapsible section on mobile
  useEffect(() => {
    const firstNonEmpty = sections.find((s) => s.items.length > 0) || sections[0];
    if (firstNonEmpty) {
      setCollapsedSections((prev) => ({
        ...prev,
        [firstNonEmpty.key]: false,
      }));
    }
  }, [sections]);

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const scrollToSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: false }));
    const el = document.getElementById(`term-section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveJumpSection(key);
    }
  };

  return (
    <div className="subject-page">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

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
              <TermSelector
                value={editForm.term}
                onChange={(t) => setEditForm((c) => ({ ...c, term: t }))}
                label="Academic term *"
              />

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
          <button
            className="upload-toggle-btn"
            onClick={() => {
              setShowUpload(!showUpload);
              if (!showUpload) {
                setUploadTerm(null);
                setTermError("");
              }
            }}
          >
            {showUpload ? "Cancel" : "Upload Paper or Note"}
          </button>
        ) : null}
      </div>

      {canUpload && showUpload && (
        <div className="upload-form-box">
          <h3>Upload a New Paper or Note</h3>
          <form onSubmit={handleUpload}>
            <TermSelector
              value={uploadTerm}
              onChange={(val) => {
                setUploadTerm(val);
                setTermError("");
              }}
              error={termError}
              id="upload-term-selector"
            />

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

            <label htmlFor="upload-class">Cohort</label>
            <select
              id="upload-class"
              value={uploadClassId}
              onChange={(e) => setUploadClassId(e.target.value)}
              required
            >
              {availableClasses.map((classOption) => (
                <option key={classOption.id} value={classOption.id}>
                  {classOption.label}{classOption.id === userClassId ? " (your class)" : ""}
                </option>
              ))}
            </select>

            <label>
              File (PDF or Word document only)
              {!uploadTerm && (
                <span style={{ fontSize: "12px", color: "var(--color-danger, #EF4444)", marginLeft: "8px" }}>
                  Choose a term first
                </span>
              )}
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              disabled={!uploadTerm}
              onChange={(e) => setFile(e.target.files[0])}
              required
            />

            <button
              type="submit"
              className="upload-btn"
              disabled={uploading || !uploadTerm}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      )}

      {/* Type and Class Filters above sections */}
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
        <select
          aria-label="Filter papers by cohort"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All classes</option>
          {availableClasses.map((classOption) => (
            <option key={classOption.id} value={classOption.id}>{classOption.label}</option>
          ))}
        </select>
        <button className="search-btn" onClick={fetchPapers}>Search</button>
      </div>

      {fetchError && (
        <div style={{ background: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#EF4444", padding: "12px 18px", borderRadius: "8px", margin: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{fetchError}</span>
          <button type="button" className="upload-to-term-btn" onClick={fetchPapers}>Retry</button>
        </div>
      )}

      {/* Sticky Jump Bar */}
      <div className="sticky-jump-bar" role="navigation" aria-label="Jump to academic term">
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-muted)", marginRight: "4px" }}>
          Terms:
        </span>
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            className={`jump-bar-btn ${activeJumpSection === sec.key ? "jump-bar-btn--active" : ""}`}
            onClick={() => scrollToSection(sec.key)}
          >
            <span>{sec.title}</span>
            <span className="jump-bar-count">{sec.items.length}</span>
          </button>
        ))}
      </div>

      {/* Grouped Section Cards */}
      <div className="term-sections-wrapper">
        {sections.map((sec) => {
          const isCollapsed = Boolean(collapsedSections[sec.key]);
          const itemCount = sec.items.length;
          const countBadgeText = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

          return (
            <section
              key={sec.key}
              id={`term-section-${sec.key}`}
              className={`term-section-card ${sec.accentClass}`}
            >
              <div
                className="term-section-header"
                onClick={() => toggleSection(sec.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSection(sec.key);
                  }
                }}
              >
                <div className="term-section-title-wrap">
                  <h3 className="term-section-title">{sec.title}</h3>
                  {sec.key === "unset" ? (
                    <TermBadge term={null} size="sm" />
                  ) : (
                    <span className="term-section-count-pill">
                      {countBadgeText}
                    </span>
                  )}
                </div>

                <div className="term-section-header-actions" onClick={(e) => e.stopPropagation()}>
                  <svg
                    className={`term-section-chevron ${!isCollapsed ? "term-section-chevron--open" : ""}`}
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onClick={() => toggleSection(sec.key)}
                    style={{ cursor: "pointer" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {!isCollapsed && (
                <div className="term-section-body">
                  {loading && papers.length === 0 ? (
                    <div className="term-skeleton-list">
                      <div className="term-skeleton-card" />
                      <div className="term-skeleton-card" />
                    </div>
                  ) : sec.items.length === 0 ? (
                    <div className="term-section-empty">
                      <p>No papers yet for {sec.title}</p>
                      {canUpload && sec.termNumber && (
                        <button
                          type="button"
                          className="upload-to-term-btn"
                          onClick={() => openUploadForTerm(sec.termNumber)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Upload to {sec.title}
                        </button>
                      )}
                    </div>
                  ) : (
                    sec.items.map((paper) => {
                      const isOwnerOrAdmin = Boolean(
                        token && (paper.uploadedBy === username || role === "admin" || role === "teacher")
                      );

                      return (
                        <div key={paper.id} className="paper-card">
                          <div className="paper-info">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                              <strong>{paper.title}</strong>
                              <TermBadge term={paper.term} size="sm" />
                            </div>
                            <span className="paper-meta">
                              {paper.type} • {paper.classLabel || paper.uploaderClassId || paper.classId || paper.class || paper.year || "Class not specified"} • Uploaded by {paper.uploadedBy} • {new Date(paper.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="paper-actions">
                            <TermMenu
                              item={paper}
                              itemType="paper"
                              user={{ id: username, email: username, role }}
                              prominent={!paper.term}
                              onTermChange={(newTerm, updatedPaper) => {
                                setPapers((prev) =>
                                  prev.map((p) => (p.id === updatedPaper.id ? updatedPaper : p))
                                );
                              }}
                              onNotify={(n) => setToast(n)}
                            />

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
                                <button
                                  type="button"
                                  className="more-menu-item"
                                  onClick={() => openPaperDownload(paper.id)}
                                >
                                  Download
                                </button>
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
                    })
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {token && <SubjectMaterials subject={subject} />}
    </div>
  );
}

export default SubjectPage;

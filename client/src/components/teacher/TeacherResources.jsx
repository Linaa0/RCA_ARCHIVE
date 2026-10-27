import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import { DownloadIcon, PlusIcon } from "../ui/Icons";
import { errorMessage, formatDateTime } from "../assignments/common";
import { downloadFrom } from "../assignments/fileUtils";
import { DEMO_RESOURCES } from "./demoData";
import { TermBadge, TermSelector, TermFilter, TermMenu } from "../ui";
import useRealtime from "../../hooks/useRealtime";
import "../assignments/assignments.css";

const TABS = [
  { key: "notes", label: "Uploaded Notes" },
  { key: "past-paper", label: "Uploaded Past Papers" },
];

export default function TeacherResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [tab, setTab] = useState("notes");
  const [termFilter, setTermFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [term, setTerm] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("notes");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState(null);

  const { subscribe } = useRealtime();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/teacher/resources");
      const items = data.resources || [];
      setIsDemo(items.length === 0);
      setResources(items.length ? items : DEMO_RESOURCES);
      setError("");
    } catch (err) {
      setResources(DEMO_RESOURCES);
      setIsDemo(true);
      setError(errorMessage(err, "Could not load your resources."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubs = [
      subscribe("resource:created", () => load()),
      subscribe("resource:updated", () => load()),
      subscribe("resource:deleted", () => load()),
    ];
    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [subscribe, load]);

  const resetForm = () => {
    setTerm(null);
    setTitle("");
    setType("notes");
    setSubject("");
    setYear("");
    setFile(null);
  };

  const closeUpload = () => {
    if (saving) return;
    setUploadOpen(false);
    setFormError("");
    resetForm();
  };

  const uploadResource = async (event) => {
    event.preventDefault();
    if (!term) {
      setFormError("Choose Term 1, Term 2 or Term 3.");
      return;
    }
    if (!file) {
      setFormError("Choose a PDF or document to upload.");
      return;
    }

    setSaving(true);
    setFormError("");
    setNotice("");
    const body = new FormData();
    body.append("term", String(term));
    body.append("title", title.trim());
    body.append("type", type);
    body.append("subject", subject.trim());
    body.append("year", year.trim());
    body.append("file", file);

    try {
      await api.post("/teacher/resources", body);
      setNotice("Resource uploaded successfully.");
      setUploadOpen(false);
      resetForm();
      await load();
    } catch (err) {
      if (err?.response?.data?.field === "term") {
        setFormError("Choose Term 1, Term 2 or Term 3.");
      } else {
        setFormError(errorMessage(err, "Could not upload this resource."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResourceTermChanged = (resourceId, newTerm) => {
    setResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, term: newTerm } : r))
    );
  };

  const openResource = (resource) => {
    if (resource.isDemo) return;
    const opened = window.open(
      `/view/${resource.id}?type=resource&name=${encodeURIComponent(resource.originalName || resource.title)}`,
      "_blank"
    );
    if (!opened) {
      setError("Allow pop-ups to open the resource in a new tab.");
      return;
    }
    opened.opener = null;
  };

  const visibleResources = resources
    .filter((resource) => resource.type === tab)
    .filter((resource) => {
      if (termFilter === "all") return true;
      if (termFilter === "unset") return !resource.term;
      return Number(resource.term) === Number(termFilter);
    });

  const countFor = (typeKey) => resources.filter((resource) => resource.type === typeKey).length;

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">Teaching materials</span>
          <h1 className="asg-title">Resources</h1>
          <p className="asg-sub">Manage the notes and past papers you have uploaded.</p>
        </div>
        <Button icon={<PlusIcon size={16} />} onClick={() => { setFormError(""); setUploadOpen(true); }}>
          Upload resource
        </Button>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {notice && <div className="asg-alert success">{notice}</div>}
      {isDemo && <div className="asg-alert info">Showing sample resources for preview. Sample files cannot be opened or downloaded.</div>}

      <div className="asg-tabs" role="tablist" aria-label="Resource type">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`asg-tab ${tab === item.key ? "active" : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label} ({countFor(item.key)})
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <TermFilter selected={termFilter} onSelect={setTermFilter} />
      </div>

      <div className="asg-panel">
        {loading ? (
          <p className="asg-sub">Loading resources...</p>
        ) : visibleResources.length === 0 ? (
          <div className="asg-empty">No {tab === "notes" ? "notes" : "past papers"} matching your filter. Use "Upload resource" to add one.</div>
        ) : (
          <div className="th-table-wrap">
            <div className="th-table th-resource-table">
              <div className="th-tr th-th th-resource-row">
                <div>Resource</div>
                <div>Subject / year</div>
                <div>Uploaded</div>
                <div>File</div>
                <div>Actions</div>
              </div>
              {visibleResources.map((resource) => (
                <div className="th-tr th-resource-row" key={resource.id}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span className="th-cell-title">{resource.title}</span>
                      <TermBadge term={resource.term} size="sm" />
                    </div>
                    {resource.isDemo && <Badge variant="warning" size="sm">Sample</Badge>}
                  </div>
                  <div className="th-cell-sub">{[resource.subject, resource.year].filter(Boolean).join(" • ") || "N/A"}</div>
                  <div className="th-cell-time">{formatDateTime(resource.uploadedAt)}</div>
                  <div className="th-cell-sub">{resource.originalName}</div>
                  <div className="th-row-actions th-resource-actions">
                    {!resource.isDemo && (
                      <TermMenu
                        item={resource}
                        type="resource"
                        onTermChanged={(newTerm) => handleResourceTermChanged(resource.id, newTerm)}
                      />
                    )}
                    <Button size="sm" variant="outline" disabled={resource.isDemo} onClick={() => openResource(resource)}>View</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={resource.isDemo}
                      onClick={() => downloadFrom(`/teacher/resources/${resource.id}/file?download=1`, resource.originalName).catch((err) => setError(errorMessage(err, "Could not download this resource.")))}
                    >
                      <DownloadIcon size={14} /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={uploadOpen} onClose={closeUpload} title="Upload resource" maxWidth="620px">
        <form className="asg-form" onSubmit={uploadResource}>
          {formError && <div className="asg-alert error">{formError}</div>}
          <p className="asg-sub" style={{ marginTop: 0 }}>Upload a note or past paper for your resource library.</p>

          <div className="asg-field">
            <label id="resource-term-label">Which term is this for? *</label>
            <TermSelector
              value={term}
              onChange={(val) => {
                setTerm(val);
                setFormError("");
              }}
              error={Boolean(formError && !term)}
            />
          </div>

          <div className="asg-field">
            <label htmlFor="resource-type">Resource type</label>
            <select id="resource-type" className="asg-input" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="notes">Notes</option>
              <option value="past-paper">Past Paper</option>
            </select>
          </div>
          <div className="asg-field">
            <label htmlFor="resource-title">Title</label>
            <input id="resource-title" className="asg-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
          </div>
          <div className="asg-field">
            <label htmlFor="resource-subject">Subject (optional)</label>
            <input id="resource-subject" className="asg-input" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={100} />
          </div>
          <div className="asg-field">
            <label htmlFor="resource-year">Year or class (optional)</label>
            <input id="resource-year" className="asg-input" value={year} onChange={(event) => setYear(event.target.value)} maxLength={30} placeholder="For example, Year 2 or Y2A" />
          </div>
          <div className="asg-field">
            <label htmlFor="resource-file">File (PDF or document, up to 20 MB) *</label>
            {!term ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm, 8px)",
                  background: "var(--color-bg)",
                  border: "1px dashed var(--color-border)",
                  color: "var(--color-muted)",
                  fontSize: "0.85rem",
                }}
              >
                Choose a term first
              </div>
            ) : (
              <input id="resource-file" className="asg-input" type="file" accept=".pdf,.doc,.docx,.zip,.txt,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
            )}
          </div>
          <div className="asg-form-actions">
            <Button variant="secondary" onClick={closeUpload}>Cancel</Button>
            <Button type="submit" loading={saving}>Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

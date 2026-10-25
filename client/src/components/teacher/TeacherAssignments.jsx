import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { EyeIcon, PlusIcon, UploadIcon } from "../ui/Icons";
import { RCA_CLASSES } from "../ui/ClassChips";
import AssignmentTable from "../assignments/AssignmentTable";
import { formatDateTime, toLocalInput, errorMessage } from "../assignments/common";
import { downloadFrom } from "../assignments/fileUtils";
import { DEMO_ASSIGNMENTS } from "./demoData";
import "../assignments/assignments.css";

const YEARS = [1, 2, 3];
const streamLabel = (stream) => (stream === "GenAI" ? "Gen AI" : stream);

function AssignmentForm({ initial, onCancel, onSaved }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    title: initial?.title || "",
    subject: initial?.subject || "",
    description: initial?.description || "",
    givenAt: toLocalInput(initial?.givenAt || null),
    deadline: initial ? toLocalInput(initial.deadline) : toLocalInput(null, 7),
    classes: initial?.classes || [],
    studentIds: initial?.studentIds || [],
  });
  const [file, setFile] = useState(null);
  const [showStudents, setShowStudents] = useState((initial?.studentIds || []).length > 0);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (showStudents && students.length === 0) {
      api
        .get("/teacher/students")
        .then(({ data }) => setStudents(data.students || []))
        .catch(() => setError("Could not load the student list."));
    }
  }, [showStudents, students.length]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleClass = (id) =>
    setForm((f) => ({ ...f, classes: f.classes.includes(id) ? f.classes.filter((c) => c !== id) : [...f.classes, id] }));

  const toggleYear = (year) => {
    const ids = RCA_CLASSES.filter((c) => c.year === year).map((c) => c.id);
    setForm((f) => {
      const all = ids.every((id) => f.classes.includes(id));
      return { ...f, classes: all ? f.classes.filter((c) => !ids.includes(c)) : [...new Set([...f.classes, ...ids])] };
    });
  };

  const toggleStudent = (id) =>
    setForm((f) => ({
      ...f,
      studentIds: f.studentIds.includes(id) ? f.studentIds.filter((s) => s !== id) : [...f.studentIds, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Please enter the title.");
    if (!form.givenAt) return setError("Please choose the time the assignment is given.");
    if (!form.deadline) return setError("Please choose the deadline.");
    if (new Date(form.deadline) <= new Date(form.givenAt)) return setError("The deadline must be after the time given.");
    if (form.classes.length === 0 && form.studentIds.length === 0) {
      return setError("Choose at least one class (or an individual student).");
    }

    const body = new FormData();
    body.append("title", form.title);
    body.append("subject", form.subject);
    body.append("description", form.description);
    body.append("givenAt", new Date(form.givenAt).toISOString());
    body.append("deadline", new Date(form.deadline).toISOString());
    body.append("classes", JSON.stringify(form.classes));
    body.append("studentIds", JSON.stringify(form.studentIds));
    if (file) body.append("file", file);

    setSaving(true);
    try {
      if (editing) await api.put(`/assignments/${initial.id}`, body);
      else await api.post("/assignments", body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const visibleStudents = students.filter((s) =>
    `${s.name} ${s.email} ${s.classLabel}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <form className="asg-form" onSubmit={submit}>
      {error && <div className="asg-alert error">{error}</div>}

      <div className="asg-field">
        <label htmlFor="asg-title">Title of the assignment *</label>
        <input id="asg-title" className="asg-input" value={form.title} onChange={set("title")} maxLength={150} placeholder="e.g. Build a REST API" />
      </div>

      <div className="asg-field">
        <label htmlFor="asg-subject">Subject</label>
        <input id="asg-subject" className="asg-input" value={form.subject} onChange={set("subject")} maxLength={100} placeholder="e.g. Web Development" />
      </div>

      <div className="asg-field">
        <label htmlFor="asg-desc">Instructions</label>
        <textarea id="asg-desc" className="asg-textarea" value={form.description} onChange={set("description")} placeholder="Explain what the students must do…" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <div className="asg-field">
          <label htmlFor="asg-given">Time given *</label>
          <input id="asg-given" type="datetime-local" className="asg-input" value={form.givenAt} onChange={set("givenAt")} />
        </div>
        <div className="asg-field">
          <label htmlFor="asg-deadline">Deadline time *</label>
          <input id="asg-deadline" type="datetime-local" className="asg-input" value={form.deadline} onChange={set("deadline")} />
        </div>
      </div>

      <div className="asg-field">
        <label>Upload the assignment file</label>
        <div className="th-upload">
          <label className="th-upload-btn">
            <UploadIcon size={16} />
            {file || initial?.attachmentName ? "Change file" : "Upload file"}
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <span className="asg-meta" style={{ marginTop: 0 }}>
            {file ? file.name : initial?.attachmentName ? `Current: ${initial.attachmentName}` : "PDF, Word, ZIP… (max 20 MB, optional)"}
          </span>
        </div>
      </div>

      <div className="asg-field">
        <label>Give it to *</label>
        <div className="th-class-table">
          {YEARS.map((year) => {
            const classes = RCA_CLASSES.filter((c) => c.year === year);
            const allOn = classes.every((c) => form.classes.includes(c.id));
            return (
              <div className="th-class-col" key={year}>
                <div className="th-class-head">
                  <span>Year {year}</span>
                  <button type="button" onClick={() => toggleYear(year)}>{allOn ? "Clear" : "All"}</button>
                </div>
                {classes.map((c) => (
                  <label className="th-class-opt" key={c.id}>
                    <input type="checkbox" checked={form.classes.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    {streamLabel(c.stream)}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
        <div className="asg-meta">Tick one or more classes. You can also add individual students below.</div>
      </div>

      <div className="asg-field">
        <button type="button" className="th-link-btn" onClick={() => setShowStudents((v) => !v)}>
          {showStudents ? "− Hide individual students" : "+ Add individual students"}
          {form.studentIds.length > 0 && ` (${form.studentIds.length} selected)`}
        </button>
        {showStudents && (
          <>
            <input className="asg-input" placeholder="Search by name, email or class…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="asg-students">
              {visibleStudents.length === 0 && <div className="asg-meta" style={{ padding: "8px 0" }}>No students found.</div>}
              {visibleStudents.map((s) => (
                <label key={s.id}>
                  <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span>
                    {s.name} <span className="asg-meta">({s.classLabel})</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="asg-form-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>{editing ? "Save changes" : "Give assignment"}</Button>
      </div>
    </form>
  );
}

export default function TeacherAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [notice, setNotice] = useState("");
  const [formState, setFormState] = useState({ open: false, assignment: null });
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/assignments");
      const items = data.assignments || [];
      setIsDemo(items.length === 0);
      setAssignments(items.length ? items : DEMO_ASSIGNMENTS);
      setError("");
    } catch (err) {
      setAssignments(DEMO_ASSIGNMENTS);
      setIsDemo(true);
      setError(errorMessage(err, "Could not load assignments."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setFormState({ open: true, assignment: null });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/assignments/${confirmDelete.id}`);
      setNotice("Assignment deleted.");
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const closeForm = () => setFormState({ open: false, assignment: null });

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">Assignments</span>
          <h1 className="asg-title">Your assignments</h1>
          <p className="asg-sub">Everything you gave to your classes and students.</p>
        </div>
        <Button icon={<PlusIcon size={16} />} onClick={() => setFormState({ open: true, assignment: null })}>
          Give assignment
        </Button>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {notice && <div className="asg-alert success">{notice}</div>}
      {isDemo && <div className="asg-alert info">Showing sample teacher data for preview. Demo assignments are read-only.</div>}

      <div className="asg-panel">
        {loading ? (
          <p className="asg-sub">Loading…</p>
        ) : (
          <AssignmentTable
            rows={assignments}
            emptyText="You have not given any assignment yet. Click Give assignment."
            renderActions={(a) =>
              a.isDemo ? (
                <span className="th-cell-sub">Sample</span>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setViewing(a)}>View</Button>
                  <Button size="sm" variant="secondary" onClick={() => setFormState({ open: true, assignment: a })}>Edit</Button>
                  <Button size="sm" variant="ghost" style={{ color: "#DC2626" }} onClick={() => setConfirmDelete(a)}>Delete</Button>
                </>
              )
            }
          />
        )}
      </div>

      <Modal isOpen={formState.open} onClose={closeForm} title={formState.assignment ? "Edit assignment" : "Give assignment"} maxWidth="680px">
        {formState.open && (
          <AssignmentForm
            initial={formState.assignment}
            onCancel={closeForm}
            onSaved={() => {
              setNotice(formState.assignment ? "Assignment updated." : "Assignment given to the students.");
              closeForm();
              load();
            }}
          />
        )}
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.title || ""} maxWidth="600px">
        {viewing && (
          <div className="asg-modal-scroll">
            <div className="asg-meta">
              {viewing.subject || "General"} • Given {formatDateTime(viewing.givenAt)} • Deadline {formatDateTime(viewing.deadline)}
            </div>
            <div className="asg-section-title">Instructions</div>
            <div className="asg-desc" style={{ marginTop: 0 }}>{viewing.description || "No instructions written."}</div>
            {viewing.hasAttachment && (
              <div style={{ marginTop: 14, display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href={`/view/${viewing.id}?type=assignment&name=${encodeURIComponent(viewing.attachmentName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <Button size="sm" variant="primary">
                    <EyeIcon size={14} /> View
                  </Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => downloadFrom(`/assignments/${viewing.id}/attachment`, viewing.attachmentName)}>
                  Download {viewing.attachmentName}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete assignment?" maxWidth="440px">
        <p style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>
          "{confirmDelete?.title}" will be removed together with all its appeals. This cannot be undone.
        </p>
        <div className="asg-form-actions" style={{ marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

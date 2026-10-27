import React, { useState, useRef, useEffect } from "react";
import api from "../../services/api";
import { getTerms, normalizeTerm, getTermLabel } from "../../services/curriculum";
import "./TermMenu.css";

export default function TermMenu({
  item,
  itemType = "paper",
  user,
  onTermChange,
  onNotify,
  prominent = false,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!item || !user) return null;

  // Permission check
  const isUploader =
    user.id === item.uploadedById ||
    user.id === item.uploadedBy ||
    user.id === item.teacherId ||
    user.id === item.userId ||
    user.email === item.uploaderEmail ||
    user.email === item.uploadedByEmail;

  let canEdit = false;
  if (itemType === "paper") {
    canEdit = user.role === "admin" || user.role === "teacher" || isUploader;
  } else if (itemType === "resource") {
    canEdit = user.role === "admin" || (user.role === "teacher" && isUploader);
  } else if (itemType === "assignment") {
    canEdit = user.role === "admin" || (user.role === "teacher" && isUploader);
  }

  if (!canEdit) return null;

  const currentTerm = normalizeTerm(item.term);
  const terms = getTerms();

  const handleSelectTerm = async (newTerm) => {
    if (newTerm === currentTerm || busy) {
      setOpen(false);
      return;
    }

    const previousTerm = item.term;
    setOpen(false);
    setBusy(true);

    // Optimistic update
    onTermChange?.(newTerm, { ...item, term: newTerm });

    try {
      let endpoint = `/papers/${item.id}`;
      let method = "put";
      if (itemType === "resource") {
        endpoint = `/teacher/resources/${item.id}/term`;
        method = "patch";
      } else if (itemType === "assignment") {
        endpoint = `/assignments/${item.id}/term`;
        method = "patch";
      }

      const res = await api[method](endpoint, { term: newTerm });
      const targetLabel = getTermLabel(newTerm);
      onNotify?.({
        message: res.data?.message || `Moved to ${targetLabel}`,
        type: "success",
      });
    } catch (err) {
      // Rollback on error
      onTermChange?.(previousTerm, { ...item, term: previousTerm });
      const errMsg =
        err.response?.data?.error || "Could not change term. Reverting.";
      onNotify?.({ message: errMsg, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const isUnset = !currentTerm;
  const triggerLabel = isUnset ? (prominent ? "Set term" : "Term: Not set") : getTermLabel(currentTerm);

  return (
    <div className="term-menu-container" ref={containerRef}>
      <button
        type="button"
        className={`term-menu-trigger ${isUnset && prominent ? "term-menu-trigger--prominent" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        aria-haspopup="true"
        aria-expanded={open}
        title="Change academic term"
      >
        <span>{triggerLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="term-menu-dropdown" role="menu">
          {terms.map((t) => (
            <button
              key={t.value}
              type="button"
              role="menuitem"
              className={`term-menu-item ${currentTerm === t.value ? "term-menu-item--current" : ""}`}
              onClick={() => handleSelectTerm(t.value)}
            >
              <span>
                <span className={`term-menu-dot term-menu-dot--${t.value}`} />
                {t.label}
              </span>
              {currentTerm === t.value && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

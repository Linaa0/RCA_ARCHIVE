import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { openPaperDownload } from "../services/api";
import { authPatch } from "../utils/apiClient";
import Table from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import EmptyState from "./ui/EmptyState";
import { EyeIcon, DownloadIcon, SearchIcon, MaterialsIcon } from "./ui/Icons";
import { TermBadge, TermFilter, TermMenu } from "./ui";
import useRealtime from "../hooks/useRealtime";

export default function AdminPapers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTerm = searchParams.get("term") || "all";

  const [papers, setPapers] = useState([]);
  const [termCounts, setTermCounts] = useState({ 1: 0, 2: 0, 3: 0, unset: 0 });
  const [termFilter, setTermFilter] = useState(initialTerm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkTerm, setBulkTerm] = useState("1");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const { subscribe } = useRealtime();

  // Sync term filter if searchParam changes
  useEffect(() => {
    const param = searchParams.get("term");
    if (param && param !== termFilter) {
      setTermFilter(param);
    }
  }, [searchParams]);

  const loadPapers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = { withMeta: 1 };
      if (termFilter !== "all") params.term = termFilter;
      if (search.trim()) params.search = search.trim();

      const { data } = await api.get("/papers", { params });
      if (data && typeof data === "object" && Array.isArray(data.items)) {
        setPapers(data.items);
        if (data.termCounts) setTermCounts(data.termCounts);
      } else if (Array.isArray(data)) {
        setPapers(data);
      } else {
        setPapers([]);
      }
    } catch (err) {
      console.error("Failed to load papers for admin:", err);
      setError("Could not load papers. Please click Retry.");
    } finally {
      setLoading(false);
    }
  }, [termFilter, search]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  useEffect(() => {
    const unsubs = [
      subscribe("paper:created", () => loadPapers(true)),
      subscribe("paper:updated", () => loadPapers(true)),
      subscribe("paper:deleted", () => loadPapers(true)),
    ];
    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [subscribe, loadPapers]);

  const handleSelectTermFilter = (termKey) => {
    setTermFilter(termKey);
    setSearchParams(termKey === "all" ? {} : { tab: "papers", term: termKey });
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === papers.length && papers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(papers.map((p) => p.id || p._id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePaperTermChanged = (paperId, newTerm) => {
    setPapers((prev) =>
      prev.map((p) => (p.id === paperId || p._id === paperId ? { ...p, term: newTerm } : p))
    );
    loadPapers(true);
  };

  const handleApplyBulk = async () => {
    if (!selectedIds.length) return;
    setBulkSaving(true);
    setError("");
    try {
      const res = await authPatch("/api/admin/papers/term", {
        ids: selectedIds,
        term: Number(bulkTerm),
      });
      setNotice(`Updated term for ${res.updatedCount || selectedIds.length} paper(s).`);
      setBulkModalOpen(false);
      setSelectedIds([]);
      await loadPapers(false);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to update papers in bulk.");
    } finally {
      setBulkSaving(false);
    }
  };

  const columns = [
    {
      title: (
        <input
          type="checkbox"
          aria-label="Select all papers on page"
          checked={papers.length > 0 && selectedIds.length === papers.length}
          onChange={toggleSelectAll}
          style={{ cursor: "pointer" }}
        />
      ),
      key: "select",
      width: "48px",
      render: (_, p) => {
        const id = p.id || p._id;
        return (
          <input
            type="checkbox"
            aria-label={`Select paper ${p.title}`}
            checked={selectedIds.includes(id)}
            onChange={() => toggleSelectOne(id)}
            style={{ cursor: "pointer" }}
          />
        );
      },
    },
    {
      title: "Paper Title",
      key: "title",
      render: (_, p) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
            <strong style={{ fontSize: "0.92rem", color: "var(--color-text-primary)" }}>
              {p.title}
            </strong>
            <TermBadge term={p.term} size="sm" />
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
            {p.originalName || p.filename}
          </span>
        </div>
      ),
    },
    {
      title: "Subject",
      key: "subject",
      render: (_, p) => p.subject || "N/A",
    },
    {
      title: "Year / Class",
      key: "year",
      render: (_, p) => p.classLabel || p.year || "N/A",
    },
    {
      title: "Uploader",
      key: "uploader",
      render: (_, p) => (
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            {p.teacherName || p.uploadedBy || "Unknown"}
          </div>
          {p.uploadedByEmail && (
            <div style={{ fontSize: "0.76rem", color: "var(--color-text-tertiary)" }}>
              {p.uploadedByEmail}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Uploaded",
      key: "uploadedAt",
      render: (_, p) => (p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString() : "N/A"),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, p) => {
        const id = p.id || p._id;
        return (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <TermMenu
              item={p}
              type="paper"
              onTermChanged={(newTerm) => handlePaperTermChanged(id, newTerm)}
            />
            <a
              href={`/view/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Button variant="outline" size="xs">
                <EyeIcon size={13} /> View
              </Button>
            </a>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => openPaperDownload(id)}
              title="Download file"
            >
              <DownloadIcon size={13} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <section
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        padding: "32px",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header and Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            Past Papers and Academic Materials
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
            Review, filter by term, and bulk reassign terms across all student and faculty uploads.
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: "240px" }}>
            <Input
              icon={<SearchIcon size={16} />}
              placeholder="Search papers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => loadPapers(false)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error && <div className="asg-alert error">{error}</div>}
      {notice && <div className="asg-alert success">{notice}</div>}

      {/* Term Filter Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <TermFilter
          selected={termFilter}
          onSelect={handleSelectTermFilter}
          counts={termCounts}
        />
      </div>

      {/* Bulk Action Strip */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--color-bg)",
            border: "1px solid var(--color-primary)",
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: "0.92rem", color: "var(--color-text-primary)" }}>
              {selectedIds.length} paper{selectedIds.length > 1 ? "s" : ""} selected
            </strong>
            <Button variant="ghost" size="xs" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.86rem", color: "var(--color-text-secondary)" }}>Set term to:</span>
            <select
              value={bulkTerm}
              onChange={(e) => setBulkTerm(e.target.value)}
              className="asg-input"
              style={{ width: "120px", padding: "6px 10px", fontSize: "0.85rem" }}
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
            <Button variant="primary" size="sm" onClick={() => setBulkModalOpen(true)}>
              Apply to Selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.92rem" }}>Loading papers...</p>
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<MaterialsIcon size={40} />}
          title="No papers found"
          description="No past papers match your current search or term filter."
          actionText={termFilter !== "all" ? "Show All Terms" : undefined}
          onAction={termFilter !== "all" ? () => handleSelectTermFilter("all") : undefined}
        />
      ) : (
        <Table
          columns={columns}
          data={papers}
          rowKey={(p) => p.id || p._id}
          emptyText="No papers match your filter."
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Confirm Bulk Term Change"
        description={`Set Term ${bulkTerm} for ${selectedIds.length} selected paper(s)? This will update all selected items immediately across student and teacher archives.`}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <Button variant="secondary" size="sm" onClick={() => setBulkModalOpen(false)} disabled={bulkSaving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleApplyBulk} loading={bulkSaving}>
            Confirm and Apply
          </Button>
        </div>
      </Modal>
    </section>
  );
}

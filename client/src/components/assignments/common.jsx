import React from "react";
import Badge from "../ui/Badge";

export function formatDateTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// value for <input type="datetime-local">; offsetDays moves it from "now"
export function toLocalInput(value, offsetDays = 0) {
  const d = value ? new Date(value) : new Date();
  if (!value && offsetDays) d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

export function AppealBadge({ status }) {
  const map = {
    pending: { variant: "warning", label: "Appeal pending" },
    approved: { variant: "success", label: "Appeal approved" },
    rejected: { variant: "danger", label: "Appeal rejected" },
  };
  const item = map[status];
  return item ? <Badge variant={item.variant} size="sm">{item.label}</Badge> : null;
}

export function StudentStatusBadge({ status }) {
  const map = {
    pending: { variant: "indigo", label: "To do" },
    extended: { variant: "primary", label: "Extended" },
    overdue: { variant: "danger", label: "Overdue" },
  };
  const item = map[status] || { variant: "neutral", label: status };
  return <Badge variant={item.variant} size="sm">{item.label}</Badge>;
}

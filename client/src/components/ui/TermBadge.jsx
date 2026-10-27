import React from "react";
import { normalizeTerm, getTermLabel } from "../../services/curriculum";
import "./TermBadge.css";

export default function TermBadge({
  term,
  size = "md",
  className = "",
  style = {},
  showUnset = true,
}) {
  const norm = normalizeTerm(term);
  if (!norm && !showUnset) return null;

  const label = getTermLabel(term);
  const variantClass = norm ? `term-badge--t${norm}` : "term-badge--unset";
  const sizeClass = `term-badge--${size}`;

  return (
    <span
      className={`term-badge ${variantClass} ${sizeClass} ${className}`.trim()}
      style={style}
    >
      {label}
    </span>
  );
}

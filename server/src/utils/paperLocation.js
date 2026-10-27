const { CLASS_IDS, classLabel, getAcademicYear } = require("../config/classes");
const { normalizeTerm, termLabel } = require("../config/terms");

/**
 * Human readable year for a stored paper or resource. Prefers an exact class label
 * (for example "Year 1 Gen AI"), then "Year N", then the raw stored value.
 */
function yearLabelFor(item = {}) {
  const raw = String(item.classId || item.year || item.class || "").trim();
  const exact = CLASS_IDS.find((id) => id.toLowerCase() === raw.toLowerCase());
  if (exact === "Y1GenAI") return classLabel(exact);
  const academic = getAcademicYear(item.year || raw);
  if (academic) return `Year ${academic}`;
  return raw || "General";
}

/**
 * Where an item lives: "Year 2, Mathematics, Term 1" or "Year 2, Mathematics, Term not set".
 */
function describeLocation(item = {}) {
  const parts = [yearLabelFor(item)];
  if (item.subject) parts.push(item.subject);
  parts.push(termLabel(item.term));
  return parts.join(", ");
}

/**
 * Public description of an existing item, used by the duplicate 409 response.
 */
function describeExistingItem(item = {}) {
  const term = normalizeTerm(item.term);
  return {
    id: item.id,
    title: item.title,
    year: yearLabelFor(item),
    subject: item.subject,
    term,
    termLabel: termLabel(item.term),
    type: item.type || item.category || "past_paper",
    category: item.type || item.category || "past_paper",
    classId: item.classId || item.year,
    uploadedBy: item.uploadedBy,
    uploaderName: item.uploadedBy,
  };
}

module.exports = { yearLabelFor, describeLocation, describeExistingItem };

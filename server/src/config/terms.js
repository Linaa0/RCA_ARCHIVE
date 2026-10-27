/**
 * RCA Archive academic terms: single source of truth.
 *
 * A term is stored as a number (1, 2 or 3) on papers, teacher resources and
 * assignments. A missing term means "not set" (legacy records). Terms are never
 * guessed or backfilled.
 */

const TERMS = [
  { value: 1, label: "Term 1" },
  { value: 2, label: "Term 2" },
  { value: 3, label: "Term 3" },
];

const TERM_VALUES = TERMS.map((t) => t.value);
const TERM_NOT_SET_LABEL = "Term not set";
const TERM_REQUIRED_MESSAGE = "Choose Term 1, Term 2 or Term 3";

/**
 * Normalise user input to 1, 2 or 3. Accepts 1, "1", "term1", "Term 1", "TERM  2".
 * Returns null for anything else (including empty values, 0, 4, 1.5, "1a").
 */
function normalizeTerm(input) {
  if (input === undefined || input === null) return null;
  if (typeof input === "number") {
    return Number.isInteger(input) && TERM_VALUES.includes(input) ? input : null;
  }
  if (typeof input !== "string") return null;
  const match = input.trim().toLowerCase().match(/^(?:term\s*)?([123])$/);
  return match ? Number(match[1]) : null;
}

function isValidTerm(input) {
  return normalizeTerm(input) !== null;
}

function termLabel(term) {
  const value = normalizeTerm(term);
  return value ? `Term ${value}` : TERM_NOT_SET_LABEL;
}

/**
 * Validate a required term. Returns { valid, value, error, field }.
 */
function validateRequiredTerm(input) {
  const value = normalizeTerm(input);
  if (value === null) {
    return { valid: false, value: null, error: TERM_REQUIRED_MESSAGE, field: "term" };
  }
  return { valid: true, value };
}

/**
 * Parse a term filter query value: 1, 2, 3, "unset" or empty (no filter).
 * Returns { filter: null | 1 | 2 | 3 | "unset", invalid: boolean }.
 */
function parseTermFilter(input) {
  if (input === undefined || input === null) return { filter: null, invalid: false };
  const raw = String(input).trim().toLowerCase();
  if (!raw || raw === "all") return { filter: null, invalid: false };
  if (raw === "unset" || raw === "none" || raw === "notset") {
    return { filter: "unset", invalid: false };
  }
  const value = normalizeTerm(raw);
  return value ? { filter: value, invalid: false } : { filter: null, invalid: true };
}

/**
 * Build a MongoDB condition for a parsed term filter, or null when there is none.
 */
function termFilterCondition(filter) {
  if (filter === "unset") {
    return { $or: [{ term: { $exists: false } }, { term: null }] };
  }
  if (TERM_VALUES.includes(filter)) return { term: filter };
  return null;
}

function emptyTermCounts() {
  return { 1: 0, 2: 0, 3: 0, unset: 0 };
}

/**
 * Count items per term from a list (used for in-memory aggregations).
 */
function countByTerm(items) {
  const counts = emptyTermCounts();
  for (const item of items || []) {
    const value = normalizeTerm(item && item.term);
    if (value) counts[value] += 1;
    else counts.unset += 1;
  }
  return counts;
}

/**
 * Convert MongoDB $group output ([{ _id: 1|2|3|null, count }]) to term counts.
 */
function countsFromGroups(groups) {
  const counts = emptyTermCounts();
  for (const group of groups || []) {
    const value = normalizeTerm(group._id);
    if (value) counts[value] += group.count;
    else counts.unset += group.count;
  }
  return counts;
}

function getTermsPayload() {
  return TERMS.map((t) => ({ id: t.value, value: t.value, label: t.label }));
}

module.exports = {
  TERMS,
  TERM_VALUES,
  TERM_NOT_SET_LABEL,
  TERM_REQUIRED_MESSAGE,
  normalizeTerm,
  isValidTerm,
  termLabel,
  validateRequiredTerm,
  parseTermFilter,
  termFilterCondition,
  emptyTermCounts,
  countByTerm,
  countsFromGroups,
  getTermsPayload,
};

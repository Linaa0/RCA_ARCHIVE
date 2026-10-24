const sanitizeHtml = require("sanitize-html");

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "rca",
  "rcarchive",
  "system",
  "moderator",
  "staff",
  "official",
  "security",
  "help",
  "superuser",
  "guest",
  "null",
  "undefined",
  "anonymous",
]);

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
  "welcome123",
  "rca12345",
  "rcapassword",
]);

/**
 * Validates full name:
 * 2 to 60 characters, Unicode letters, spaces, apostrophes, hyphens and dots only.
 * Collapses repeated spaces.
 * Rejects URLs, HTML tags, control characters and pasted paragraphs.
 */
function validateFullName(raw) {
  if (typeof raw !== "string") {
    return { valid: false, message: "Full name is required." };
  }

  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(raw)) {
    return { valid: false, message: "Full name cannot contain control characters." };
  }

  // Reject URLs
  if (/https?:\/\/|www\./i.test(raw)) {
    return { valid: false, message: "Full name cannot contain web links or URLs." };
  }

  // Reject HTML tags
  if (/<[^>]*>/i.test(raw)) {
    return { valid: false, message: "Full name cannot contain HTML tags." };
  }

  // Collapse repeated whitespace
  const cleaned = raw.replace(/\s+/g, " ").trim();

  if (cleaned.length < 2 || cleaned.length > 60) {
    return { valid: false, message: "Full name must be between 2 and 60 characters." };
  }

  // Only Unicode letters, spaces, apostrophes, hyphens and dots
  const nameRegex = /^[\p{L}\s'\-.]+$/u;
  if (!nameRegex.test(cleaned)) {
    return {
      valid: false,
      message: "Full name may only contain letters, spaces, hyphens, dots and apostrophes.",
    };
  }

  return { valid: true, value: cleaned };
}

/**
 * Validates username:
 * 3 to 24 characters, lowercase letters, digits, underscore and dot.
 * Must start with a letter.
 * Checks reserved words list.
 */
function validateUsername(raw) {
  if (typeof raw !== "string") {
    return { valid: false, message: "Username is required." };
  }

  const username = raw.toLowerCase().trim();

  if (username.length < 3 || username.length > 24) {
    return { valid: false, message: "Username must be between 3 and 24 characters." };
  }

  if (!/^[a-z]/.test(username)) {
    return { valid: false, message: "Username must start with a lowercase letter." };
  }

  if (!/^[a-z0-9_.]+$/.test(username)) {
    return {
      valid: false,
      message: "Username may only contain lowercase letters, numbers, underscores and dots.",
    };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return { valid: false, message: "This username is reserved. Please choose another." };
  }

  return { valid: true, value: username };
}

/**
 * Validates email format and maximum length:
 * Standard RFC-compliant check, max 254 characters.
 */
function validateEmail(raw) {
  if (typeof raw !== "string") {
    return { valid: false, message: "Email is required." };
  }

  const email = raw.toLowerCase().trim();

  if (email.length === 0 || email.length > 254) {
    return { valid: false, message: "Email address cannot exceed 254 characters." };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Please provide a valid email address." };
  }

  return { valid: true, value: email };
}

/**
 * Validates password:
 * 8 to 64 characters with at least one letter and one number.
 * Rejects known common passwords.
 */
function validatePassword(raw) {
  if (typeof raw !== "string") {
    return { valid: false, message: "Password is required." };
  }

  if (raw.length < 8 || raw.length > 64) {
    return { valid: false, message: "Password must be between 8 and 64 characters long." };
  }

  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
    return { valid: false, message: "Password must contain at least one letter and one number." };
  }

  if (COMMON_PASSWORDS.has(raw.toLowerCase())) {
    return { valid: false, message: "This password is too common. Please choose a stronger password." };
  }

  return { valid: true, value: raw };
}

/**
 * Validates and sanitizes plain text fields (titles, subjects, descriptions, reasons):
 * Strict maximum lengths, plain text only, sanitized with sanitize-html (allow nothing).
 * Does not silently truncate: rejects if raw string exceeds maxLength.
 */
function validatePlainText(raw, { fieldName = "Text", minLength = 1, maxLength = 255, required = true } = {}) {
  if (raw === undefined || raw === null || raw === "") {
    if (required) {
      return { valid: false, message: `${fieldName} is required.` };
    }
    return { valid: true, value: "" };
  }

  if (typeof raw !== "string") {
    return { valid: false, message: `${fieldName} must be a text string.` };
  }

  const trimmed = raw.trim();

  if (required && trimmed.length < minLength) {
    return { valid: false, message: `${fieldName} must be at least ${minLength} characters.` };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      message: `${fieldName} exceeds maximum permitted length of ${maxLength} characters (received ${trimmed.length}).`,
    };
  }

  // Sanitize with sanitize-html allowing zero tags and zero attributes
  const sanitized = sanitizeHtml(trimmed, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  }).trim();

  // If HTML or scripts were stripped out and length changed significantly, check rejection
  if (/<[^>]*>/i.test(raw)) {
    return { valid: false, message: `${fieldName} cannot contain HTML formatting or markup tags.` };
  }

  return { valid: true, value: sanitized };
}

module.exports = {
  validateFullName,
  validateUsername,
  validateEmail,
  validatePassword,
  validatePlainText,
  RESERVED_USERNAMES,
  COMMON_PASSWORDS,
};

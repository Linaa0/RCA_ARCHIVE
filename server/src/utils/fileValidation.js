"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execFileSync, spawnSync } = require("child_process");

// Allowed MIME mappings
const EXTENSION_TO_MIME = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xls": "application/vnd.ms-excel",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/msword": ".doc",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.ms-excel": ".xls",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
};

// Check if Antivirus (clamscan or clamdscan) is available
function getAntivirusScanner() {
  try {
    const clamd = spawnSync("clamdscan", ["--version"], { timeout: 2000, stdio: "pipe" });
    if (clamd.status === 0) return "clamdscan";
  } catch (_) {}

  try {
    const clam = spawnSync("clamscan", ["--version"], { timeout: 2000, stdio: "pipe" });
    if (clam.status === 0) return "clamscan";
  } catch (_) {}

  return null;
}

function scanFileWithAntivirus(filePath) {
  const scanner = getAntivirusScanner();
  if (!scanner) {
    return { available: false, clean: true };
  }

  try {
    const result = spawnSync(scanner, ["--no-summary", filePath], {
      timeout: 15000,
      stdio: "pipe",
    });
    // Exit code 0 means clean, 1 means infected, 2 or higher means scan error
    if (result.status === 0) {
      return { available: true, clean: true };
    }
    const stdout = (result.stdout || "").toString();
    const stderr = (result.stderr || "").toString();
    const output = `${stdout} ${stderr}`.trim();
    return {
      available: true,
      clean: false,
      reason: output || "Infected file detected by antivirus scan",
    };
  } catch (err) {
    return { available: true, clean: false, reason: err.message };
  }
}

// 1. PDF Validator
function validatePdfStructure(buffer) {
  // Check header
  if (buffer.length < 32) {
    return { valid: false, error: "PDF file is too small or truncated." };
  }

  const headStr = buffer.slice(0, 1024).toString("latin1");
  if (!headStr.includes("%PDF-")) {
    return { valid: false, error: "Missing %PDF- header." };
  }

  // Reject polyglots: check for HTML, XML, script tags
  const textSample = buffer.slice(0, 2048).toString("utf8", 0, Math.min(buffer.length, 2048)).toLowerCase();
  if (
    textSample.includes("<html") ||
    textSample.includes("<script") ||
    textSample.includes("<svg") ||
    textSample.includes("<!doctype")
  ) {
    return { valid: false, error: "Polyglot file detected: HTML/script content inside PDF." };
  }

  // Check EOF trailer in last 2048 bytes
  const tailStart = Math.max(0, buffer.length - 2048);
  const tailStr = buffer.slice(tailStart).toString("latin1");
  if (!tailStr.includes("%%EOF")) {
    return { valid: false, error: "Missing %%EOF trailer in PDF." };
  }

  // Inspect whole buffer as latin1 for dangerous actions and scripts
  const fullContent = buffer.toString("latin1");

  // Check for catalog
  const hasCatalog = /\/Type\s*\/Catalog/i.test(fullContent) || /\/Root\s+\d+\s+\d+\s+R/i.test(fullContent);
  if (!hasCatalog) {
    return { valid: false, error: "Invalid PDF: catalog or document root missing." };
  }

  // Dangerous PDF features to reject:
  // - /JavaScript or /JS
  // - /Launch
  // - /SubmitForm or /ImportData
  // - /RichMedia
  // - /EmbeddedFiles
  if (/\/JavaScript\b/i.test(fullContent) || /\/JS\b/i.test(fullContent)) {
    return { valid: false, error: "Executable JavaScript actions are forbidden in PDF files." };
  }

  if (/\/Launch\b/i.test(fullContent)) {
    return { valid: false, error: "Launch actions are forbidden in PDF files." };
  }

  if (/\/SubmitForm\b/i.test(fullContent) || /\/ImportData\b/i.test(fullContent)) {
    return { valid: false, error: "Form submission actions are forbidden in PDF files." };
  }

  if (/\/RichMedia\b/i.test(fullContent)) {
    return { valid: false, error: "RichMedia actions are forbidden in PDF files." };
  }

  if (/\/EmbeddedFiles\b/i.test(fullContent)) {
    return { valid: false, error: "Embedded file actions are forbidden in PDF files." };
  }

  return { valid: true, detectedType: "pdf", detectedMime: "application/pdf" };
}

// 2. ZIP parser for OOXML (DOCX, PPTX, XLSX) and ZIP files
function parseZipEntries(buffer) {
  const entries = [];
  let eocdOffset = -1;

  // Search backward for End of Central Directory signature: 0x06054b50 (PK\x05\x06)
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return { valid: false, error: "Corrupted ZIP archive: End of Central Directory not found." };
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > 500) {
    return { valid: false, error: `ZIP contains too many entries (${totalEntries}). Maximum allowed is 500.` };
  }

  if (cdOffset + cdSize > buffer.length) {
    return { valid: false, error: "Corrupted ZIP archive: Central directory extends beyond file bounds." };
  }

  let offset = cdOffset;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > buffer.length) {
      return { valid: false, error: "Corrupted ZIP: truncated central directory header." };
    }

    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x02014b50) {
      return { valid: false, error: "Corrupted ZIP: invalid central directory signature." };
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fnLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const externalAttr = buffer.readUInt32LE(offset + 38);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fnOffset = offset + 46;
    if (fnOffset + fnLen > buffer.length) {
      return { valid: false, error: "Corrupted ZIP: truncated entry filename." };
    }

    const entryName = buffer.toString("utf8", fnOffset, fnOffset + fnLen);
    offset += 46 + fnLen + extraLen + commentLen;

    totalUncompressedSize += uncompressedSize;
    totalCompressedSize += compressedSize;

    // Check for symlinks in external attributes ((externalAttr >> 16) & 0120000 === 0120000)
    const isSymlink = ((externalAttr >> 16) & 0o170000) === 0o120000;
    if (isSymlink) {
      return { valid: false, error: `ZIP contains forbidden symbolic link entry: ${entryName}` };
    }

    // Path traversal checks
    if (
      entryName.includes("..") ||
      entryName.startsWith("/") ||
      entryName.startsWith("\\") ||
      /^[a-zA-Z]:/.test(entryName)
    ) {
      return { valid: false, error: `Path traversal detected in ZIP entry: ${entryName}` };
    }

    // Read entry content if needed for inspection
    entries.push({
      name: entryName,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
  }

  // Zip bomb checks
  if (totalUncompressedSize > 100 * 1024 * 1024) {
    return { valid: false, error: "ZIP uncompressed size exceeds maximum 100 MB limit." };
  }

  if (totalCompressedSize > 0 && totalUncompressedSize / Math.max(1, totalCompressedSize) > 50) {
    return { valid: false, error: "ZIP compression ratio exceeds safe threshold (potential zip bomb)." };
  }

  return { valid: true, entries, buffer };
}

function extractZipEntryContent(zipInfo, entryName) {
  const entry = zipInfo.entries.find((e) => e.name === entryName);
  if (!entry) return null;

  const buf = zipInfo.buffer;
  const lho = entry.localHeaderOffset;
  if (lho + 30 > buf.length) return null;

  const sig = buf.readUInt32LE(lho);
  if (sig !== 0x04034b50) return null;

  const fnLen = buf.readUInt16LE(lho + 26);
  const extraLen = buf.readUInt16LE(lho + 28);
  const dataOffset = lho + 30 + fnLen + extraLen;

  if (dataOffset + entry.compressedSize > buf.length) return null;
  const compressed = buf.slice(dataOffset, dataOffset + entry.compressedSize);

  try {
    if (entry.method === 0) {
      return compressed;
    }
    if (entry.method === 8) {
      return zlib.inflateRawSync(compressed);
    }
  } catch (_) {
    return null;
  }

  return null;
}

// OOXML Validator (DOCX, PPTX, XLSX)
function validateOoxmlStructure(buffer, declaredExt) {
  const parsed = parseZipEntries(buffer);
  if (!parsed.valid) {
    return parsed;
  }

  const entryNames = parsed.entries.map((e) => e.name);

  // Must have [Content_Types].xml and _rels/.rels
  if (!entryNames.includes("[Content_Types].xml") || !entryNames.some((n) => n.startsWith("_rels/"))) {
    return { valid: false, error: "Invalid Office Open XML document: missing package structure." };
  }

  // Reject macros (vbaProject.bin, macro-enabled content types)
  if (entryNames.some((n) => /vbaProject\.bin$/i.test(n) || /vbaData\.xml$/i.test(n))) {
    return { valid: false, error: "VBA macros are forbidden in uploaded Office documents." };
  }

  // Inspect [Content_Types].xml
  const contentTypesBuf = extractZipEntryContent(parsed, "[Content_Types].xml");
  if (contentTypesBuf) {
    const ctStr = contentTypesBuf.toString("utf8");
    if (/macroEnabled/i.test(ctStr) || /vnd\.ms-word\.macroEnabled/i.test(ctStr)) {
      return { valid: false, error: "Macro-enabled Office documents are forbidden." };
    }
  }

  // Reject embedded OLE or ActiveX objects
  if (entryNames.some((n) => /embeddings\/.*\.bin$/i.test(n) || /activeX/i.test(n))) {
    return { valid: false, error: "Embedded OLE and ActiveX controls are forbidden." };
  }

  // Inspect relationship files for external relationship targets
  const relsEntries = entryNames.filter((n) => n.endsWith(".rels"));
  for (const relName of relsEntries) {
    const relBuf = extractZipEntryContent(parsed, relName);
    if (relBuf) {
      const relStr = relBuf.toString("utf8");
      if (/TargetMode\s*=\s*["']External["']/i.test(relStr)) {
        if (/http:\/\/|https:\/\/|attachedTemplate/i.test(relStr)) {
          return { valid: false, error: "External relationship targets and remote templates are forbidden." };
        }
      }
    }
  }

  // Check specific format requirements
  let detectedType = null;
  let detectedMime = null;
  let detectedExt = null;

  if (entryNames.includes("word/document.xml")) {
    detectedType = "docx";
    detectedExt = ".docx";
    detectedMime = EXTENSION_TO_MIME[".docx"];

    // Check for DDE fields in document.xml
    const docXmlBuf = extractZipEntryContent(parsed, "word/document.xml");
    if (docXmlBuf) {
      const docXmlStr = docXmlBuf.toString("utf8");
      if (/DDE\b|DDEAUTO\b|cmd\.exe|powershell/i.test(docXmlStr)) {
        return { valid: false, error: "DDE commands are forbidden in Word documents." };
      }
    }
  } else if (entryNames.includes("ppt/presentation.xml")) {
    detectedType = "pptx";
    detectedExt = ".pptx";
    detectedMime = EXTENSION_TO_MIME[".pptx"];
  } else if (entryNames.includes("xl/workbook.xml")) {
    detectedType = "xlsx";
    detectedExt = ".xlsx";
    detectedMime = EXTENSION_TO_MIME[".xlsx"];
  } else {
    return { valid: false, error: "ZIP file is not a valid Word, PowerPoint, or Excel document." };
  }

  return {
    valid: true,
    detectedType,
    detectedExt,
    detectedMime,
  };
}

// 3. Generic ZIP Validator (for assignments / submissions)
const FORBIDDEN_ZIP_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".msi",
  ".dll",
  ".js",
  ".vbs",
  ".ps1",
  ".sh",
  ".jar",
]);

function validateGenericZip(buffer) {
  const parsed = parseZipEntries(buffer);
  if (!parsed.valid) {
    return parsed;
  }

  for (const entry of parsed.entries) {
    const ext = path.extname(entry.name).toLowerCase();
    if (FORBIDDEN_ZIP_EXTENSIONS.has(ext)) {
      return { valid: false, error: `Executable or script file type "${ext}" is forbidden in ZIP archives.` };
    }

    // Check nested archives
    if ([".zip", ".tar", ".gz", ".rar", ".7z"].includes(ext)) {
      return { valid: false, error: "Nested archives are forbidden inside uploaded ZIP files." };
    }
  }

  return {
    valid: true,
    detectedType: "zip",
    detectedExt: ".zip",
    detectedMime: "application/zip",
  };
}

// 4. OLE Compound Binary Files (DOC, PPT, XLS)
function validateOleStructure(buffer) {
  // Signature: 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
  if (buffer.length < 512) {
    return { valid: false, error: "Binary Office document is truncated." };
  }

  const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  for (let i = 0; i < oleHeader.length; i++) {
    if (buffer[i] !== oleHeader[i]) {
      return { valid: false, error: "Invalid OLE binary compound file signature." };
    }
  }

  // Inspect directory entries (128 bytes each) for VBA, macros, or object pools
  // In OLE files, entry names are stored in UTF-16LE
  const strContent = buffer.toString("latin1");
  const utf16Content = buffer.toString("utf16le");

  if (
    /_VBA_PROJECT|VBA|Macros|dir\x00/i.test(strContent) ||
    /_VBA_PROJECT|VBA|Macros/i.test(utf16Content)
  ) {
    return { valid: false, error: "VBA macros are forbidden in binary Office documents." };
  }

  if (
    /ObjectPool|\\x01Ole/i.test(strContent) ||
    /ObjectPool/i.test(utf16Content)
  ) {
    return { valid: false, error: "Embedded object pools are forbidden in binary Office documents." };
  }

  // Distinguish DOC, PPT, XLS
  let detectedExt = ".doc";
  let detectedType = "doc";
  let detectedMime = "application/msword";

  if (strContent.includes("PowerPoint Document") || utf16Content.includes("PowerPoint Document")) {
    detectedExt = ".ppt";
    detectedType = "ppt";
    detectedMime = "application/vnd.ms-powerpoint";
  } else if (strContent.includes("Workbook") || utf16Content.includes("Workbook")) {
    detectedExt = ".xls";
    detectedType = "xls";
    detectedMime = "application/vnd.ms-excel";
  }

  return {
    valid: true,
    detectedType,
    detectedExt,
    detectedMime,
  };
}

// 5. Image Validator (PNG, JPEG, GIF, WEBP)
function validateImageStructure(buffer) {
  if (buffer.length < 16) {
    return { valid: false, error: "Image file is too small or truncated." };
  }

  // Reject SVG explicitly
  const textSample = buffer.slice(0, 1024).toString("utf8", 0, Math.min(buffer.length, 1024)).toLowerCase();
  if (
    textSample.includes("<svg") ||
    textSample.includes("<html") ||
    textSample.includes("<script") ||
    textSample.includes("javascript:")
  ) {
    return { valid: false, error: "SVG and scriptable image formats are forbidden." };
  }

  // PNG: \x89PNG\r\n\x1a\n
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length < 24) {
      return { valid: false, error: "PNG file too small or truncated." };
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
      return { valid: false, error: "Corrupted PNG: invalid dimensions." };
    }
    // Verify IEND chunk exists
    const tail = buffer.slice(Math.max(0, buffer.length - 32));
    if (!tail.includes("IEND")) {
      return { valid: false, error: "Corrupted PNG: missing IEND chunk." };
    }
    return { valid: true, detectedType: "png", detectedExt: ".png", detectedMime: "image/png" };
  }

  // JPEG: \xFF\xD8\xFF ... \xFF\xD9
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const lastBytes = buffer.slice(Math.max(0, buffer.length - 16));
    if (!lastBytes.includes(Buffer.from([0xff, 0xd9]))) {
      return { valid: false, error: "Corrupted JPEG: missing EOI marker." };
    }
    return { valid: true, detectedType: "jpeg", detectedExt: ".jpg", detectedMime: "image/jpeg" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    if (width <= 0 || height <= 0) {
      return { valid: false, error: "Corrupted GIF: invalid dimensions." };
    }
    return { valid: true, detectedType: "gif", detectedExt: ".gif", detectedMime: "image/gif" };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.slice(0, 4).toString("latin1") === "RIFF" &&
    buffer.slice(8, 12).toString("latin1") === "WEBP"
  ) {
    return { valid: true, detectedType: "webp", detectedExt: ".webp", detectedMime: "image/webp" };
  }

  return { valid: false, error: "Unsupported or corrupted image format." };
}

// 6. Text Validator (TXT, CSV)
function validateTextStructure(buffer) {
  // Reject NUL bytes
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x00) {
      return { valid: false, error: "Text file contains binary NUL bytes." };
    }
  }

  // Validate UTF-8 decoding
  const str = buffer.toString("utf8");
  if (str.includes("\uFFFD")) {
    return { valid: false, error: "Invalid UTF-8 encoding in text file." };
  }

  // Reject scripts/HTML in text files
  const sample = str.slice(0, 2048).toLowerCase();
  if (
    sample.includes("<script") ||
    sample.includes("<html") ||
    sample.includes("javascript:")
  ) {
    return { valid: false, error: "HTML/script content is forbidden in text files." };
  }

  return { valid: true, detectedType: "text", detectedExt: ".txt", detectedMime: "text/plain" };
}

function validateUploadedFileContent(filePath, originalFilename, declaredMime, allowedExtensions = null, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: "Uploaded file does not exist on storage." };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, error: "Uploaded file is empty (0 bytes)." };
  }

  // Scan with antivirus first
  const avScan = scanFileWithAntivirus(filePath);
  if (avScan.available && !avScan.clean) {
    return { valid: false, error: `File blocked by security scan: ${avScan.reason}` };
  }

  const buffer = fs.readFileSync(filePath);
  const declaredExt = path.extname(originalFilename || "").toLowerCase();

  // Quick initial signature inspection
  let result = null;

  if (buffer.slice(0, 5).toString("latin1") === "%PDF-") {
    result = validatePdfStructure(buffer);
  } else if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // PK zip: can be docx, pptx, xlsx, or general zip
    if ([".docx", ".pptx", ".xlsx"].includes(declaredExt)) {
      result = validateOoxmlStructure(buffer, declaredExt);
    } else if (declaredExt === ".zip") {
      result = validateGenericZip(buffer);
    } else {
      // Try OOXML first, fallback to generic zip
      result = validateOoxmlStructure(buffer, declaredExt);
      if (!result.valid) {
        result = validateGenericZip(buffer);
      }
    }
  } else if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    result = validateOleStructure(buffer);
  } else if (
    (buffer[0] === 0x89 && buffer[1] === 0x50) ||
    (buffer[0] === 0xff && buffer[1] === 0xd8) ||
    buffer.slice(0, 3).toString("latin1") === "GIF" ||
    buffer.slice(0, 4).toString("latin1") === "RIFF"
  ) {
    result = validateImageStructure(buffer);
  } else if ([".txt", ".csv"].includes(declaredExt)) {
    result = validateTextStructure(buffer);
  } else {
    // Reject unknown formats or executables (MZ, ELF, scripts)
    const magic2 = buffer.slice(0, 2).toString("latin1");
    if (magic2 === "MZ") {
      return { valid: false, error: "Executable files (.exe/.dll) are strictly forbidden." };
    }
    const sample = buffer.slice(0, 1024).toString("utf8", 0, Math.min(buffer.length, 1024)).toLowerCase();
    if (sample.includes("<svg")) {
      return { valid: false, error: "SVG images with script capabilities are strictly forbidden." };
    }
    return { valid: false, error: "Unsupported or unrecognized file format." };
  }

  if (!result.valid) {
    return result;
  }

  // Agreement check: declared extension vs detected type
  const detectedExt = result.detectedExt || (result.detectedType === "pdf" ? ".pdf" : declaredExt);
  const detectedMime = result.detectedMime || EXTENSION_TO_MIME[detectedExt] || "application/octet-stream";

  // Check extension agreement
  const normalizedDeclared = declaredExt === ".jpeg" ? ".jpg" : declaredExt;
  const normalizedDetected = detectedExt === ".jpeg" ? ".jpg" : detectedExt;

  if (options.strictExtension && normalizedDeclared && normalizedDeclared !== normalizedDetected) {
    return {
      valid: false,
      error: `File extension mismatch: declared "${declaredExt}", but real file content is "${detectedExt}".`,
    };
  }

  // Check allowed extensions filter if provided against detected extension
  if (Array.isArray(allowedExtensions) && !allowedExtensions.includes(normalizedDetected)) {
    return {
      valid: false,
      error: `File type "${detectedExt}" is not allowed for this upload. Allowed: ${allowedExtensions.join(", ")}`,
    };
  }

  return {
    valid: true,
    detectedType: result.detectedType,
    detectedExt,
    detectedMime,
    extensionMismatch: normalizedDeclared !== normalizedDetected,
  };
}

module.exports = {
  validateUploadedFileContent,
  validatePdfStructure,
  validateOoxmlStructure,
  validateGenericZip,
  validateOleStructure,
  validateImageStructure,
  validateTextStructure,
  scanFileWithAntivirus,
  getAntivirusScanner,
  EXTENSION_TO_MIME,
  MIME_TO_EXT,
};

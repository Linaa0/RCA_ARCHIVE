const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const app = express();
const PORT = 5077;
const JWT_SECRET = "rca_secret_key_2024";

// ─── Setup DB ───────────────────────────────────────────────────────────────
const dbFile = path.join(__dirname, "db.json");
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], papers: [] });

async function initDB() {
  await db.read();
  db.data ||= { users: [], papers: [] };
  await db.write();
}

// ─── Setup Uploads Folder ────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ─── Multer Config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Hash file content ───────────────────────────────────────────────────────
function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildRatingSummary(paper) {
  const ratings = paper.ratings || [];
  const ratingCount = ratings.length;
  const averageRating = ratingCount
    ? Number((ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount).toFixed(1))
    : 0;

  return {
    ...paper,
    ratings,
    ratingCount,
    averageRating,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════════════════════

// SIGNUP
app.post("/api/signup", async (req, res) => {
  await db.read();
  const { username, password, role } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required" });

  const exists = db.data.users.find((u) => u.username === username);
  if (exists)
    return res.status(400).json({ error: "Username already taken" });

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    username,
    password: hashed,
    role: role || "student", // student or teacher
    createdAt: new Date().toISOString(),
  };

  db.data.users.push(user);
  await db.write();
  res.json({ message: "Account created successfully!" });
});

// LOGIN
app.post("/api/login", async (req, res) => {
  await db.read();
  const { username, password } = req.body;

  const user = db.data.users.find((u) => u.username === username);
  if (!user) return res.status(400).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, username: user.username, role: user.role });
});

// UPLOAD PAPER (requires login, content-based duplicate detection)
app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
  await db.read();

  if (!req.file)
    return res.status(400).json({ error: "No file uploaded" });

  const { title, subject, year, type } = req.body;
  if (!title || !subject || !year || !type) {
    fs.unlinkSync(req.file.path); // delete the temp file
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  // ── Duplicate detection by content hash ──
  const hash = hashFile(req.file.path);
  const duplicate = db.data.papers.find((p) => p.hash === hash);
  if (duplicate) {
    fs.unlinkSync(req.file.path); // delete the temp file
    return res.status(409).json({
      error: "duplicate",
      message: `This paper already exists! It was uploaded as "${duplicate.title}" by ${duplicate.uploadedBy}.`,
    });
  }

  const paper = {
    id: Date.now().toString(),
    title,
    subject,
    year,
    type,
    filename: req.file.filename,
    originalName: req.file.originalname,
    hash,
    uploadedBy: req.user.username,
    uploadedAt: new Date().toISOString(),
    ratings: [],
  };

  db.data.papers.push(paper);
  await db.write();
  res.json({ message: "Paper uploaded successfully!", paper: buildRatingSummary(paper) });
});

// GET PAPERS (filtered by subject + year)
app.get("/api/papers", async (req, res) => {
  await db.read();
  const { subject, year, type, search, sort } = req.query;

  let papers = db.data.papers;

  if (subject) papers = papers.filter((p) => p.subject === subject);
  if (year) papers = papers.filter((p) => p.year === year);
  if (type && type !== "All Types") papers = papers.filter((p) => p.type === type);
  if (search) papers = papers.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const papersWithRatings = papers.map(buildRatingSummary);

  if (sort === "top") {
    papersWithRatings.sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  } else {
    papersWithRatings.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  res.json(papersWithRatings);
});

// GET STATS
app.get("/api/stats", async (req, res) => {
  await db.read();
  res.json({
    totalPapers: db.data.papers.length,
    totalUsers: db.data.users.length,
  });
});

// RATE PAPER
app.post("/api/papers/:id/rate", requireAuth, async (req, res) => {
  await db.read();
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be a number between 1 and 5" });
  }

  const paper = db.data.papers.find((p) => p.id === id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  paper.ratings ||= [];
  const existing = paper.ratings.find((r) => r.username === req.user.username);
  if (existing) {
    existing.value = rating;
  } else {
    paper.ratings.push({ username: req.user.username, value: rating });
  }

  await db.write();
  res.json({ message: "Rating saved", paper: buildRatingSummary(paper) });
});

// DELETE PAPER (uploader or teacher can delete)
app.delete("/api/papers/:id", requireAuth, async (req, res) => {
  await db.read();
  const paper = db.data.papers.find((p) => p.id === req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  if (paper.uploadedBy !== req.user.username && req.user.role !== "teacher")
    return res.status(403).json({ error: "Not allowed to delete this paper" });

  // Delete the actual file
  const filePath = path.join(uploadDir, paper.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.data.papers = db.data.papers.filter((p) => p.id !== req.params.id);
  await db.write();
  res.json({ message: "Paper deleted successfully" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RCA Backend running on http://localhost:${PORT}`);
  });
});
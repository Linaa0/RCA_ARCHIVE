require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { TEACHER_EMAILS } = require("./teacherEmails");
const {
  connectToMongo,
  getUsersCollection,
  getPapersCollection,
  getOtpCollection,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 5077;
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_not_secure";
if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set. Using insecure fallback for development. Set `JWT_SECRET` in the environment for production.",
  );
}

async function initDB() {
  await connectToMongo();
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

async function sendVerificationEmail(email, otp) {
  const transporter = await createMailTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"RCA Archive" <no-reply@rcarchive.local>',
    to: email,
    subject: "RCA Archive Teacher Verification Code",
    text: `Your RCA teacher verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    html: `
      <p>Your RCA teacher verification code is: <strong>${otp}</strong></p>
      <p>This code expires in 10 minutes.</p>
    `,
  });

  if (!process.env.SMTP_HOST) {
    console.log(
      `📧 OTP email preview URL for ${email}: ${nodemailer.getTestMessageUrl(info)}`,
    );
  }
}

async function cleanExpiredOtps() {
  const otpCollection = getOtpCollection();
  const now = Date.now();
  await otpCollection.deleteMany({ expiresAt: { $lte: now } });
}

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

if (process.env.NODE_ENV !== "production") {
  app.use(cors());
}
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

if (process.env.NODE_ENV === "production") {
  const buildDir = path.join(__dirname, "../build");
  app.use(express.static(buildDir));

  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      res.sendFile(path.join(buildDir, "index.html"));
    }
  });
}

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

function requireTeacher(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);

    if (req.user.role !== "teacher") {
      return res.status(403).json({ error: "Teacher access required" });
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildRatingSummary(paper) {
  const ratings = paper.ratings || [];
  const ratingCount = ratings.length;
  const averageRating = ratingCount
    ? Number(
        (ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount).toFixed(1),
      )
    : 0;

  return {
    ...paper,
    ratings,
    ratingCount,
    averageRating,
  };
}

app.post("/api/send-teacher-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const otpCollection = getOtpCollection();

  const exists = await users.findOne({ email });
  if (exists) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const isTeacherEmail = TEACHER_EMAILS.some(
    (teacherEmail) => teacherEmail.toLowerCase() === email.toLowerCase(),
  );

  if (!isTeacherEmail) {
    return res
      .status(400)
      .json({ error: "This email is not a recognized teacher email" });
  }

  await cleanExpiredOtps();
  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await otpCollection.deleteMany({ email: email.toLowerCase() });
  await otpCollection.insertOne({
    email: email.toLowerCase(),
    code: otp,
    expiresAt,
  });

  try {
    await sendVerificationEmail(email, otp);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to send OTP email. Please try again later.",
    });
  }

  res.json({
    message:
      "OTP sent successfully. Enter the code to complete teacher signup.",
  });
});

app.post("/api/signup", async (req, res) => {
  const { email, password, otp, role, username } = req.body;

  if (!email || !password || !username) {
    return res
      .status(400)
      .json({ error: "Email, password, and username are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const users = getUsersCollection();
  const otpCollection = getOtpCollection();

  const exists = await users.findOne({ email });
  if (exists) {
    return res.status(400).json({ error: "Email already registered" });
  }

  let finalRole = "student";
  if (role === "teacher") {
    const isTeacherEmail = TEACHER_EMAILS.some(
      (teacherEmail) => teacherEmail.toLowerCase() === email.toLowerCase(),
    );

    if (!isTeacherEmail) {
      return res
        .status(400)
        .json({ error: "This email is not a recognized teacher email" });
    }

    await cleanExpiredOtps();
    const otpRecord = await otpCollection.findOne({
      email: email.toLowerCase(),
    });

    if (!otpRecord || !otp || otpRecord.code !== otp) {
      return res.status(400).json({
        error:
          "Invalid or expired OTP. Please request a new verification code.",
        requiresOtp: true,
      });
    }

    await otpCollection.deleteMany({ email: email.toLowerCase() });
    finalRole = "teacher";
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = {
    id: Date.now().toString(),
    email,
    username: username.trim() || email.split("@")[0],
    password: hashed,
    role: finalRole,
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(user);

  res.json({
    message: "Account created successfully!",
    role: finalRole,
    email,
    username: user.username,
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const users = getUsersCollection();
  const user = await users.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({
    token,
    email: user.email,
    username: user.username,
    role: user.role,
  });
});

app.post(
  "/api/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { title, subject, year, type } = req.body;
    if (!title || !subject || !year || !type) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Please fill in all fields" });
    }

    const papers = getPapersCollection();
    const hash = hashFile(req.file.path);
    const duplicate = await papers.findOne({ hash });
    if (duplicate) {
      fs.unlinkSync(req.file.path);
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

    await papers.insertOne(paper);
    res.json({
      message: "Paper uploaded successfully!",
      paper: buildRatingSummary(paper),
    });
  },
);

app.get("/api/papers", async (req, res) => {
  const { subject, year, type, search, sort } = req.query;
  const papers = getPapersCollection();

  const query = {};
  if (subject) query.subject = subject;
  if (year) query.year = year;
  if (type && type !== "All Types") query.type = type;
  if (search) query.title = { $regex: search, $options: "i" };

  const paperList = await papers.find(query).toArray();
  const papersWithRatings = paperList.map(buildRatingSummary);

  if (sort === "top") {
    papersWithRatings.sort((a, b) => {
      if (b.averageRating !== a.averageRating)
        return b.averageRating - a.averageRating;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  } else {
    papersWithRatings.sort(
      (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
    );
  }

  res.json(papersWithRatings);
});

app.get("/api/stats", async (req, res) => {
  const users = getUsersCollection();
  const papers = getPapersCollection();
  const totalPapers = await papers.countDocuments();
  const totalUsers = await users.countDocuments();
  res.json({
    totalPapers,
    totalUsers,
  });
});

app.post("/api/papers/:id/rate", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: "Rating must be a number between 1 and 5" });
  }

  const papers = getPapersCollection();
  const paper = await papers.findOne({ id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  const ratings = paper.ratings || [];
  const existing = ratings.find((r) => r.username === req.user.username);
  if (existing) {
    existing.value = rating;
  } else {
    ratings.push({ username: req.user.username, value: rating });
  }

  await papers.updateOne({ id }, { $set: { ratings } });
  res.json({
    message: "Rating saved",
    paper: buildRatingSummary({ ...paper, ratings }),
  });
});

app.delete("/api/papers/:id", requireAuth, async (req, res) => {
  const papers = getPapersCollection();
  const paper = await papers.findOne({ id: req.params.id });
  if (!paper) return res.status(404).json({ error: "Paper not found" });

  if (paper.uploadedBy !== req.user.username && req.user.role !== "teacher")
    return res.status(403).json({ error: "Not allowed to delete this paper" });

  const filePath = path.join(uploadDir, paper.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await papers.deleteOne({ id: req.params.id });
  res.json({ message: "Paper deleted successfully" });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RCA Backend running on http://localhost:${PORT}`);
  });
});

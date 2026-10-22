const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { CORS_ORIGINS, UPLOADS_DIR, SERVE_FRONTEND } = require("./config/env");
const { DEFAULT_CORS_ORIGINS } = require("./config/constants");
const { getPapersCollection } = require("./models");

const authRoutes = require("./routes/authRoutes");
const papersRoutes = require("./routes/papersRoutes");
const adminRoutes = require("./routes/adminRoutes");
const usersRoutes = require("./routes/usersRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = [
  ...new Set([...DEFAULT_CORS_ORIGINS, ...CORS_ORIGINS]),
];

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https:\/\/rca-archive.*\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-bootstrap-secret"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", async (_req, res) => {
  try {
    const papers = getPapersCollection();
    await papers.findOne({}, { projection: { _id: 1 } });
    res.json({ status: "ok", service: "rca-archive-backend" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

// Mount modular routes
app.use("/api", authRoutes);
app.use("/api", papersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", usersRoutes);
app.use("/", uploadRoutes);

// Optional static frontend serving if build directory exists
if (SERVE_FRONTEND) {
  const possibleBuildDirs = [
    path.resolve(__dirname, "../../client/dist"),
    path.resolve(__dirname, "../../../build"),
    path.resolve(__dirname, "../dist"),
  ];

  const buildDir = possibleBuildDirs.find((dir) =>
    fs.existsSync(path.join(dir, "index.html"))
  );

  if (buildDir) {
    const indexHtml = path.join(buildDir, "index.html");
    app.use(express.static(buildDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        return next();
      }
      res.sendFile(indexHtml);
    });
  }
}

app.use(errorHandler);

module.exports = app;

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
const assignmentRoutes = require("./routes/assignmentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const { globalLimiter } = require("./middleware/rateLimiter");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

const allowedOrigins = [
  ...new Set([...DEFAULT_CORS_ORIGINS, ...CORS_ORIGINS]),
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Allow localhost ports dynamically in development
    if (/^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin)) {
      callback(null, true);
      return;
    }

    // Allow Vercel preview deployments
    if (/^https:\/\/rca-archive(-[a-z0-9_-]+)?\.vercel\.app$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-admin-bootstrap-secret",
  ],
  exposedHeaders: ["Content-Disposition"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(mongoSanitize());
app.use(hpp());
app.use("/api", globalLimiter);
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", async (_req, res) => {
  const { checkDbHealth } = require("./models");
  const { MONGO_DB_NAME } = require("./config/env");

  const isDbOk = await checkDbHealth();
  if (isDbOk) {
    return res.json({
      status: "ok",
      service: "rca-archive-backend",
      database: "ok",
      databaseName: MONGO_DB_NAME,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  return res.status(503).json({
    status: "error",
    service: "rca-archive-backend",
    database: "down",
    databaseName: MONGO_DB_NAME,
    error: "Database connection failed",
  });
});

// Public single source of truth curriculum endpoint
app.get("/api/curriculum", (_req, res) => {
  const { getPromotions, getAllSubjects } = require("./config/curriculum");
  res.json({
    status: "ok",
    promotions: getPromotions(),
    allSubjects: getAllSubjects(),
  });
});

// Mount modular routes
app.use("/api", authRoutes);
app.use("/api", papersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", usersRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", notificationRoutes);
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

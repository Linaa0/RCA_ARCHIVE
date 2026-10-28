const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { CORS_ORIGINS, UPLOADS_DIR, SERVE_FRONTEND, NODE_ENV } = require("./config/env");
const { DEFAULT_CORS_ORIGINS } = require("./config/constants");
const { getPapersCollection } = require("./models");

let packageVersion = "1.0.0";
try {
  const pkg = require("../package.json");
  if (pkg.version) packageVersion = pkg.version;
} catch (_) {}

const serverStartTime = new Date().toISOString();
const commitSha = process.env.APP_COMMIT || process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined;

const authRoutes = require("./routes/authRoutes");
const papersRoutes = require("./routes/papersRoutes");
const adminRoutes = require("./routes/adminRoutes");
const usersRoutes = require("./routes/usersRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const subjectMaterialsRoutes = require("./routes/subjectMaterialsRoutes");
const publicApiRoutes = require("./routes/publicApiRoutes");
const { isPublicRoute } = require("./config/publicRoutes");
const { requireAuth } = require("./middleware/authMiddleware");
const { errorHandler } = require("./middleware/errorHandler");

const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const {
  globalLimiter,
  healthLimiter,
  publicLimiter,
  adminLimiter,
} = require("./middleware/rateLimiter");

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

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

const allowedOrigins = [
  ...new Set([...DEFAULT_CORS_ORIGINS, ...CORS_ORIGINS]),
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow Vercel preview deployments for this project (rca-archive*.vercel.app)
  if (/^https:\/\/rca-archive.*\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Allow localhost ports dynamically in development only
  if (NODE_ENV !== "production") {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return callback(null, false);
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

let cachedDbHealth = null;
let lastDbHealthCheck = 0;

async function getCachedDbHealth() {
  const now = Date.now();
  if (cachedDbHealth !== null && now - lastDbHealthCheck < 5000) {
    return cachedDbHealth;
  }
  const { checkDbHealth } = require("./models");
  const isOk = await checkDbHealth();
  cachedDbHealth = isOk;
  lastDbHealthCheck = now;
  return isOk;
}

// Health check endpoint with rate limiting
app.get("/api/health", healthLimiter, async (req, res) => {
  const isDbOk = await getCachedDbHealth();

  if (!isDbOk) {
    return res.status(503).json({ status: "unavailable" });
  }

  const isDirectLoopback =
    (req.ip === "127.0.0.1" ||
      req.ip === "::1" ||
      req.socket.remoteAddress === "127.0.0.1" ||
      req.socket.remoteAddress === "::1") &&
    !req.headers["x-forwarded-for"];

  let isAdmin = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const jwt = require("jsonwebtoken");
      const { JWT_SECRET } = require("./config/env");
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      if (decoded && decoded.role === "admin") {
        isAdmin = true;
      }
    } catch (_) {}
  }

  if (isDirectLoopback || isAdmin) {
    const { MONGO_DB_NAME } = require("./config/env");
    return res.json({
      status: "ok",
      server: "ok",
      database: "connected",
      databaseName: MONGO_DB_NAME,
      version: packageVersion,
      allowedCorsOriginsCount: allowedOrigins.length,
      uptimeSeconds: Math.floor(process.uptime()),
      startTime: serverStartTime,
      commit: process.env.APP_COMMIT || commitSha || null,
    });
  }

  return res.json({ status: "ok" });
});

app.use("/api", globalLimiter);
app.use("/api", publicLimiter, publicApiRoutes);

// Deny by default: authenticate every route under /api except those explicitly in publicRoutes.js
app.use("/api", (req, res, next) => {
  const fullPath = (req.baseUrl || "") + (req.path || "");
  if (isPublicRoute(req.method, fullPath) || isPublicRoute(req.method, req.path)) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Authenticated curriculum endpoint (full version)
app.get("/api/curriculum", requireAuth, (_req, res) => {
  const { getPromotions, getAllSubjects } = require("./config/curriculum");
  const { getTermsPayload } = require("./config/terms");
  res.json({
    status: "ok",
    promotions: getPromotions(),
    allSubjects: getAllSubjects(),
    terms: getTermsPayload(),
  });
});

// Mount modular routes
app.use("/api", authRoutes);
app.use("/api", papersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", usersRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", notificationRoutes);
app.use("/api", subjectMaterialsRoutes);
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

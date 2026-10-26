const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, CORS_ORIGINS, NODE_ENV } = require("../config/env");
const { DEFAULT_CORS_ORIGINS } = require("../config/constants");

const allowedOrigins = [
  ...new Set([...DEFAULT_CORS_ORIGINS, ...CORS_ORIGINS]),
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https:\/\/rca-archive.*\.vercel\.app$/.test(origin)) return true;
  if (NODE_ENV !== "production") {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin)) {
      return true;
    }
  }
  return false;
}

const { getNotificationsCollection } = require("../models");

let io = null;

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        console.warn(`[CORS] Rejected origin: ${origin}`);
        return callback(new Error("Origin not allowed by CORS"), false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // JWT handshake authentication
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Authentication token required for realtime connection"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error("Invalid or expired realtime session token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    if (!user) return;

    const userId = user.userId || user.id || user._id;

    // Join room per user ID
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Join room per email
    if (user.email) {
      socket.join(`email:${user.email}`);
    }

    // Join room per role (admin, teacher, student)
    if (user.role) {
      socket.join(`role:${user.role}`);
    }

    // Join room per cohort class
    const studentClass = user.class || user.studentClass;
    if (studentClass) {
      socket.join(`class:${studentClass}`);
    }

    // Global room for all signed-in users
    socket.join("authenticated");

    socket.on("disconnect", () => {});
  });

  return io;
}

function getIo() {
  return io;
}

/**
 * Emit paper events (create, update, delete) to all authenticated users.
 */
function emitPaperEvent(eventType, paperData) {
  if (!io) return;
  io.to("authenticated").emit(`paper:${eventType}`, paperData);
}

/**
 * Emit assignment events to students of targeted classes, plus teacher and admins.
 */
async function emitAssignmentEvent(eventType, assignmentData) {
  const classes = Array.isArray(assignmentData.classes)
    ? assignmentData.classes
    : [assignmentData.targetClass || assignmentData.class].filter(Boolean);

  if (io) {
    classes.forEach((cls) => {
      io.to(`class:${cls}`).emit(`assignment:${eventType}`, assignmentData);
    });

    if (Array.isArray(assignmentData.studentIds)) {
      assignmentData.studentIds.forEach((sid) => {
        io.to(`user:${sid}`).emit(`assignment:${eventType}`, assignmentData);
      });
    }

    const teacherId = assignmentData.teacherId || assignmentData.createdBy;
    if (teacherId) {
      io.to(`user:${teacherId}`).emit(`assignment:${eventType}`, assignmentData);
    }
    io.to("role:admin").emit(`assignment:${eventType}`, assignmentData);
  }

}

/**
 * Emit submission event to teacher and admins.
 */
function emitSubmissionEvent(eventType, submissionData, teacherId) {
  if (!io) return;
  if (teacherId) {
    io.to(`user:${teacherId}`).emit(`submission:${eventType}`, submissionData);
  }
  io.to("role:admin").emit(`submission:${eventType}`, submissionData);
}

/**
 * Emit appeal event to teacher, admins, and student.
 */
function emitAppealEvent(eventType, appealData, teacherId, studentId) {
  if (!io) return;
  if (teacherId) {
    io.to(`user:${teacherId}`).emit(`appeal:${eventType}`, appealData);
  }
  if (studentId) {
    io.to(`user:${studentId}`).emit(`appeal:${eventType}`, appealData);
  }
  io.to("role:admin").emit(`appeal:${eventType}`, appealData);
}

/**
 * Emit deletion request event to admins and paper uploader.
 */
function emitDeletionEvent(eventType, deletionData, uploaderId) {
  if (!io) return;
  if (uploaderId) {
    io.to(`user:${uploaderId}`).emit(`deletion:${eventType}`, deletionData);
  }
  io.to("role:admin").emit(`deletion:${eventType}`, deletionData);
}

/**
 * Emit user creation event to admins.
 */
function emitUserEvent(eventType, userData) {
  if (!io) return;
  io.to("role:admin").emit(`user:${eventType}`, userData);
}

/**
 * Emit stats event to admins.
 */
function emitStatsEvent(eventType = "changed", statsData = null) {
  if (!io) return;
  io.to("role:admin").emit(`stats:${eventType}`, statsData);
}

/**
 * Create and persist a notification, then emit live event to the recipient.
 */
async function notifyUser(userId, { title, message, type = "info", link = null }) {
  try {
    const notifications = getNotificationsCollection();
    const doc = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      userId: String(userId),
      title,
      message,
      type,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await notifications.insertOne(doc);

    if (io) {
      io.to(`user:${userId}`).emit("notification:new", doc);
    }
    return doc;
  } catch (err) {
    console.error("Failed to persist notification:", err.message);
    return null;
  }
}

async function notifyUserOnce(userId, { id, title, message, type = "info", link = null }) {
  const doc = {
    id: String(id),
    userId: String(userId),
    title,
    message,
    type,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };

  const result = await getNotificationsCollection().updateOne(
    { id: doc.id },
    { $setOnInsert: doc },
    { upsert: true }
  );
  if (result.upsertedCount === 0) return false;

  if (io) {
    io.to(`user:${userId}`).emit("notification:new", doc);
  }
  return true;
}

module.exports = {
  initSocketServer,
  getIo,
  emitPaperEvent,
  emitAssignmentEvent,
  emitSubmissionEvent,
  emitAppealEvent,
  emitDeletionEvent,
  emitUserEvent,
  emitStatsEvent,
  notifyUser,
  notifyUserOnce,
};

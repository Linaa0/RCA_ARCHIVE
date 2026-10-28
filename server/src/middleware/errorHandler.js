"use strict";

function errorHandler(err, req, res, _next) {
  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled Error:", err?.message || err);
  }

  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.statusCode === "number"
      ? err.statusCode
      : 500;

  let message;
  if (err.userMessage) {
    message = err.userMessage;
  } else if (status < 500) {
    message = err.message || "Bad request";
  } else {
    message = "An unexpected error occurred. Please try again later.";
  }

  // Uniform JSON error shape without stack traces or internal details
  return res.status(status).json({
    error: message,
  });
}

module.exports = {
  errorHandler,
};

function errorHandler(err, req, res, _next) {
  console.error("Unhandled Error:", err);

  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.statusCode === "number"
      ? err.statusCode
      : 500;
  const isProd = process.env.NODE_ENV === "production";

  // Prevent leaking internal system details or database exceptions to clients
  let message;
  if (err.userMessage) {
    message = err.userMessage;
  } else if (status < 500) {
    message = err.message || "Bad request";
  } else if (isProd) {
    message = "An unexpected error occurred. Please try again later.";
  } else {
    message = err.message || "Internal server error";
  }

  res.status(status).json({
    error: message,
    ...(!isProd && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = {
  errorHandler,
};

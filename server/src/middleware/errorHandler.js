function errorHandler(err, req, res, _next) {
  console.error("Unhandled Error:", err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}

module.exports = {
  errorHandler,
};

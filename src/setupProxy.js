const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Only proxy /api and /uploads to the backend.
  // All other routes (like /reset-password/:token) stay in React Router.
  app.use(
    ["/api", "/uploads"],
    createProxyMiddleware({
      target: "http://localhost:5077",
      changeOrigin: true,
    }),
  );
};

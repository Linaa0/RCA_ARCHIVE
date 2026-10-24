const app = require("./app");
const {
  PORT,
  MONGO_DB_NAME,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} = require("./config/env");
const { connectToMongo } = require("./models");
const {
  isRealSmtpConfigured,
  createMailTransporter,
} = require("./services/emailService");

async function startServer() {
  try {
    await connectToMongo();
    console.log(`Connected to MongoDB successfully! Database: ${MONGO_DB_NAME}`);

    console.log("Server Configuration:");
    console.log(`   - PORT: ${PORT}`);
    console.log(`   - SMTP_HOST: ${SMTP_HOST || "(not set)"}`);
    console.log(`   - SMTP_PORT: ${SMTP_PORT}`);
    console.log(`   - SMTP_USER: ${SMTP_USER || "(not set)"}`);
    console.log(`   - SMTP_PASS: ${SMTP_PASS ? "(set)" : "(not set)"}`);
    console.log(`   - EMAIL_FROM: ${EMAIL_FROM}`);
    console.log(
      `   - Real SMTP configured: ${isRealSmtpConfigured() ? "Yes" : "No"}`
    );

    if (isRealSmtpConfigured()) {
      try {
        console.log("[INFO] Testing SMTP connection...");
        const { transporter } = await createMailTransporter();
        await transporter.verify();
        console.log("[OK] SMTP test passed. Server is ready to send emails.");
      } catch (smtpErr) {
        console.error("[ERROR] SMTP Test FAILED:", smtpErr.message);
      }
    }

    const http = require("http");
    const { initSocketServer } = require("./services/socketService");
    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(PORT, () => {
      console.log(`\n[OK] RCA Backend running on http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n[ERROR] Port ${PORT} is already in use.`);
        console.error(
          `   Stop the existing process first, then restart the backend.`
        );
        console.error(`   Tip: Run this to free the port on Windows:`);
        console.error(
          `   for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT}') do taskkill /F /PID %a\n`
        );
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error("[ERROR] Fatal startup error:", err);
    process.exit(1);
  }
}

startServer();

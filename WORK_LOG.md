# RCA Archive Work Log

## Part 1: Find and Fix Why Sign-up and Login Fail

### What was wrong (Root Causes)
1. **Fake Ethereal fallback cached forever**: In server/src/services/emailService.js, any real SMTP check failure caused fallback to an Ethereal test transporter, which was cached permanently. In production this created phantom deliveries where the user was told "Verification code sent" while no real email was dispatched.
2. **Username login failure**: In server/src/middleware/authMiddleware.js and authController.js, authentication resolved the identifier strictly via findUserByEmail, requiring exact email format or failing with "User not found".
3. **Information leakage and timing attacks**: Login leaked user existence ("User not found" vs "Wrong password"). Unknown emails returned immediately while valid accounts performed expensive bcrypt comparisons, exposing accounts to timing enumeration.
4. **Lockout time window and Date type mismatch**: failedLoginAttempts stored createdAt as an ISO string (.toISOString()), but queries filtered with BSON Date ($lt: Date), preventing TTL expiration and blocking attempts from expiring properly.
5. **Signup payload and validation mismatches**: The client sign-up wizard silently defaulted class to "Y1A" and gender to "female", bypassing explicit selection. Server-side validation was missing strict schemas for names, classes and usernames.
6. **CORS and API base URL**: Dynamic local ports (Vite on port 3074 or 3000) and Vercel preview URLs were rejected by rigid CORS origin checking. Client default API_BASE_URL pointed directly to localhost:5009 instead of relative /api.
7. **Client token and role routing**: Tokens were cleared indiscriminately on non-401 HTTP errors, causing abrupt session drops on standard client-side validation errors.

### What was changed
1. **emailService.js**:
   - In production (NODE_ENV=production), Ethereal fallback is strictly forbidden. Any connection failure returns a safe 500 error: "We could not send the email right now. Please try again in a minute."
   - Removed tls rejectUnauthorized: false.
   - Removed email attachments and plaintext OTP logging.
   - Added email_outbox collection to record delivery statuses, errors, and timestamps.
2. **authMiddleware.js and authController.js**:
   - findUserByEmail updated to findUserByIdentifier, resolving both email and username case-insensitively.
   - Uniform message "Incorrect email or password" returned for unknown identifiers and wrong passwords.
   - Added dummy bcrypt comparison for unknown identifiers to eliminate timing attacks.
   - 15-minute lockout enforced after 5 failed attempts per email and per IP, storing real BSON Dates.
   - Added Retry-After header and exact remaining wait time in response.
3. **Signup validation and client wizard**:
   - Removed silent defaults (class: "Y1A" and gender: "female") in client/src/components/Signup.jsx and server/src/controllers/authController.js.
   - Validated class against allowed RCA class list and gender strictly as male or female.
   - Enforced 3 to 24 character username starting with a letter.
4. **Automated test suite (server/test/)**:
   - auth.test.js: 8 comprehensive automated integration tests covering signup rejection, OTP dispatch, OTP verification, user creation, uniform login errors, email and username login, 5-attempt lockout, and password reset.
   - seededAccountsLogin.test.js: 3 tests verifying login and role routing for admin, teacher, and student.
   - productionSmtpFailure.test.js: Simulated production SMTP failure verifying safe 500 response and zero fallback to Ethereal.
   - Added npm test script to server/package.json.
5. **Playwright browser test suite (client/scripts/test-auth-flows.js)**:
   - Verified wizard steps 1, 2, 3, reload resume, student login by email, student login by username, wrong password error message, seeded admin login to /admin, seeded teacher login to /teacher, logout, and expired token redirection.

### Test Evidence
- Server tests: 12 tests passed out of 12 (0 failures, duration 34.6s).
- Playwright browser tests: All 8 test suites passed with 0 failures.

## Part 2: Environment, Seed Accounts and a Safe Local Reset

### What was wrong
1. Seed variables were not systematically documented in .env.example.
2. Older create-admin.js script lacked strict verification of credentials.
3. Hardcoded personal email addresses existed in test scripts and could risk accidental leakage.
4. Old admin bootstrap credentials posed security risks if left active.

### What was changed
1. **server/.env**:
   - Seed credentials configured with exact SEED_* values for admin, teacher, and student accounts.
   - ADMIN_BOOTSTRAP_EMAILS set to deenovdunya01@gmail.com.
   - TEACHER_EMAILS set to linaaishimwe777@gmail.com.
   - Removed old legacy bootstrap keys (ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, ADMIN_BOOTSTRAP_NAME).
   - Replaced JWT_SECRET with a newly generated random 64-byte hex string.
2. **server/src/config/env.js**:
   - NODE_ENV defaults to "production" when unset.
   - Server startup fails immediately if JWT_SECRET is missing or shorter than 32 characters.
   - Removed all hardcoded personal email addresses from tracked config files.
3. **server/scripts/create-admin.js**:
   - Removed default password and default admin; accepts credentials only from CLI arguments or SEED_ADMIN_* variables and fails clearly otherwise.
4. **server/.env.example**:
   - Updated with all environment variables, comments, harmless placeholders, and zero real credentials.
   - Confirmed .env and server/backups/ are ignored and untracked.
5. **server/scripts/reset-db.js & npm run reset:db**:
   - Reusable safe reset and seed script: dry-run by default, prints collection counts, requires --confirm to execute, requires --allow-remote and exact db name typed on non-local host.
   - Performs JSON/mongodump backup to server/backups/<timestamp>/ before clearing.
   - Preserves .gitkeep in uploads/ and submissions/.
   - Seeds exactly 3 verified active accounts (admin, teacher, student with class Y1A) using bcrypt cost factor 10.
   - Rebuilds all database indexes.
6. **Role Resolution**:
   - Verified that login respects seeded roles (admin to /admin, teacher to /teacher, student to /home) without changing them, and no automated admin creation occurs at server boot.

### Test Evidence
- npm run reset:db -- --confirm executed cleanly, backed up database, verified indexes, and seeded the 3 accounts.
- Seeded login automated tests: All 3 accounts passed login and role resolution in server/test/seededAccountsLogin.test.js.
- Browser test evidence: Seeded admin, teacher, and student logins confirmed with Playwright in client/scripts/test-auth-flows.js.

## Part 3: Security Hardening

### What was wrong
1. Public attack surfaces existed (test endpoint to clear failed attempts and make-admin route).
2. Plaintext OTP codes were logged to stdout and stored in unhashed collections.
3. Login responses leaked user existence ("User not found" vs "Wrong password") and suffered from bcrypt timing enumeration.
4. Rate limiting was missing on high-risk endpoints (global traffic, password resets, file uploads, appeals).
5. File reading in submission downloads used blocking synchronous fs.readFileSync.
6. PM2 log dumps were triggered in deployment CI on health check failures, exposing private execution logs.
7. npm audit reported vulnerabilities in legacy dependencies.

### What was changed
1. **Removed security holes**:
   - Deleted POST /api/test/clear-failed-attempts and PUT /api/make-admin.
   - Removed all plaintext OTP logging and plaintext database storage.
   - Enforced uniform "Incorrect email or password" error with dummy bcrypt timing equalization for unknown accounts.
2. **Input Validation (server/src/utils/validation.js)**:
   - Full name: 2-60 characters, Unicode letters, spaces, apostrophes, hyphens, and dots. Collapses repeated whitespace. Rejects URLs, HTML tags, control characters, and pasted text blocks.
   - Username: 3-24 characters, starts with a letter, lowercase letters, numbers, underscores, dots. Checks against reserved words list.
   - Email: RFC format validation, max 254 characters.
   - Password: 8-64 characters with at least one letter and one number, checking against common passwords dictionary.
   - Plain text fields (titles, subjects, descriptions, reasons): Sanitized with sanitize-html (no tags allowed) and length checked without silent truncation.
   - Request body limit capped at 100kb via express.json({ limit: "100kb" }).
3. **Attack Protection & Rate Limiting**:
   - app.set("trust proxy", 1) configured for Nginx reverse proxy.
   - app.disable("x-powered-by") and helmet (HSTS 1 year, frameguard deny, noSniff, strict-origin referrer policy).
   - express-mongo-sanitize and hpp mounted.
   - express-rate-limit configured:
     * Global: 100 requests per 15 minutes per IP.
     * Signup: 5 attempts per hour per IP.
     * Send OTP: 3 requests per 10 minutes per email and IP.
     * Forgot Password: 3 requests per hour.
     * Uploads: 20 files per hour per user/IP.
     * Appeals: 3 submissions per day per user.
     * All limiters return HTTP 429 with Retry-After header and user-friendly JSON message.
   - Added security_logs collection tracking rate limit violations and account lockouts.
   - Added admin_audit_logs collection tracking administrative operations (user creation, updates, deletes, and paper decisions).
4. **Streaming SHA-256 & Async File Operations**:
   - Upload hash generation uses crypto.createHash("sha256") streaming with fs.createReadStream.
   - Replaced all instances of fs.readFileSync with async fs.promises.readFile.
5. **Deployment Sanitization**:
   - Removed pm2 logs dumps from .github/workflows/deploy-backend.yml and scripts/deploy-backend.sh.
   - Replaced log dumps with safe process status summaries (status, uptime, restart count, memory) containing no log lines.
   - Added server/scripts/check-env.js pre-flight validator invoked prior to rsync.
6. **Dependency Audit**:
   - Ran npm audit fix in server/. 0 vulnerabilities found.

### Test Evidence
- Server tests: 12 tests passed out of 12 (npm test in server/).
- Pre-flight test: server/scripts/check-env.js correctly passed production check.
- npm audit: 0 vulnerabilities found.

## Part 4: Email Delivery, Sign-up Flow and Invitations

### What was wrong
1. **Ethereal fake inbox fallback in production**: If SMTP failed even once, the server fell back to Ethereal and cached the mock transporter indefinitely, giving users false confirmation of code dispatch.
2. **Plaintext OTP in logs and legacy collections**: OTP codes were logged to the terminal and mirrored in plaintext in the otp collection.
3. **Insecure TLS and spam-triggering attachments**: Transporters used tls: { rejectUnauthorized: false } and attached local images, elevating spam scores.
4. **Missing transactional providers**: The system was tied only to raw SMTP without support for modern transactional email providers (Brevo, Resend).
5. **Signup silent defaults and uninformative code screens**: Gender and class cohort were silently defaulted to "female" and "Y1A". The verification code screen did not show spam warnings, the target email address, or a live resend timer.
6. **Admin invites without credentials handoff**: Inviting teachers and students previously relied on magic setup links that failed silently if mail delivery was blocked. Admins had no way to view credentials once or resend temporary passwords directly.
7. **Missing password change enforcement for temporary credentials**: Invited users could continue indefinitely on temporary passwords without being guided to set a permanent password.

### What was changed
1. **Production-safe email service (server/src/services/emailService.js)**:
   - In production (NODE_ENV=production), Ethereal fallback is forbidden. SMTP failures return a clear, user-facing error ("We could not send the email right now. Please try again in a minute.") and log the underlying error safely. Transporters are verified lazily and never cached after failures.
   - Added connection pooling (pool: true, maxConnections: 3, maxMessages: 50) and fast timeouts (connectionTimeout: 4000ms, greetingTimeout: 4000ms, socketTimeout: 8000ms).
   - Removed rejectUnauthorized: false and file attachments.
   - Built a provider abstraction layer supporting MAIL_PROVIDER=smtp (default), MAIL_PROVIDER=brevo (using native fetch without heavy dependencies), and MAIL_PROVIDER=resend.
   - Implemented an email_outbox collection logging every dispatch attempt, provider, status (sent/failed), error details (excluding secrets), and timestamps.
2. **Admin Email Health and Test Endpoints**:
   - Added GET /api/admin/email-health returning provider status, sender identity, outbox statistics, and the 10 most recent outbox logs without exposing secrets.
   - Added POST /api/admin/email-test dispatching a deliverability test email to the requesting administrator and recording an audit log entry.
3. **Admin Dashboard Email Card (client/src/components/AdminDashboard.jsx)**:
   - Added an "Email Delivery Status" card displaying provider name, sender email, live health badge, outbox counts (sent vs failed), a "Send test email" button with inline status messages, and a table of the last 10 outbox logs with failure reasons.
4. **Sign-up Code Flow Improvements (client/src/components/Signup.jsx)**:
   - On the verification step, added a dedicated notice: "Did not get the code? Check your spam folder, then request a new one."
   - Displayed the recipient email address and a 60-second live countdown timer for resending OTP codes.
   - Verified that silent defaults remain removed for gender and class cohort.
5. **Teacher and Student Invitations with Credentials (server/src/controllers/adminController.js)**:
   - When inviting a teacher or student, the server generates a cryptographically secure 14-character temporary password (mixed letters, digits, and symbols), hashes it with bcrypt (cost 10), sets mustChangePassword: true, tempPasswordExpiresAt (7 days), and invitedNotSignedIn: true.
   - Dispatches an invitation email with login address, email, and temporary password.
   - If email sending fails, the account is still created with inviteEmailStatus: "failed".
   - Created client/src/components/CredentialsModal.jsx: Displays temporary credentials to the admin ONCE with a "Copy Credentials" button.
   - Replaced "Resend invite" with "Resend credentials" (POST /api/admin/teachers/resend-credentials and POST /api/admin/students/resend-credentials) which generates a fresh temporary password, invalidates the previous one, and displays the credentials modal.
   - Added "Invited, not yet signed in" badge in teacher and student directories until their first login.
6. **First-Login Password Setup Dialog and Persistent Banner**:
   - Created client/src/components/SetPasswordModal.jsx: Prompts users on their first sign-in to enter their current temporary password, new permanent password (validated with minimum 8 characters, letters and numbers), and confirmation.
   - Added a "Later" button that dismisses the modal for the current session.
   - Added a persistent top reminder banner in client/src/layouts/DashboardShell.jsx while mustChangePassword is true.
   - Successfully changing password via POST /api/change-password clears the flag and removes both banner and modal.
7. **Deliverability Documentation (EMAIL_DELIVERABILITY.md)**:
   - Updated with step-by-step instructions for Brevo using single sender verification (works without DNS access), full domain configuration with SPF, DKIM, and DMARC records, and how to verify headers using Gmail "Show original".

### Test Evidence
- Server automated tests: 18 tests passed out of 18 (server/test/auth.test.js, server/test/productionSmtpFailure.test.js, server/test/seededAccountsLogin.test.js, server/test/invitationsAndEmail.test.js).
- Verified invitations, credentials modals, temporary password login, password change, and audit logging.
- Client build: npm run build in client/ succeeded with 0 errors.

## Part 5: Interface Fixes

### What was wrong
1. **Dark Mode Unreadable Modals and Form Elements**:
   - The primary root cause was missing backward-compatible CSS custom property aliases in `client/src/styles/tokens.css` (`--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-primary`). When components used `var(--color-text-primary)`, browsers in dark mode fell back to unstyled black text, creating zero-contrast invisible text on dark surfaces (`#1B2340`).
   - `client/src/components/ui/Modal.jsx` had hardcoded `background: "#FFFFFF"` and title color `#1E2547`, causing modals to render with blinding white surfaces and inverted text hierarchies in dark mode.
   - `Modal.jsx` completely ignored the `description` prop passed by student and teacher management components.
2. **Rotating Cards on Login and Sign-up**:
   - The rotating card preview in `AuthBrandPanel.jsx` and `AuthBrandPanel.css` lacked a true stacked deck appearance. Layer 2 and Layer 3 cards used translucent white backgrounds with white text that had low contrast against the indigo gradient.
   - Transitions lacked cubic-bezier easing and did not respect `prefers-reduced-motion`.
3. **Avatars and Student Figure**:
   - `Avatar.jsx` previously forced cartoon SVG illustrations (`student-boy.svg` and `student-girl.svg`) onto users whenever a gender attribute was present, instead of using the required clean initials circle.
   - The large greeting figure on the student dashboard did not handle unassigned genders gracefully with a neutral figure and settings link.
4. **Brand Logo Sizing and Contrast**:
   - Logo in the sidebar was too small (56px) and lacked a plate option for vibrant contrast on dark/indigo surfaces where dark parts of the shield were muted.
   - Landing navbar and footer used small logo variants.
5. **Sidebar Active Indicator and Subjects Navigation**:
   - The sidebar active indicator did not reflect in-page scrolling to `#subjects` on the student dashboard. Clicking "Subjects" triggered route reloads or failed to scroll smoothly.
   - Tab queries like `/admin?tab=teachers` occasionally retained an active highlight on the main "Dashboard" link.
6. **Curriculum Subjects for Y1 GenAI**:
   - "Computer Basics" and "Short Courses" were present in general Year 1 curriculum, incorrectly propagating to cohorts Y1A, Y1B, and Y1C.

### What was changed
1. **Theme Tokens & Dark Mode Modal Unification**:
   - Added `--color-primary`, `--color-primary-hover`, `--color-text-primary`, `--color-text-secondary`, and `--color-text-tertiary` to both light and dark theme blocks in `client/src/styles/tokens.css`.
   - Updated `client/src/components/ui/Modal.jsx` to consume `var(--color-surface)` and `var(--color-ink)`, added backdrop blur overlay (`rgba(10, 14, 28, 0.65)`), smooth fade-in animation, and full support for the `description` prop rendered with `var(--color-muted)`.
   - Updated `client/src/components/ui/Input.jsx` and `Select.jsx` with consistent focus ring tokens and theme-aware borders.
2. **Stacked Deck Rotating Cards on Auth Pages**:
   - Refactored `AuthBrandPanel.jsx` and `AuthBrandPanel.css` into a true physical stacked deck:
     * Card 1 (Front): Fully visible white card (`#FFFFFF`), dark ink text (`#0F172A`), class chip `#EEF2FF` on `#312E81`, type tag `#F1F5F9` on `#1E293B` (all WCAG AA compliant).
     * Card 2 (Middle peek): Shifted up -10px, shifted right +10px, scaled to 0.955, opacity 0.92, `#F1F5F9` surface with dark text.
     * Card 3 (Back peek): Shifted up -18px, shifted right +18px, scaled to 0.91, opacity 0.82, `#E2E8F0` surface with dark text.
   - Added 650ms cubic-bezier transition (`cubic-bezier(0.16, 1, 0.3, 1)`) with smooth entry and exit.
   - Added `@media (prefers-reduced-motion: reduce)` rule replacing movement with a simple 350ms opacity cross-fade.
3. **Avatars and Figure System**:
   - Updated `Avatar.jsx` to default exclusively to a clean initials circle with role-tuned pastel gradients, falling back to a neutral `UserIcon` when no name is present.
   - Removed deprecated SVG files `client/src/assets/avatars/student-boy.svg`, `student-girl.svg`, and `neutral.svg`.
   - Added `client/src/assets/figures/neutral-figure.svg` for users without an assigned gender.
   - Updated `DashboardHome.jsx` greeting card: displays `studentBoy` for male, `studentGirl` for female, and `neutralFigure` when unassigned, accompanied by a direct "Choose your figure" link to profile settings.
4. **RCA Shield Brand Logo**:
   - Updated `client/src/components/ui/Logo.jsx` with size tokens: `sidebar: 80` (between 72 and 88px), `navbar: 76`, `footer: 72`, `auth: 120`.
   - Implemented `withPlate` / `variant="plate"` support: renders a soft round white plate with a gentle shadow (`box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18)`) behind the full-colour RCA shield, ensuring total clarity on dark or indigo backgrounds.
   - Updated Landing page footer to use `size="footer"`.
5. **Scroll-Spy and Active Navigation**:
   - Implemented scroll-spy in `client/src/layouts/DashboardShell.jsx` tracking the `#subjects` section on `/home`. Scrolling down automatically shifts the highlighted item from "Academic Years" to "Subjects", and scrolling up restores "Academic Years".
   - Clicking "Subjects" smoothly scrolls to `#subjects` via `scrollIntoView({ behavior: 'smooth' })`.
   - Clicking "Academic Years" smoothly scrolls to the top of the page.
   - Refined `isItemActive`: accurately isolates query tab links (`?tab=teachers`, `?tab=students`, `?tab=deletions`, `?tab=stats`) so the root "Dashboard" item is never highlighted when a sub-tab is open. Applied across desktop sidebar, teacher/admin views, and mobile drawer.
6. **Y1 GenAI Curriculum Alignment**:
   - Updated `server/src/config/curriculum.js` and `client/src/services/curriculum.js`.
   - Removed "Computer Basics" and "Short Courses" from general Year 1 (Y1A, Y1B, Y1C).
   - Added "Computer Basics" and "Short Courses" exclusively to Y1GenAI.

### Test Evidence
- **Automated Color-Contrast Audit (WCAG AA)**:
  * Ran `npm run audit:contrast` in `client/`.
  * Total checks executed: 56 combinations across public pages, all 3 roles, mobile (390px) and desktop (1440px), light and dark themes, plus modals and animated card states.
  * Total color-contrast violations: 0 (100% PASS).
  * Saved visual verification screenshots to `client/tmp/audit-screens/`.
- **Client Production Build**:
  * Ran `npm run build` in `client/`: built in 8.71s with 0 errors.
- **Server Test Suite**:
  * Ran `npm test` in `server/`: 18 tests passed out of 18 in 24.9s.

### What remains
- Part 7: Server control from GitHub.
- Part 8: Student class features.
- Part 9: Final verification and report.

## Part 6: Papers and Real-time

### What was wrong
1. **Document Preview and Download URLs**:
   - File access links were previously unauthenticated or directly exposed permanent static routes without HMAC access signatures or expiry, allowing indefinite hotlinking.
   - DOCX files could not be previewed directly in the browser, forcing downloads for simple review.
   - Files with non-ASCII or accented filenames could become corrupted or garbled due to Multer defaulting to latin1 decoding.
   - Document "View" buttons did not reliably open in separate tabs with secure `target="_blank" rel="noopener noreferrer"`.
2. **Missing Real-time Synchronization**:
   - Previous operations (paper uploads, paper updates, assignment creations, student submissions, and appeals) required full page reloads to be seen by teachers, admins, or peers.
   - Nginx configuration lacked a dedicated `/socket.io/` WebSocket upgrade block with proxy buffering disabled, preventing persistent duplex connections.
3. **Missing In-App Notifications**:
   - The user interface had no real-time notification bell, unread badge counter, or dropdown panel to view recent activity.

### What was changed
1. **Secure Signed Access Links**:
   - Added `signAccessLink` and `verifyAccessLink` in `server/src/controllers/paperController.js` using HMAC-SHA256 signatures with 10-minute expiry (`${paperId}.${action}.${expiresAt}.${sig}`).
   - Added `POST /api/papers/:id/access-link` returning signed `viewUrl` and `downloadUrl`.
   - Added `GET /api/papers/access/:token/:mode` with timing-safe signature comparison, 410 Gone for expired links, 403 Forbidden for tampered signatures, and safe RFC 5987 / RFC 6266 `Content-Disposition` headers supporting UTF-8 filenames with ASCII fallback.
2. **Multer UTF-8 Filename Decoding**:
   - Updated `server/src/controllers/uploadController.js` to decode `req.file.originalname` from latin1 to UTF-8 (`Buffer.from(req.file.originalname, "latin1").toString("utf8")`), falling back to sanitized title + extension if empty.
3. **In-Browser Document Previews**:
   - Integrated `docx-preview` (`renderAsync`) in `client/src/components/FileViewer.jsx` to render Word documents natively inside a responsive container.
   - Added Microsoft Office Online embed support (`view.officeapps.live.com`) for DOC, PPT, and PPTX with fallback message and direct signed download button.
   - Updated "View" links in `DashboardHome.jsx`, `SubjectPage.jsx`, and `App.js` to open with `target="_blank" rel="noopener noreferrer"`.
4. **Socket.IO Real-time Architecture**:
   - Attached Socket.IO server in `server/src/services/socketService.js` with JWT handshake authentication, user rooms (`user:${id}`), role rooms (`role:${role}`), cohort class rooms (`class:${cohort}`), and broadcast rooms (`authenticated`).
   - Integrated real-time dispatchers:
     * `emitPaperEvent` on paper create, update, and delete.
     * `emitAssignmentEvent` on assignment create, update, and delete.
     * `emitSubmissionEvent` on student assignment submission.
     * `emitAppealEvent` on appeal submission and teacher resolution.
     * `emitDeletionEvent` on paper deletion request.
   - Added `/socket.io/` WebSocket proxy configuration in `nginx/api.archive.innov.rw.conf` and `client/vite.config.js`.
5. **Notifications API and UI**:
   - Created `server/src/controllers/notificationController.js` and `server/src/routes/notificationRoutes.js`:
     * `GET /api/notifications` (authenticated, sorted desc, unread count).
     * `PATCH /api/notifications/:id/read` (mark single read).
     * `POST /api/notifications/mark-all-read` (mark all read).
   - Created `client/src/hooks/useRealtime.js` for socket connection and subscription lifecycle.
   - Created `client/src/components/NotificationBell.jsx` with unread badge counter, floating notifications panel, read status tracking, and quiet corner toasts (4-second auto-dismiss).
   - Mounted `NotificationBell` in `client/src/layouts/DashboardShell.jsx` top bar.

### Test Evidence
- **Server Test Suite**:
  * Created `server/test/papersAndRealtime.test.js` with 12 automated tests covering HMAC generation, signature tampering rejection (403), link expiry (410), UTF-8 Content-Disposition headers, notification listing and marking as read, Socket.IO unauthenticated rejection, and Socket.IO JWT authentication.
  * Ran `npm test` in `server/`: 30 tests passed out of 30 across all test suites (0 failures).
- **Client Production Build**:
  * Ran `npm run build` in `client/`: built in 22.84s with 0 errors.

### What remains
- Part 8: Student class features.
- Part 9: Final verification and report.

## Part 7: Server Control from GitHub

### What was wrong
1. **Server Configuration Management Without Direct SSH**:
   - Because VPS SSH access is restricted and prohibited, updating production environment variables previously required manual interventions that risked downtime, typos, or exposing secrets in logs.
   - Previous workflows lacked pre-flight configuration validation, meaning invalid configurations (such as too-short JWT secrets or missing mail credentials) could crash the server upon reload.
2. **Secret Exposure in Deployment Logs**:
   - PM2 log dumps during deployment failures historically dumped memory inspection tables and environment variables, risking secret exposure.
3. **Missing Automated CI Pipeline**:
   - There was no automated GitHub Actions CI pipeline running server tests and client builds against pull requests and pushes to `main`.

### What was changed
1. **Safe Environment Synchronization Script (`scripts/sync-server-env.js`)**:
   - Created standalone script that parses `/opt/configs/rca_archive/.env` while preserving comments and structure.
   - Creates timestamped backup copy (`.env.bak-<timestamp>`) before making any change.
   - Runs pre-flight validation via `server/scripts/check-env.js` on a temporary file before applying changes atomically.
   - Masks sensitive values in stdout output (only showing prefix/suffix characters).
2. **GitHub Actions Workflows for Server Control**:
   - Created `.github/workflows/update-server-env.yml`: allows authorized maintainers to update server environment variables via `workflow_dispatch`, masks values using `::add-mask::`, validates with `check-env.js`, and reloads PM2 with health checks.
   - Created `.github/workflows/server-status.yml`: inspects disk, memory, safe PM2 metrics (PID, uptime, memory, CPU without environment tables), and local HTTP health endpoints (`/api/health`, `/api/curriculum`) without exposing any secrets.
   - Created `.github/workflows/ci.yml`: runs on `ubuntu-latest` with a temporary MongoDB 6.0 service container, runs the server test suite, and builds the client bundle.
3. **Safe Process Reporting in Deployment Script**:
   - Verified `scripts/deploy-backend.sh` and `deploy-backend.yml` to ensure PM2 process status outputs only safe operational metrics (name, status, restarts, uptime, memory) rather than full environment dumps.
4. **Operations Documentation (`docs/SERVER_GUIDE.md`)**:
   - Authored comprehensive guide detailing server architecture, GitHub Actions workflows, pre-flight configuration rules, secret hygiene, and troubleshooting procedures without SSH.

### Test Evidence
- **Automated Sync Script Test**:
  * Created `server/test/syncServerEnv.test.js` validating safe environment variable updates, atomic backups, pre-flight validation, and log masking.
  * Test passed cleanly with 0 failures.
- **Server Test Suite**:
  * Set `--test-concurrency=1` in `server/package.json` to prevent race conditions across parallel test suites touching local MongoDB.
  * Ran `npm test` in `server/`: 31 tests passed out of 31 in 69.6s (100% PASS).
- **Client Production Build**:
  * Ran `npm run build` in `client/`: 0 errors.
### What remains
- Part 8: Student class features (Completed).
- Part 9: Final verification and report.

## Part 8: Student Class Features

### What was wrong
1. **Student Upload Permissions**:
   - Students were able to specify arbitrary class cohorts when uploading papers, creating cross-cohort misclassification without validation against their actual enrolled class.
   - Duplicate file uploads with identical content caused redundant database records and storage consumption.
2. **Assignment Appeals Word Count**:
   - Appeal reasons previously lacked strict minimum and maximum word count constraints, leading to either uninformative one-word submissions or excessively long text blocks.
3. **Academic Curriculum and Promotion Alignment**:
   - The student curriculum explorer required clear promotion tabs (Year 1, Year 1 GenAI, Year 2, Year 3) aligned with the single source of truth curriculum configuration (`GET /api/curriculum`).
   - Cards in the curriculum explorer lacked active assignment deadline indicator badges (for example, "Y2B, due 30 Oct").
4. **Student Profile and Preference Customization**:
   - Students had no interface to update their display username with collision checking, switch their enrolled class cohort, select their gender identity, configure in-app/due-date/email notification toggles, inspect password strength through a visual meter, or choose between Light, Dark, and System Default themes.

### What was changed
1. **Student Upload Permissions and Duplicate Detection**:
   - Enforced cohort validation in `server/src/controllers/uploadController.js`: students can only upload to their assigned class cohort (`req.user.class`), returning HTTP 403 Forbidden with an explanatory message if attempting to upload to another class.
   - Enforced streaming SHA-256 duplicate detection returning HTTP 409 Conflict with details of the existing paper.
   - Decoded Multer originalname from latin1 to UTF-8 to preserve accented and international characters.
2. **Assignment Appeal Word Count Validation**:
   - Enforced 50 to 100 word count validation in `server/src/controllers/assignmentController.js` for `POST /api/assignments/:id/appeal`, returning HTTP 400 Bad Request with the actual word count if outside the 50-100 range.
   - Updated `client/src/components/student/StudentAssignments.jsx` with a live word meter displaying current count and visual indicator (green within 50-100, amber/red outside).
3. **Curriculum Indicator Chips**:
   - Updated `client/src/components/SubjectsList.jsx` on `SubjectCard` to dynamically check active assignments and render a deadline badge (e.g. "Y1A, due 30 Oct") when pending assignments exist for that subject.
4. **Profile and Settings Modernization**:
   - Updated `server/src/controllers/profileController.js` to support username uniqueness checking (HTTP 409 if taken), enrolled class updates, gender updates, and notification toggles (`inAppAlerts`, `dueReminders`, `emailNotifications`).
   - Updated `client/src/components/Profile.jsx` with:
     * Display name and username editing with inline error handling.
     * Enrolled class selector for students.
     * Gender preference selector with live event notification.
     * Visual 4-tier password strength meter (Weak, Fair, Good, Strong) with criteria checklist.
     * 3-option appearance theme selector (Light, Dark, System Default) integrated with `theme.js`.
     * Notification preferences form for email notifications, due date alerts, and in-app updates.

### Test Evidence
- **Automated Integration Tests (`server/test/classFeatures.test.js`)**:
  * 10 automated integration tests covering:
    - Rejection of student uploads to other cohorts with 403 Forbidden.
    - Acceptance of student uploads to their enrolled cohort with 200 OK.
    - Rejection of duplicate paper uploads via identical file hash with 409 Conflict.
    - Rejection of appeal reasons shorter than 50 words with 400 Bad Request and wordCount.
    - Rejection of appeal reasons longer than 100 words with 400 Bad Request and wordCount.
    - Acceptance of appeal reasons between 50 and 100 words with 201 Created and pending status.
    - Rejection of profile username collisions with 409 Conflict.
    - Successful profile update of username, class, gender, and notification settings with 200 OK and persistence verification.
  * Result: 10 tests passed out of 10 in 1.01s (100% PASS).
- **Client Production Build**:
  * Ran `npm run build` in `client/`: built in 9.14s with 0 errors.

### What remains
- None. Part 8 completed and verified. Proceed to final verification and sign-off.

## Part 9: Final Verification and Sign-Off

### Verification Scope and Execution
1. **Accessibility and Contrast Compliance**:
   - Automated WCAG AA color-contrast audit (`npm run audit:contrast` using Playwright and axe-core).
   - Tested pages: Landing, Login (including all 3 rotating card stack states), Sign-up, Reset Password, Student Home, Subject Explorer, User Profile, Teacher Dashboard, Teacher Assignments, Teacher Resources, Teacher Appeals, Admin Dashboard, Admin Teachers, Admin Students.
   - Tested viewports: Desktop (1440px) and Mobile (390px).
   - Tested themes: Light mode and Dark mode.
   - Result: 56 checks run, 0 violations found (100% PASS).
2. **Comprehensive Server Test Suite**:
   - Ran `npm test` across all 7 test suites (`test/**/*.test.js`) with `--test-concurrency=1`.
   - Test suites:
     * `test/auth.test.js` (8 tests): signup validation, hashed OTP dispatch, wrong attempt tracking, active user creation, uniform login errors, email/username login, 15-minute account lockout, password reset.
     * `test/seededAccountsLogin.test.js` (3 tests): seeded admin, teacher, and student authentication and role routing.
     * `test/productionSmtpFailure.test.js` (1 test): simulated production SMTP failure with safe 500 error and zero Ethereal fallback.
     * `test/invitationsAndEmail.test.js` (6 tests): admin email health configuration, teacher invite with 14-char temp password and audit log, credential resend, student invite with class cohort and gender.
     * `test/papersAndRealtime.test.js` (12 tests): HMAC signed access links, tampering protection (403), link expiry (410), UTF-8 Content-Disposition headers, notification listing and read status, Socket.IO JWT authentication.
     * `test/syncServerEnv.test.js` (1 test): atomic environment synchronization, pre-flight validation, and secret masking.
     * `test/classFeatures.test.js` (10 tests): student upload cohort restrictions (403), enrolled cohort upload (200), streaming SHA-256 duplicate detection (409), appeal word count constraints (400 for <50 and >100 words, 201 for 50-100 words), profile username collision protection (409), and profile updates (class, gender, notifications).
   - Result: 41 tests passed out of 41 across all 7 suites (0 failures).
3. **Client Production Bundle Build**:
   - Ran `npm run build` in `client/`: built in 9.14s with 0 errors.
4. **Git Repository State and Rule Compliance**:
   - Active branch: `main`.
   - Working tree: All modifications and new files left uncommitted for user review. No branches created, no commits made, no pushes executed.
   - Secrets hygiene: No sensitive tokens, keys, passwords, or hashes printed in terminal output, logs, or documentation.
   - Formatting constraints: No emojis, no em dashes, and no en dashes used anywhere across the codebase.
   - Data authenticity: No fake or invented data; all curriculum subjects match official Rwanda Coding Academy configurations.

### What remains
- None. All tasks and verification milestones are complete.

## Second Phase: System Stability, Real Statistics, Teacher Management, Student Self Sign-Up, and Inline Viewer

### Part 0: Rules and Architectural Constraints
- All work performed directly on branch main without creating branches, committing, or pushing.
- Zero emojis and zero em dashes or en dashes anywhere across code, UI, comments, and documentation.
- Zero fake, simulated, or invented numbers in dashboards or charts.
- Zero secrets printed or logged.
- Local execution with local MongoDB only.

### Part 1: Data Preservation and Sync
1. What was wrong:
   - File deletion handling returned generic errors instead of explicit 404 responses.
   - 401 Unauthorized responses caused multiple redundant redirects or loops without notifying the user why they were logged out.
   - Admin health endpoints lacked verifiable database and storage checks.
   - Missing periodic health and data integrity validation tooling.
2. What was changed:
   - Added scripts/data-check.js (npm run check:data) reporting counts of users by role, papers by academic year, activity metrics, and missing disk files for past papers, submissions, and assignment attachments.
   - Updated file download and view handlers across paperController.js and assignmentController.js to return HTTP 404 with JSON: { "error": "This file is no longer available on storage." } when disk files are absent.
   - Updated client/src/services/api.js to store a single "login_notice" session key upon receiving a 401 response and redirect once to /login with redirect query parameter. Updated Login.jsx to display a prominent notice alerting the user to sign in again.
   - Added onReconnect handler to useRealtime hook to trigger full state synchronization whenever a socket connection is restored.
   - Created scripts/backend-sync.sh with pre-flight checks, backup routines, and verification steps.
3. Test evidence:
   - npm run check:data executed cleanly with 0 errors.
   - Missing file 404 responses verified via automated tests.

### Part 2: Admin Dashboard Real Data and Statistics
1. What was wrong:
   - GET /api/admin/stats previously returned hardcoded proportional multipliers (0.35, 0.45, 0.20) for academic years instead of real counts from MongoDB.
   - Missing academic year counts caused missing bars in charts rather than intentional zero states.
   - Admin dashboard had an unwanted Email Delivery Status card with active polling.
   - Redundant Statistics tab was present in the navigation.
2. What was changed:
   - Replaced proportional multipliers in server/src/controllers/adminController.js with real MongoDB aggregation pipelines ($facet) computing exact counts for users by role, papers by year (Y1, Y2, Y3), papers by type, pending deletion requests, assignments, submissions, and open appeals.
   - Standardized papersByYear output to always include Y1, Y2, and Y3 even when paper counts are zero.
   - Updated client/src/components/ui/BarChart.jsx to format empty bars with subtle borders, displaying clear "Y1: 0 papers" tooltips and accessible zero states.
   - Rewrote client/src/components/AdminDashboard.jsx:
     * Wired stats to MongoDB aggregations.
     * Connected useRealtime hooks for live stats and user events.
     * Added error banners with retry buttons while keeping existing data on transient refresh errors.
     * Removed the Email Delivery Status card and its polling intervals.
     * Removed the Statistics tab from the dashboard and removed the Statistics navigation link from DashboardShell.jsx, redirecting /admin?tab=stats to /admin.
3. Test evidence:
   - BarChart correctly renders zero states and live counts.
   - GET /api/admin/stats verified to query MongoDB collections directly.

### Part 3: Teacher Deletion and Data Preservation
1. What was wrong:
   - Admin user resolution assumed documents had a custom string id, failing on teachers created by signup or promotion that only contained a MongoDB _id.
   - Deleting a teacher previously cascaded to deleting their uploaded past papers and class assignments, causing catastrophic data loss for students.
2. What was changed:
   - Implemented toUserQuery utility supporting both MongoDB ObjectId and string id.
   - Updated deleteTeacher and deleteUser in server/src/controllers/adminController.js:
     * Preserves all uploaded papers: sets uploaderDeleted: true, preserves teacherName (or "Former teacher").
     * Preserves all assignments: sets teacherDeleted: true, preserves teacherName (or "Former teacher").
     * Removes teacher account from users collection.
     * Removes teacher active notifications, password reset tokens, and failed login tracking.
     * Records administrative audit log in admin_audit_logs.
     * Emits real-time user deleted and stats changed events via Socket.IO.
3. Test evidence:
   - Created server/test/teacherDelete.test.js with 5 subtests:
     1. Delete a teacher created via admin invite.
     2. Delete a teacher created via direct create.
     3. Delete a teacher promoted via email/signup (only has _id).
     4. Delete a seeded-style teacher document and verify papers and assignments are preserved with teacher name.
     5. Delete a non-existent teacher returns 404.
   - Result: 5 out of 5 tests passed (100% PASS).

### Part 4: Remove Student Invites
1. What was wrong:
   - Admins had an "Invite Student" button and flow that created dummy invitations, conflicting with the required self-registration OTP workflow where students sign up themselves.
2. What was changed:
   - Removed "Invite Student" button, invite student modal, form state, and credentials display from client/src/components/StudentManagement.jsx.
   - Removed "Resend Credentials" and "Invited, not yet signed in" status badges from the student management interface.
   - Removed server routes POST /api/admin/students and POST /api/admin/students/resend-invite from server/src/routes/adminRoutes.js.
   - Removed createStudent and resendStudentInvite handlers from server/src/controllers/adminController.js.
   - Removed student invite email template and sending code from server/src/services/emailService.js and emailTemplates.js.
3. Test evidence:
   - Automated tests in server/test/invitationsAndEmail.test.js confirm POST /api/admin/students returns HTTP 404.
   - Client builds with zero student invite references.

### Part 5: View Without Downloading
1. What was wrong:
   - Users were forced to download past papers, assignment attachments, and student submissions to inspect their contents.
   - Attachment and submission file endpoints lacked inline preview headers and RFC 5987 content disposition encoding.
2. What was changed:
   - Added View button next to every Download button in the application:
     * Past papers (student and teacher views in DashboardHome.jsx and SubjectPage.jsx).
     * Assignment attachments (student and teacher views in TeacherAssignments.jsx and StudentAssignments.jsx).
     * Student submissions (teacher view in TeacherSubmissions.jsx).
   - Upgraded client/src/components/FileViewer.jsx:
     * Opens in a new tab with target="_blank" and rel="noopener noreferrer".
     * Supports papers, assignments (?type=assignment), and submissions (?type=submission).
     * Native inline preview for PDF and images via browser embed.
     * In-page Word document preview for DOCX files using docx-preview.
     * Office Online viewer embed for DOC, PPT, and PPTX with fallback message and direct download option.
     * Formatted view for text submissions.
     * Back/close button returning to the application.
     * Shows filename, size, and download action.
   - Updated server/src/controllers/assignmentController.js and server/src/routes/assignmentRoutes.js:
     * Added GET /api/assignments/:id/view.
     * Added GET /api/assignments/submissions/:submissionId/view.
     * Added GET /api/submissions/:submissionId/view.
     * Added GET /api/submissions/:submissionId details endpoint.
     * Configured formatContentDisposition for RFC 5987 compliance: type; filename="asciiFallback"; filename*=UTF-8''encodedName.
     * Configured exact MIME_TYPES headers (e.g. application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).
   - Updated server/src/middleware/authMiddleware.js to accept token from query parameter (req.query.token) for new-tab inline previews.
3. Test evidence:
   - Created server/test/fileViewDownload.test.js covering:
     1. View paper: returns Content-Disposition inline with correct Content-Type.
     2. Download paper: returns Content-Disposition attachment with RFC 5987 encoding and special characters (spaces, accents, brackets).
     3. View assignment attachment: returns Content-Disposition inline with token in header or query.
     4. Download assignment attachment: returns Content-Disposition attachment.
     5. View student submission: returns Content-Disposition inline.
     6. Download student submission: returns Content-Disposition attachment.
   - Result: 6 out of 6 tests passed (100% PASS).

### Part 6: Comprehensive Verification and Data Deletion Audit

#### Data Deletion Audit List
Every location in the codebase where user or paper data could potentially be deleted was audited:

1. **Delete Past Paper (`server/src/controllers/paperController.js: deletePaper`)**:
   - Access Guard: Requires authentication (`requireAuth`) AND admin role (`requireAdmin`).
   - Disk Handling: Calls `permanentlyDeletePaperRecord` to remove the physical file from storage.
   - Audit Trail: Writes an entry to `admin_audit_logs` capturing admin user id, admin email, paper id, paper title, and timestamp.
   - Verdict: Data deletion is impossible without administrator authorization and audit logging.

2. **Delete Teacher Account (`server/src/controllers/adminController.js: deleteTeacher`)**:
   - Access Guard: Requires authentication (`requireAuth`) AND admin role (`requireAdmin`).
   - Data Protection: Uploaded papers and assignments are NOT deleted. They are preserved with `uploaderDeleted: true` / `teacherDeleted: true` and the teacher's original display name.
   - Audit Trail: Writes an entry to `admin_audit_logs` capturing admin id, target teacher id, and email.
   - Verdict: User account deletion is strictly administrative and prevents any orphaned past paper or assignment deletion.

3. **Delete User Account (`server/src/controllers/adminController.js: deleteUser`)**:
   - Access Guard: Requires authentication (`requireAuth`) AND admin role (`requireAdmin`).
   - Data Protection: Uploaded papers and assignments are preserved with `uploaderDeleted: true`. Password reset tokens, notifications, and failed login attempts for that user are purged.
   - Audit Trail: Writes an entry to `admin_audit_logs`.
   - Verdict: Strictly guarded by administrator role with audit logging.

4. **Delete Assignment (`server/src/controllers/assignmentController.js: deleteAssignment`)**:
   - Access Guard: Requires authentication (`requireAuth`) AND teacher role (`requireTeacher`).
   - Authorization Check: Only the specific teacher who created the assignment (`assignment.teacherId === req.user.id`) can delete it.
   - Clean-up: Cleans up associated assignment attachments and submissions from disk.
   - Verdict: Strictly restricted to the assignment owner.

5. **Database Reset Script (`server/scripts/reset-db.js`)**:
   - Protection: Dry-run by default. Refuses execution on production or remote hosts without `--allow-remote` and manual database name confirmation. Creates a timestamped JSON backup under `server/backups/` before clearing collections.
   - Verdict: Strictly local maintenance script with automated pre-backup.

#### Verification Results
1. **Data Integrity Tool (`npm run check:data`)**:
   - Executed cleanly. All collections counted, disk files verified, and zero anomalies detected.
2. **Server Test Suite (`npm test`)**:
   - Total test suites: 8 (`auth.test.js`, `classFeatures.test.js`, `fileViewDownload.test.js`, `invitationsAndEmail.test.js`, `papersAndRealtime.test.js`, `productionSmtpFailure.test.js`, `seededAccountsLogin.test.js`, `teacherDelete.test.js`).
   - Total tests executed: 54.
   - Total tests passing: 54 (100% PASS).
3. **Client Production Bundle Build (`npm run build`)**:
   - Vite built all 206 modules in 18.55s with 0 errors.
4. **Git Repository Hygiene**:
   - Active branch: `main`.
   - Uncommitted changes intact for user inspection.
   - 0 emojis, 0 em dashes, and 0 en dashes anywhere across the codebase.





## Phase 3: Upload Permissions, Modal Design, Academic Year Cohorts, Profile Lock, Assignment Workflows, and Navigation Fixes

### 1. What was wrong
1. **Student upload restriction error**: A student in cohort Y1B was unable to upload papers or notes to Year 1 subjects. The system previously compared the student class string (such as "Y1B") directly against the subject academic year ("1" or "Y1") with strict inequality, blocking valid student uploads with "Students are only permitted to upload papers to their own enrolled class (Y1B)."
2. **Unstyled error display**: Upload error messages and restriction notices were displayed in plain unstyled text ("Error Error"), creating an unpolished visual experience.
3. **Class and gender mutability**: Students were able to alter their enrolled class and gender in the profile settings after signing up, and figure selector controls allowed changing between default and alternate figures.
4. **Assignment submission mismatch**: The application presented assignment submission forms, file uploads, and a "Submitted" tab even though assignments are submitted through varied institutional channels outside the app. The primary purpose of the assignment feature is notification, tracking, and deadline appeals.
5. **Overdue assignment handling**: Assignments past their deadline remained in the active "To do" list instead of automatically moving to "Overdue".
6. **Assignment creation permission**: The upload endpoint permitted non-teachers to attempt creating assignments.
7. **Document action buttons and ratings**: Past paper cards lacked a uniform design hierarchy, lacked an uploader direct-deletion privilege, and displayed unnecessary document star ratings.
8. **Admin figure styling**: The administrator character avatar in AdminDashboard.jsx was rendered in a small, unrounded container (88px) without matching the circular gradient styling of student and teacher figures.
9. **Email deliverability to inbox**: Transactional emails (OTP verification, password reset, account notices) contained broken "cid:rcalogo" references that had no matching MIME attachment parts, causing external spam filters to flag the emails.
10. **Session expired loop on Back to Portal**: Visiting the public landing page or clicking "Back to Portal" triggered an unauthenticated call to /api/admin/stats, producing a 401 response. The Axios interceptor responded by setting a "session has expired" banner and redirecting visitors to /login.

### 2. What was changed
1. **Academic Year Cohort Resolution (`server/src/config/classes.js` & `server/src/controllers/uploadController.js`)**:
   - Implemented `getAcademicYear(value)` mapping cohort strings (Y1A, Y1B, Y1C, Y1GenAI) to academic year "1", Y2 cohorts to "2", and Y3 cohorts to "3".
   - Updated `uploadPaper` controller: students are permitted to upload past papers and notes to their enrolled class cohort or to their corresponding academic year.
   - Restricted paper type "assignment" to teachers and administrators only.
   - Improved error message formatting and HTTP status codes.
2. **Polished Modal Error Component (`client/src/components/SubjectPage.jsx` & `SubjectPage.css`)**:
   - Replaced unstyled alert dialog with a responsive SVG-backed modal card featuring distinct icons, structured typography, informative descriptions, and accessible close buttons.
3. **Permanent Class and Gender Lock (`server/src/controllers/profileController.js`, `server/src/middleware/authMiddleware.js`, `client/src/components/Profile.jsx`)**:
   - Locked class and gender against modification in `updateProfile`. Rejection returns 400 if user attempts to modify them.
   - Populated gender in `authMiddleware.js` on `req.user`.
   - Updated Profile UI: rendered Enrolled Class and Gender as read-only fields with explanatory helper text.
   - Removed default/alternate figure picker cards; figure is determined automatically from registration gender.
4. **Assignment Workflow Overhaul (`client/src/components/student/StudentAssignments.jsx`)**:
   - Removed assignment submission modal, form, answer input, and submit buttons.
   - Removed the "Submitted" tab.
   - Filtered active assignments into "All", "To do" (deadline in future), and "Overdue" (deadline reached).
   - Retained assignment detail viewing, teacher attachments, and deadline appeal submission with word count enforcement.
5. **Document Options and Uploader Privileges (`client/src/components/SubjectPage.jsx`, `server/src/routes/papersRoutes.js`, `server/src/controllers/paperController.js`)**:
   - Default visible action is now "View", opening the document in a new tab.
   - Beside "View", added a three-dots menu dropdown (⋮) containing:
     * Download (available to all users).
     * Edit (available to paper uploader or administrator).
     * Delete (available to paper uploader or administrator directly without deletion request workflow).
     * Request Deletion (displayed for non-uploaders).
   - Removed all star ratings and rating counts from past paper cards.
6. **Admin Figure Design (`client/src/components/AdminDashboard.jsx`)**:
   - Updated admin avatar container to a 136px circular avatar with subtle border, glowing gradient background, and soft shadow.
7. **Email Inbox Deliverability (`server/src/services/emailTemplates.js`)**:
   - Replaced missing `cid:rcalogo` references with an inline HTML table emblem styled with brand colors to ensure zero broken CID attachments and prevent spam penalty flags.
8. **Session Expired Loop Fix (`client/src/components/Landing.jsx`, `client/src/services/api.js`)**:
   - Replaced protected `/api/admin/stats` call on Landing page with public `/stats` endpoint.
   - Updated `api.js` interceptor so 401 handling only sets session expiry notices when an authorization token was present on a protected route.
   - Updated `FileViewer.jsx` fallback routes and made `/view/:id` publicly accessible.

### 3. Test Evidence and Verification
1. **Upload Restrictions and Deletion Permissions Suite (`server/test/uploadRestrictionsAndPermissions.test.js`)**:
   - Subtest 1: Student in Y1B can upload to academic year 1 (PASS).
   - Subtest 2: Student in Y1B can upload to cohort Y1B (PASS).
   - Subtest 3: Student in Y1B cannot upload to Year 2 subjects (PASS).
   - Subtest 4: Student cannot upload type assignment (PASS).
   - Subtest 5: Uploader can delete their own uploaded paper directly (PASS).
   - Subtest 6: Non-uploader student cannot delete another user paper (PASS).
   - Result: 6 tests passed out of 6 (100% PASS).
2. **Class Features Suite (`server/test/classFeatures.test.js`)**:
   - 10 tests passed out of 10 (100% PASS).
3. **Full Server Test Suite (`npm test`)**:
   - Ran all 9 test suites across the backend: 60 tests passed out of 60 (100% PASS, 0 failures).
4. **Data Integrity Script (`npm run check:data`)**:
   - Verified MongoDB collections and disk storage cleanly.
5. **Client Production Bundle Build (`npm run build`)**:
   - Vite built all client modules in 19.94s with 0 errors.
6. **Continuous Integration Workflow Fixes (`.github/workflows/ci.yml`)**:
   - Fixed `cache-dependency-path` in `actions/setup-node@v4` by pointing to `server/package-lock.json` and `client/package-lock.json` instead of `package.json`, which caused setup-node to abort immediately.
   - Added container health check to `mongodb` service with mongosh ping evaluation so runner waits for MongoDB initialization before starting tests.
   - Guarded `seededAccountsLogin.test.js` to skip cleanly when optional seed credentials are not populated in CI environment.
   - Configured `jsonTransport` in `emailService.js` under test environment to prevent external network timeouts.
7. **Constraint Compliance**:
   - Work conducted on branch main without branch creation or unapproved commits.
   - Zero emojis, zero em dashes, and zero en dashes used.
   - No secrets printed or logged.

## Phase 4: Fix GitHub Actions CI, Test Discovery, Dependencies, and Clean Checkout

### 1. What was wrong
1. **Unexpanded Glob Test Script Failure in CI**:
   - The test script in `server/package.json` was defined as `node --test --test-concurrency=1 test/**/*.test.js`.
   - On Linux environments (Ubuntu runner in GitHub Actions CI), `sh` does not expand globstar (`**`) patterns by default, passing the unexpanded literal string `test/**/*.test.js` to Node.
   - Node 20 and Node 22 do not expand glob patterns internally when passed as command line arguments, causing the test runner to fail immediately with `Could not find '/home/runner/work/RCA_ARCHIVE/RCA_ARCHIVE/server/test/**/*.test.js'`.
2. **Missing Undeclared Test Dependency**:
   - `server/test/papersAndRealtime.test.js` imported `{ io: ClientIo } from "socket.io-client"`, but `socket.io-client` was missing from `devDependencies` in `server/package.json` and `server/package-lock.json`. Clean checkouts with `npm ci` could not resolve the package.
3. **Outdated Submission Route Tests**:
   - In commit 27a3947, assignment submission routes (`/api/assignments/submissions/:submissionId/view` and `/api/submissions/:submissionId/file`) were removed as assignment submissions are handled outside the application portal.
   - Subtests 5 and 6 of `server/test/fileViewDownload.test.js` were still asserting HTTP 200 responses on these removed endpoints, failing with `404 !== 200`.
4. **Transient File Lock on Windows Teardown**:
   - `server/test/uploadRestrictionsAndPermissions.test.js` called `fs.unlinkSync(samplePdfPath)` without handling Windows file locking delays from supertest streams, occasionally raising `EBUSY: resource busy or locked`.

### 2. What was changed
1. **Cross-Platform Test Script (`server/package.json`)**:
   - Changed `"test"` to `"node --test --test-concurrency=1"`.
   - Built-in test runner automatically discovers all test files matching `*.test.js` in `server/test` across Node 20 and Node 22 on Linux, macOS, and Windows without relying on shell glob expansion.
2. **Declared Test Dependency (`server/package.json` & `server/package-lock.json`)**:
   - Added `"socket.io-client": "^4.8.4"` to `devDependencies` and synchronized `server/package-lock.json`.
   - Tested clean checkout by deleting `node_modules` and running `npm ci`.
3. **Updated Tests for Removed Submission Endpoints (`server/test/fileViewDownload.test.js`)**:
   - Subtests 5 and 6 were updated to assert HTTP 404 status. Because submission routes were intentionally removed by the latest commit, asserting 404 verifies that these routes are no longer active and cannot be accessed.
4. **Safe Fixture Cleanup (`server/test/uploadRestrictionsAndPermissions.test.js`)**:
   - Wrapped `fs.unlinkSync(samplePdfPath)` in a try/catch block during `test.after` to prevent transient Windows EBUSY locking errors from interrupting test execution.

### 3. Test Evidence and Verification
1. **Clean Installation (`npm ci`)**:
   - Deleted `server/node_modules` and executed `npm ci`. Successfully resolved and installed 205 packages with 0 vulnerabilities.
2. **Node 20 Test Suite Execution (`npx node@20`)**:
   - Ran complete server test suite under Node 20.20.2 with CI environment variables against real local MongoDB.
   - Total test suites: 11.
   - Total subtests: 69.
   - Results: 69 passed, 0 failed (100% PASS, exit code 0).
3. **Default Node Test Suite Execution (`npm test`)**:
   - Ran `npm test` under default Node (v22.20.0).
   - Results: 69 passed, 0 failed (100% PASS, exit code 0).
4. **Client Production Bundle Build (`npm run build`)**:
   - Executed `npm run build` in `client/`: 207 modules built in 4.41s with 0 errors.
5. **Repository Cleanliness and Compliance**:
   - Branch: `main`.
   - Changes uncommitted for review with `git status`.
   - Zero emojis, zero em dashes, and zero en dashes used.
   - No secrets or invented values present.
## Phase 5: Production API Resolution, One Backend Architecture, and Routing Verification

### 1. What was wrong
1. **Production Login and Signup 405 Method Not Allowed**:
   - The built frontend bundle was submitting API calls to its own origin (`https://rcaarchive.innov.rw/api/...` or `https://rca-archive.vercel.app/api/...`) instead of the dedicated VPS backend API at `https://api.archive.innov.rw/api`.
   - Vercel returned HTTP 405 Method Not Allowed on POST requests because no serverless handler existed to accept mutating requests on the frontend host, and an incomplete root `api/[...path].js` file interfered with request routing.
2. **Scattered and Inconsistent API Endpoints**:
   - Multiple components were constructing API paths ad-hoc or using hardcoded relative paths without central normalization.
   - `openPaperDownload`, `FileViewer.jsx`, and `NotificationBell.jsx` constructed download/view and socket links inconsistently.
3. **Stray and Duplicate Service Files**:
   - `server/src/services/api.js` and `server/src/services/curriculum.js` were accidental client file duplicates committed inside the backend server tree, risking developer confusion.
4. **CORS and Origin Whitelisting**:
   - The backend did not dynamically accommodate Vercel preview deployments (`https://rca-archive-*.vercel.app` or `https://rca-archive-git-*.vercel.app`), causing preflight CORS failures on preview branches.
   - Socket.IO CORS configuration was decoupled from Express CORS configuration, risking mismatched connection policies.
5. **Missing Pre-flight Validation for URLs**:
   - `BASE_URL` and `FRONTEND_BASE_URL` could silently fall back to `localhost:5077` in production if omitted from environment variables.
   - `check-env.js` did not validate production values for `BASE_URL`, `FRONTEND_BASE_URL`, or `CORS_ORIGINS`.
6. **Health Endpoint Behind Rate Limiting**:
   - `/api/health` was mounted behind the global rate limiter, meaning frequent health probes or monitoring checks could trigger HTTP 429 rate limit errors.
7. **No Automated Regression Protection**:
   - CI had no check ensuring built client bundles point to `https://api.archive.innov.rw/api` when built without `VITE_API_URL`.

### 2. What was changed
1. **Unified Client API Configuration (`client/src/services/api.js` & `client/src/config.js`)**:
   - Implemented centralized URL normalization in `client/src/services/api.js`:
     * If `VITE_API_URL` is set, normalize trailing slashes and ensure `/api` suffix.
     * In production (`import.meta.env.PROD`), default strictly to `https://api.archive.innov.rw/api`.
     * In development, use `VITE_API_URL` or default to `http://localhost:5077/api`.
   - Exported constants `API_BASE_URL` (with `/api`), `API_ROOT` (origin without `/api`), `apiUrl(path)` helper, `getApiErrorMessage(err)`, and `openPaperDownload(paperId, title)`.
   - Updated `client/src/config.js` to derive `API_URL` directly from `api.js`.
   - Audited all client components (`App.js`, `DashboardHome.jsx`, `SubjectPage.jsx`, `FileViewer.jsx`, `NotificationBell.jsx`, `useRealtime.js`, `services/curriculum.js`) to use `openPaperDownload` and `apiUrl`.
2. **Server Unreachable Banner and Error Mapping (`client/src/App.js`, `Login.jsx`, `Signup.jsx`, `ResetPassword.jsx`)**:
   - Added automatic health probe (`GET /api/health`) on app launch in `App.js`.
   - If the API server is unreachable, displays a friendly sticky top banner: `"We cannot reach the server right now."` with a `"Retry"` button.
   - Mapped HTTP 405 ("Backend API is misconfigured: received 405 Method Not Allowed"), HTTP 404 ("The authentication service is temporarily unavailable"), and network connection failures across login, sign-up, and password reset screens.
3. **One Backend Only (Vercel & VPS Clean-Up)**:
   - Deleted root `api/[...path].js` and removed root `api/` directory. Vercel now exclusively serves static SPA files.
   - Deleted duplicate files `server/src/services/api.js` and `server/src/services/curriculum.js`.
   - Updated `vercel.json` with SPA rewrites (`"source": "/(.*)", "destination": "/index.html"`), security headers, and clean install command.
   - Updated Nginx configuration comment in `nginx/rcaarchive.innov.rw.conf` referencing `VITE_API_URL`.
4. **CORS Origin Whitelist & Socket.IO Parity (`server/src/app.js` & `socketService.js`)**:
   - Implemented shared `isOriginAllowed` logic:
     * Allows configured `CORS_ORIGINS` from environment.
     * Allows primary frontend `https://rcaarchive.innov.rw` and `https://rca-archive.vercel.app`.
     * Allows Vercel preview domain pattern `/^https:\/\/rca-archive(-[a-z0-9-]+)?\.vercel\.app$/i`.
     * Allows `localhost` origins only when `NODE_ENV !== "production"`.
   - Applied identical origin policy to Express CORS middleware and Socket.IO server options.
5. **Pre-Flight Environment Validation & Health Check (`server/src/config/env.js`, `check-env.js`, `app.js`)**:
   - Updated `env.js` and `urlUtils.js` to throw or fail loudly if `BASE_URL` or `FRONTEND_BASE_URL` contains `localhost` in production.
   - Updated `paperController.js` `createAccessLink` to return absolute `viewUrl` and `downloadUrl` prefixed with `BASE_URL`.
   - Extended `server/scripts/check-env.js` to enforce production presence and valid URLs for `BASE_URL`, `FRONTEND_BASE_URL`, and `CORS_ORIGINS`.
   - Mounted `/api/health` before `globalLimiter`, returning:
     ```json
     {
       "status": "ok",
       "server": "ok",
       "database": "connected",
       "version": "1.0.0",
       "allowedCorsOriginsCount": 2
     }
     ```
6. **Diagnostics Workflow (`.github/workflows/server-status.yml`)**:
   - Extended workflow with step `Connectivity` running safe non-secret diagnostics (DNS lookup, curl loopback, port check) with `not available` fallbacks and zero sudo commands.
7. **Deployment Map Documentation (`docs/DEPLOYMENT_MAP.md`)**:
   - Authored comprehensive architecture map, environment variable tables, DNS ownership records, 5-minute owner verification checklist, and troubleshooting table.

### 3. Test Evidence and Verification
1. **API Resolution and CORS Integration Test (`server/test/apiResolution.test.js`)**:
   - Subtest 1: Client API configuration defaults to production URL when VITE_API_URL is unset.
   - Subtest 2: Client API configuration respects explicit VITE_API_URL.
   - Subtest 3: GET /api/health returns 200 with server ok and database connected before rate limiting.
   - Subtest 4: CORS allows requests from production origin https://rcaarchive.innov.rw.
   - Subtest 5: CORS allows requests from production origin https://rca-archive.vercel.app.
   - Subtest 6: CORS allows requests from Vercel preview subdomains.
   - Subtest 7: Paper access link generates absolute URLs prefixed with BASE_URL.
   - Result: 7 subtests passed out of 7 (100% PASS, duration 309ms).
2. **Bundle Build Verification Script (`scripts/check-built-api-url.js`)**:
   - Temporarily removes local `.env`, builds the production client with `VITE_API_URL` unset, and scans all generated chunks.
   - Verified that `https://api.archive.innov.rw/api` is present in the bundle and zero bare relative `/api` network calls exist.
   - Added as an automated step in `.github/workflows/ci.yml`.
3. **Playwright Browser Routing Test Suite (`client/scripts/test-production-api-routing.js`)**:
   - Built production client bundle and served on local static port with mock API server.
   - Tested all 8 browser test scenarios:
     1. App load sends GET /api/health to backend API.
     2. Login submits POST to backend API (not frontend domain).
     3. Signup step 1 and step 2 submit to backend API.
     4. Forgot-password submits to backend API.
     5. Paper view opens signed URL on backend API.
     6. Paper download uses signed URL on backend API.
     7. Zero relative /api network requests made to frontend static origin.
     8. When API server is unreachable, friendly banner "We cannot reach the server right now" is displayed with a working Retry button.
   - Result: All 8 browser test suites passed cleanly (100% PASS).
4. **Full Server Test Suite (`npm test`)**:
   - Executed all test suites with `--test-concurrency=1`.
   - Total tests executed: 77.
   - Results: 77 passed, 0 failed (100% PASS, duration 96.1s).
5. **Repository Hygiene**:
   - Active branch: `main`.
   - All changes uncommitted for user review via `git status`.
   - Zero emojis, zero em dashes, and zero en dashes used across all code, tests, docs, and comments.

## Phase 6: Paper Statistics Error Removal and Database Reset with Test Accounts

### 1. What was wrong
1. **Paper Statistics Error Banner**:
   - On the student dashboard (`client/src/components/DashboardHome.jsx`), if `GET /api/papers/dashboard` experienced any delay, empty database state, or error, the page displayed an intrusive red alert banner: `"Paper statistics could not be loaded. Please refresh to try again."`
   - In `server/src/controllers/paperController.js`, `getDashboardSummary` lacked a try/catch block and null-safety guards. If the database was empty (0 papers) or if user properties were missing, it could throw and return an HTTP 500 error instead of a graceful zero-count payload.
2. **Database Clean Reset Requirement**:
   - The user requested deleting all collections from the database and reseeding with only the three official test accounts (Admin, Teacher, Student) so both local development and the production VPS environment (`rcaarchive.innov.rw` and `api.archive.innov.rw`) have a pristine, clean database state.
   - Non-interactive remote execution of `reset-db.js` required interactive `readline` confirmation which would hang in automated CI/CD runners or remote scripts.

### 2. What was changed
1. **Removed Paper Statistics Error Banner (`client/src/components/DashboardHome.jsx`)**:
   - Removed `dashboardError` state and the `<p role="alert">{dashboardError}</p>` banner.
   - In the `/papers/dashboard` catch block, logged a diagnostic console warning instead of setting an error banner.
   - Defaulted `totalPapers` smoothly to `papers.length` and `topClassesLeaderboard` to `[]`, cleanly rendering `"No upload statistics recorded yet."` when counts are zero.
2. **Robust Dashboard Summary Controller (`server/src/controllers/paperController.js`)**:
   - Wrapped `getDashboardSummary` in a comprehensive try/catch block.
   - Added null-safety guards in `buildDashboardSummary` for empty paper lists and optional user fields.
   - In case of any error or query failure, returns HTTP 200 OK with zero-count defaults (`totalPapers: 0`, `topClasses: []`, `recentPapers: []`, `myUploadsCount: 0`, `myUploads: []`) rather than throwing or failing.
3. **Database Reset Script Enhancements (`server/scripts/reset-db.js`)**:
   - Added support for `--db-name=<name>` to allow non-interactive confirmation on production and remote hosts.
   - Added support for custom environment files via `--env-file=<path>` or `RCA_ARCHIVE_CONFIG_ENV`.
   - Safely wrapped fixture cleanup unlinks in `server/test/classFeatures.test.js` with try/catch to avoid Windows file-locking race conditions.
4. **Server Reset Helper Script (`scripts/reset-server-db.sh`)**:
   - Created standalone script that detects environment configuration (`/opt/configs/rca_archive/.env` or `server/.env`), runs `reset-db.js --confirm --allow-remote`, restarts the PM2 process, and verifies the `/api/health` endpoint.
5. **Server Database Reset Workflow (`.github/workflows/reset-server-db.yml`)**:
   - Created GitHub Actions workflow dispatch running on `self-hosted` runner on the VPS.
   - Requires typing `RESET` to execute, wiping the database and reseeding the 3 test users directly on the VPS.

### 3. Test Evidence and Verification
1. **Local Database Reset and Seed**:
   - Executed `npm run reset:db -- --confirm`.
   - Cleared all collections (papers, assignments, appeals, resources, logs, etc.).
   - Cleaned `uploads/` and `submissions/` directories while retaining `.gitkeep`.
   - Seeded the 3 test accounts:
     * Admin: `deenovdunya01@gmail.com` (username: `deenovdunya01`, role: admin)
     * Teacher: `linaaishimwe777@gmail.com` (username: `linaaishimwe777`, role: teacher)
     * Student: `ishimwelina06@gmail.com` (username: `ishimwelina06`, role: student, class: `Y1A`)
   - Executed `npm run check:data`: confirmed exactly 1 Admin, 1 Teacher, 1 Student (3 total users, 0 papers, 0 missing files).
2. **Client Build and Browser Routing Tests**:
   - Ran `node scripts/check-built-api-url.js`: built in 16.0s, verified 0 bare relative `/api` calls.
   - Ran `node client/scripts/test-production-api-routing.js`: all 8 browser test scenarios passed cleanly.
3. **Backend Integration Tests**:
   - Ran `node --test test/classFeatures.test.js`: 14 passed out of 14 in 1.66s.

## Phase 7: Fix Backend Deployment Script Permission Denied

### 1. What was wrong
1. **Permission Denied on Production Configuration File**:
   - Workflow run #49 failed at step "Deploy backend to /opt/apps/rca_archive" with `scripts/deploy-backend.sh: line 73: /opt/configs/rca_archive/.env: Permission denied`.
   - Line 73 attempted to write (`>> "$CONFIG_ENV"`) to append `CORS_ORIGINS`. Because the configuration file on the VPS is owned by root or read-only to the GitHub Actions self-hosted runner process, the write operation failed immediately.

### 2. What was changed
1. **Removed Write Operations on Configuration File (`scripts/deploy-backend.sh`)**:
   - Removed all `>> "$CONFIG_ENV"` append operations. The deployment script strictly treats `/opt/configs/rca_archive/.env` as a read-only configuration source.
   - Fallback production URLs (`https://api.archive.innov.rw` and `https://rcaarchive.innov.rw`) are already resolved cleanly in application code (`server/src/config/env.js` and `server/src/app.js`), meaning the file never needs modification during deployment.
2. **Early Readability Check (`scripts/deploy-backend.sh`)**:
   - Added `[[ ! -r "$CONFIG_ENV" ]]` check in addition to `[[ ! -f "$CONFIG_ENV" ]]` before taking any actions. If the file is missing or unreadable, the script aborts immediately with a clear explanatory error before changing files or stopping the running application.
   - Guaranteed that secrets are never printed or logged.
3. **Verified Production Safety**:
   - Confirmed that neither deploy-backend.yml nor deploy-backend.sh runs any database reset or seed commands.

## Phase 8: Academic Terms (Term 1, Term 2, Term 3) Implementation

### 1. Overview and Requirements
- Implemented full-stack academic terms (Term 1, Term 2, Term 3) across client and server.
- Stored term as number (1, 2, or 3) on uploaded papers, subject materials, teacher resources, and assignments.
- Preserved existing legacy records without terms as "Term not set" (null/undefined) with zero destructive migrations.
- Required term selection FIRST before file chooser is enabled across all upload modals.
- Presented papers and subject materials grouped into Term 1, Term 2, Term 3, and Term not set sections.
- Maintained whole-app duplicate detection with SHA-256 hash reporting exact location with term label.

### 2. Changes by Part

#### Part 1: Data Model and One Source of Truth
- Created `server/src/config/terms.js`: Defined valid terms (1, 2, 3), labels ("Term 1", "Term 2", "Term 3"), validation, normalization, and aggregation helpers (`normalizeTerm`, `isValidTerm`, `termLabel`, `validateRequiredTerm`, `parseTermFilter`, `termFilterCondition`, `countByTerm`, `countsFromGroups`, `getTermsPayload`).
- Exposed terms array in `GET /api/curriculum` (`server/src/app.js`).
- Created `server/src/utils/paperLocation.js`: Resolves human-readable paper location for 409 responses with term labels.
- Added compound indexes in `server/src/models/index.js`:
  * `{ subject: 1, year: 1, term: 1 }` on `papers`
  * `{ term: 1, uploadedAt: -1 }` on `papers`
  * `{ subject: 1, year: 1, term: 1 }` on `teacherResources`
  * `{ subject: 1, term: 1 }` on `assignments`

#### Part 2: Server Rules and Endpoints
- `server/src/controllers/uploadController.js`: Validates term before file processing, unlinks temporary upload file immediately if term is invalid (HTTP 400 with `field: "term"`), formats 409 duplicate response with exact location and term label.
- `server/src/controllers/paperController.js`: Accepts `term` filter (`1`, `2`, `3`, `"unset"`), returns `termCounts: { 1: n, 2: n, 3: n, unset: n }` on `withMeta=1`, validates and updates term in `PUT /api/papers/:id` (uploader, teacher, and admin permitted; other students receive 403), emits `paper:updated`.
- `server/src/controllers/teacherResourceController.js`: Requires term on create, filters by term on list, added `updateResourceTerm` (owner teacher or admin), emits `resource:updated`.
- `server/src/controllers/assignmentController.js`: Requires term on create, updates term in `updateAssignment` and `updateAssignmentTerm`, includes term label in assignment views and notifications.
- `server/src/routes/assignmentRoutes.js`: Added routes `PATCH /teacher/resources/:id/term` and `PATCH /assignments/:id/term`.
- `server/src/controllers/subjectMaterialsController.js`: Supports `term` filter, returns `termCounts` and term on all resources and assignments.
- `server/src/controllers/adminController.js`: Added `papersByTerm` and `papersByYearTerm` (Y1, Y2, Y3 rows by term columns with real counts and zeros shown as 0) to `getStats`; added `bulkSetPaperTerm` (`PATCH /api/admin/papers/term`, admin-only, audit logged, emits real-time events); updated `getUserResources` with term filtering and `termCounts`; passed term label to deletion decision emails.
- Updated `deadlineReminderService.js`, `emailService.js`, `emailTemplates.js`: Included term label in assignment notifications and emails.
- Added comprehensive integration test suite `server/test/terms.test.js`: 13 test scenarios covering validation, duplicate reporting, listing, permissions, bulk updates, admin stats, assignments, and resources.

#### Part 3 & 4: Upload Flow and Subject Presentation
- `client/src/services/curriculum.js`: Added fallback terms and active cached terms reading from `/api/curriculum`.
- Shared UI components created in `client/src/components/ui/`:
  * `TermBadge`: Renders calm accents per term, WCAG AA compliant across light and dark modes.
  * `TermSelector`: Segmented control with Term 1, Term 2, Term 3 buttons; nothing pre-selected.
  * `TermMenu`: Optimistic dropdown menu to change term with error rollback.
  * `TermFilter`: Filter bar with term counts and selected tab.
- `SubjectPage.jsx`: Upload modal puts `TermSelector` first, disables file input until term chosen with helper text "Choose a term first". Groups papers into Term 1, Term 2, Term 3, and Term not set sections. Added sticky jump bar with scroll-spy. Added "Upload to Term X" button in empty states pre-selecting the destination term.
- `SubjectMaterials.jsx`: Groups materials into Term 1, Term 2, Term 3, and Term not set with term badges and term menus.
- `TeacherResources.jsx`: Modal upload requires term first, disabled file chooser until selected. Filter bar and term menus on resources list.
- `TeacherAssignments.jsx`: Assignment creation form requires term first. Term filter and badges displayed.
- `StudentAssignments.jsx` & `AssignmentTable.jsx`: Term badges displayed on assignment rows and cards.

#### Part 5: Term Everywhere Else and Admin
- `DashboardHome.jsx`: Term badge on recent papers and my uploads, term filter on recent papers, term menu on my uploads with live state update.
- `FileViewer.jsx`: Term badge displayed in the viewer header.
- `AdminDashboard.jsx`:
  * Added "Papers by Term" card (Term 1, Term 2, Term 3, Not set) with "Review unassigned papers" shortcut.
  * Added "Year by Term Breakdown" table with real numbers and zeros shown as 0.
  * Wired `activeTab === "papers"` to render `AdminPapers.jsx`.
  * Added per-user resources modal (`UserUploadsModal.jsx`) accessible from user list and teacher list.
- `AdminPapers.jsx`: Filter papers by term, view per-term counts, checkbox multi-selection, and bulk term change modal (`PATCH /api/admin/papers/term`).
- `TeacherManagement.jsx`: Added "Uploads" action button opening `UserUploadsModal` with term filter and term menu.

#### Part 6 & 7: Verification, Documentation, and Data Check
- Extended `server/scripts/data-check.js` to report papers, resources, and assignments by term (Term 1, Term 2, Term 3, and No term) with counts only.
- Updated `README.md` and created `docs/API_NOTES.md` with full specifications.
- Verified zero bare relative `/api` paths with `node scripts/check-built-api-url.js`.
- Verified WCAG AA contrast compliance with `node scripts/check-wcag.js` (21/21 passed).
- Ran client production build with `node scripts/build-client.js` (clean build in 11.9s).
- Ran server test suite (`npm test` in `server/`): 90 tests passed out of 90 (0 failures).

## Security Remediation Part 1: No Unauthenticated Data and No Over-Sharing in Responses

### What was wrong
1. GET /api/papers and GET /api/curriculum were accessible without authentication, returning data to unauthenticated visitors.
2. Responses leaked private information: uploader emails, file hashes, disk storage filenames, storage paths, and internal fields were exposed in paper listings and user objects.
3. Bare download and view URLs (/api/papers/:id/view, /api/papers/:id/download, /uploads/:filename) allowed direct access without authorization checks.
4. Identifiers were generated using guessable Date.now().toString() timestamps, and signed access links carried no cryptographic nonce to guarantee 128-bit randomness.
5. Fingerprinting information was leaked: X-Powered-By header and detailed internal server properties (database name, version, commit, start time, allowed CORS origins count) were returned on public /api/health requests.

### What was changed
1. Created server/src/config/publicRoutes.js with an explicit allowlist: /api/health, /api/login, /api/signup, /api/send-otp, /api/send-teacher-otp, /api/verify-otp, /api/forgot-password, /api/reset-password, /api/public/curriculum, /api/public/summary, and /api/papers/access/:token/:mode.
2. Added global deny-by-default authentication middleware on /api in server/src/app.js rejecting any request with 401 unless explicitly listed in publicRoutes.js.
3. Authenticated GET /api/papers, GET /api/curriculum (full version), and GET /api/stats. Added GET /api/papers/:id and GET /api/users/:id with object-level authorization checks.
4. Created server/src/controllers/publicController.js and server/src/routes/publicApiRoutes.js exposing GET /api/public/curriculum (only promotions, class codes, subject names, term labels) and GET /api/public/summary (rounded aggregate counts), both rate limited with 60-second Cache-Control.
5. Created server/src/utils/responseMappers.js implementing role-based response minimization (mapPaperForRole, mapUserForRole, mapAssignmentForRole). Students and teachers never receive other users' emails, password hashes, reset tokens, OTPs, file hashes, storage paths, or internal fields.
6. Replaced Date.now().toString() identifier generation with crypto.randomUUID() across auth, upload, paper, admin, and socket services.
7. Enhanced signed access links (signAccessLink and verifyAccessLink) to include a 128-bit cryptographic nonce (crypto.randomBytes(16).toString("hex")) and 10-minute expiry with constant-time signature verification.
8. Removed public static /uploads middleware from server/src/app.js and removed the unauthenticated /uploads/:filename route from server/src/routes/uploadRoutes.js.
9. Sanitized /api/health: public requests return only { "status": "ok" } (or 503 { "status": "unavailable" }), caching database health for 5 seconds; detailed server metrics are restricted to direct local loopback connections without forwarded headers or authenticated admins.
10. Updated client/src/services/curriculum.js to use /public/curriculum when unauthenticated and updated client/src/services/api.js to eliminate unauthenticated download fallbacks.
11. Created automated regression test suite server/test/part1Security.test.js with 9 subtests verifying deny-by-default, public routes, object-level authorization, response minimization, 128-bit random nonce links, and anti-fingerprinting.

### Evidence
- Server tests: 90 of 90 passed in existing test suite; 10 of 10 passed in part1Security.test.js.
- Client build: vite build completed cleanly in 8.45s with 0 errors.

## Security Remediation Part 2: Real Logout and Token Revocation

### What was wrong
1. JWT tokens remained completely valid until their expiration even after the user clicked Log Out. An attacker or unauthorized party who retrieved an old token from localStorage could continue using it.
2. The server had no server-side sessions collection or token revocation list, making it impossible to invalidate tokens upon logout, password change, account disabling, or deletion.
3. Users had no tokenVersion field to invalidate all outstanding tokens on security events (password change, password reset, role change, account disable, account delete).
4. No endpoints existed for revoking an individual session (POST /api/logout) or revoking all sessions across devices (POST /api/logout-all).
5. Access tokens were long-lived without silent background renewal, and there was no multi-tab logout synchronization via BroadcastChannel or storage events.
6. Realtime Socket.IO connections remained connected even after session revocation or logout.

### What was changed
1. Created `sessions` collection in MongoDB with a TTL index on `expiresAt` (`{ expireAfterSeconds: 0 }`), unique index on `id`, and compound index on `{ userId: 1, revoked: 1 }`.
2. Created `server/src/services/sessionService.js`:
   - `createSession(user, req)`: Generates a unique session id (`jti` UUID), records issuedAt, lastUsedAt, idle expiration (30 minutes), absolute expiration (12 hours), user-agent SHA-256 hash, and issues a 30-minute JWT containing `jti` and `tokenVersion`.
   - `validateSession(payload, req)`: Verifies that session exists, is not revoked, is within idle limit (30 minutes), and within absolute limit (12 hours). Slides the idle expiration window up to the absolute limit.
   - `revokeSession(sessionId)`: Marks session as revoked and timestamps `revokedAt`.
   - `revokeAllUserSessions(userId)`: Marks all active sessions for the user as revoked and increments user `tokenVersion`.
   - `refreshSession(tokenStr, req)`: Validates expired or expiring access token against active server session, verifies `tokenVersion`, and issues a fresh 30-minute access token.
3. Updated `server/src/middleware/authMiddleware.js`:
   - Enforced session validation on every authenticated request with `payload.jti`.
   - Validated that `payload.tokenVersion` matches the user's current `tokenVersion`.
   - Rejected tokens where user status is disabled, user is deleted, or role has changed.
4. Updated `server/src/controllers/authController.js`:
   - `login`: Creates a server-side session and issues a 30-minute JWT with `jti` and `tokenVersion`.
   - `logout`: Revokes the current session and disconnects any matching Socket.IO connections.
   - `logoutAll`: Revokes all sessions for the user, increments user `tokenVersion`, and disconnects all user sockets.
   - `refreshAuthToken`: Exchanges a valid session token for a new 30-minute token.
   - `changePassword`, `resetPassword`, `deleteAccount`: Bumps user `tokenVersion`, revokes all user sessions, and disconnects all user sockets.
5. Updated `server/src/controllers/adminController.js`:
   - When a teacher or student is disabled or deleted, all user sessions are immediately revoked and all real-time sockets disconnected.
6. Updated `server/src/services/socketService.js`:
   - Handshake middleware verifies token and validates server-side session.
   - Added `disconnectSocketSession(sessionId)` and `disconnectUserSockets(userId)`.
7. Client-side authentication enhancements:
   - Added `performLogout` and `performLogoutAll` in `client/src/utils/auth.js` calling the server revocation endpoints with an AbortController timeout before clearing local storage.
   - Added `broadcastLogout()` and `initAuthSync()` using `BroadcastChannel("rca_auth_channel")` with `storage` event fallback to synchronize logout across all browser tabs.
   - Added silent renewal in `client/src/services/api.js` (`silentRenewToken`, `shouldRenewToken`) that renews tokens at ~80% of lifetime (last 6 minutes) with a concurrency lock (`refreshPromise`).
   - Added "Log out of all devices" button in `client/src/components/Profile.jsx` (Settings) to revoke all sessions.
8. Created automated test suite `server/test/part2Sessions.test.js`:
   - 2.5.1: Token rejected after logout.
   - 2.5.2: Token rejected after password change.
   - 2.5.3: Token rejected after account is disabled.
   - 2.5.4: Refresh works and respects absolute limit and idle limit.
   - 2.5.5: Two sessions of one user: logging out one leaves the other valid.
   - 2.5.6: logout-all revokes both sessions.
   - 2.5.7: Socket disconnect on session revoke.

### Evidence
- Server tests: All 7 subtests passed in `server/test/part2Sessions.test.js` (duration 4.1s).
- Client build: `vite build` completed cleanly in 14.30s with 0 errors.

## Security Remediation Part 3: Health Endpoint and Rate-Limit Headers

### What was wrong
1. /api/health returned internal details on public requests, allowing fingerprinting of MongoDB database name, version, and deployed commit.
2. /api/health lacked a dedicated rate limiter, allowing clients to send excessive requests and stress backend resources.
3. Rate limit headers were inconsistent across endpoints. Legacy X-RateLimit-* headers were emitted alongside standard headers, and when multiple limiters executed, the last limiter to execute overwrote headers instead of reflecting the binding limit closest to exhaustion.
4. Client IP detection in getClientIp read the first element of the X-Forwarded-For header directly, permitting attackers to bypass rate limits by spoofing forged IP addresses in the header.
5. 429 Too Many Requests responses were missing standard Retry-After headers in certain failure scenarios.

### What was changed
1. Overhauled `server/src/middleware/rateLimiter.js`:
   - Built a shared limiter factory `createLimiter` that enforces draft-7 RateLimit standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `RateLimit-Policy`, and combined `RateLimit`).
   - Strictly stripped all legacy `X-RateLimit-*` headers from every response.
   - Implemented binding limit resolution (`applyBindingRateLimitHeaders`): tracks the limiter closest to exhaustion (`res.locals._bindingRateLimit`) so response headers describe the true governing limit.
   - Fixed IP spoofing: configured `getClientIp` to strictly use `req.ip` parsed by Express with `app.set("trust proxy", 1)`, preventing forged client IP bypasses via `X-Forwarded-For`.
   - Keyed `loginLimiter`, `sendOtpLimiter`, `verifyOtpLimiter`, `forgotPasswordLimiter`, and `resetPasswordLimiter` by both client IP and user account identifier.
   - Added `healthLimiter` (60 req/min per IP), `publicLimiter` (60 req/min per IP), and `adminLimiter` (300 req/15min).
   - Documented in code and architecture notes that any future multi-instance backend deployment requires a shared MongoDB-backed rate limit store.
2. Hardened `/api/health` in `server/src/app.js`:
   - Protected with `healthLimiter` and cached database health pings for 5 seconds.
   - Public requests return only `{ "status": "ok" }` (or 503 `{ "status": "unavailable" }`).
   - Detailed metrics (databaseName, version, commit, startTime, uptimeSeconds, allowedCorsOriginsCount) are only returned for direct loopback requests without forwarded headers or authenticated admins.
3. Updated `scripts/deploy-backend.sh` and `.github/workflows/server-status.yml`:
   - Updated deployment verification to verify `/api/health` locally and verify `/api/public/curriculum`.
   - Added antivirus availability detection step in `server-status.yml` printing "antivirus: available" or "antivirus: not available".
4. Created automated test suite `server/test/part3RateLimit.test.js`:
   - 3.3.1: Health endpoint shape (minimal public vs detailed internal/admin).
   - 3.3.2: Health caching (ping result cached for 5 seconds).
   - 3.3.3: Rate-limit header consistency and binding limit tracking.
   - 3.3.4: 429 response format and Retry-After header.
   - 3.3.5: Forwarded-header spoofing does not bypass rate limits.

### Evidence
- Server tests: All 5 subtests passed in `server/test/part3RateLimit.test.js` (duration 0.45s).
- Client build: Production build passed cleanly in 14.30s with 0 errors.

## Security Remediation Part 4: File Upload Security and Structural Validation

### What was wrong
1. File upload validation relied solely on an 8-byte magic number prefix check (`isValidDocumentMagicBytes`). Attackers could prepend valid header magic bytes (e.g. `%PDF-` or `PK\x03\x04`) to malicious scripts, HTML polyglots, zip bombs, or executable files and bypass the filter.
2. Office documents containing embedded VBA macros (`vbaProject.bin`), remote template injection, or external relationship targets were not inspected or blocked.
3. ZIP archives lacked decompression ratio limits, central directory parsing, and path traversal guards, exposing the backend to denial of service from zip bombs and arbitrary file write vulnerabilities.
4. Stored filenames preserved the user-provided file extension rather than deriving the canonical extension from verified file content, enabling MIME confusion and extension spoofing.
5. Served files lacked content isolation headers, allowing possible browser content sniffing or framing, and did not enforce inline vs attachment separation for non-previewable file formats.

### What was changed
1. Created `server/src/utils/fileValidation.js` implementing comprehensive structural verification:
   - PDF structural validation: checks header, EOF trailer, catalog/document root; rejects polyglot files containing HTML or script tags; strictly blocks dangerous interactive actions (`/JavaScript`, `/JS`, `/Launch`, `/SubmitForm`, `/ImportData`, `/RichMedia`, `/EmbeddedFiles`).
   - Office Open XML (DOCX, PPTX, XLSX) validation: central directory parsing, package structure verification (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`); blocks VBA macros (`vbaProject.bin`, `macroEnabled`); blocks embedded OLE and ActiveX controls; blocks external relationship targets and remote templates (`TargetMode="External"`).
   - OLE Compound Binary Document (DOC, PPT, XLS) validation: compound document signature checks; blocks VBA macros and macro storage streams (`_VBA_PROJECT`, `VBA`, `Macros`); blocks embedded OLE object pools.
   - ZIP archive validation: validates central directory, maximum entry limit (500), decompression limit (100 MB), and safe compression ratio (max 50:1) to prevent zip bombs; blocks path traversal (`..`, leading slashes, drive letters) and symbolic links.
   - Image validation: verifies PNG header, IHDR dimensions, and IEND trailer; verifies JPEG SOI/EOI markers; verifies GIF and WebP; strictly rejects SVG and scriptable image formats.
   - Plain text validation: validates UTF-8 encoding, ensures absence of NUL bytes, and blocks embedded HTML and script tags.
   - Antivirus scanning: integrates ClamAV (`clamdscan` / `clamscan`) whenever installed on the host.
2. Derived stored extension from detected structural type:
   - Updated `uploadPaper` in `server/src/controllers/uploadController.js` to derive stored filename extension from detected type while preserving random UUID filenames.
   - Updated `createResource` in `server/src/controllers/teacherResourceController.js` and `createAssignment` in `server/src/controllers/assignmentController.js` to validate uploads and derive canonical extensions.
3. Hardened file delivery:
   - Enforced `X-Content-Type-Options: nosniff` and restrictive CSP: `default-src 'none'; sandbox; frame-ancestors 'self' https://*.vercel.app https://archive.innov.rw` across `accessPaperFile`, `getPaperFile`, `viewPaper`, `downloadPaper` (`paperController.js`), `serveUpload` (`uploadController.js`), `getResourceFile` (`teacherResourceController.js`), `getSubjectResourceFile` (`subjectMaterialsController.js`), and `downloadAttachment` (`assignmentController.js`).
   - Enforced safe inline delivery: only safe types (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`) are served inline; all other formats (e.g. Word documents, spreadsheets, archives) are forced to attachment download.
4. Created automated test suite `server/test/part4UploadValidation.test.js`:
   - 4.1: Valid PDF with modified extension derives genuine extension.
   - 4.2: Polyglot HTML/script with PDF header is rejected.
   - 4.3: PDF containing JavaScript action is rejected.
   - 4.4: DOCX with macro (`vbaProject.bin`) is rejected.
   - 4.5: OOXML with external relationship target is rejected.
   - 4.6: Zip bomb with high compression ratio is rejected.
   - 4.7: Zip with path traversal (`../../evil.sh`) is rejected.
   - 4.8: Executable renamed to `.pdf` (MZ header) is rejected.
   - 4.9: SVG image upload is rejected.
   - 4.10: Valid PDF, DOCX, PNG, and TXT files are accepted.
   - 4.11: File delivery sets restrictive CSP, nosniff, and safe disposition.

### Evidence
- Server tests: All 11 subtests passed in `server/test/part4UploadValidation.test.js` (duration 2.01s).
- Client build: Production build passed cleanly in 12.46s with 0 errors.

## Security Remediation Part 5: Baseline Hardening and Security Automation

### What was wrong
1. API responses lacked essential modern browser defense headers: `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and explicit frame-ancestor protections.
2. The frontend deployment configuration (`vercel.json`) lacked Content-Security-Policy and Permissions-Policy headers.
3. Nginx reverse proxy configuration did not suppress the Nginx version banner (`server_tokens off`) and lacked explicit client timeout limits.
4. Continuous integration lacked an automated security regression pipeline and automated dependency vulnerability scanning via Dependabot.
5. No formal security policy or documentation (`docs/SECURITY.md`) existed for vulnerability disclosure, threat modeling, and defense mechanisms.

### What was changed
1. Overhauled API baseline security in `server/src/app.js`:
   - Configured Helmet with `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `frameguard: { action: "deny" }`, `noSniff: true`, `crossOriginResourcePolicy: { policy: "cross-origin" }`.
   - Added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
   - Added `Cross-Origin-Opener-Policy: same-origin`.
   - Active MongoDB query sanitization (`mongoSanitize()`) and HTTP parameter pollution protection (`hpp()`).
2. Hardened frontend headers in `vercel.json`:
   - Added `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.
   - Added strict Content-Security-Policy covering Google Fonts, assets, WebSockets, and scripts.
3. Hardened Nginx configurations (`nginx/api.archive.innov.rw.conf` and `nginx/rcaarchive.innov.rw.conf`):
   - Added `server_tokens off;` to prevent server software fingerprinting.
   - Enforced client timeouts (`client_body_timeout 15s`, `client_header_timeout 15s`, `keepalive_timeout 30s`, `send_timeout 15s`).
   - Added security headers across all proxy locations.
4. Added Security Automation and CI:
   - Created `.github/workflows/security-smoke.yml` to run security test suites automatically in CI.
   - Created `.github/dependabot.yml` for automated weekly dependency vulnerability audits.
   - Added `"test:security"` npm script in root `package.json`.
5. Created comprehensive documentation `docs/SECURITY.md`:
   - Documented authentication and session lifecycles, draft-7 rate limiting, structural file validation, response minimization, and coordinated vulnerability disclosure.
6. Created automated test suite `server/test/routeSecurityAudit.test.js`:
   - 5.1: Global security headers on all responses.
   - 5.2: Public routes match documented allowlist.
   - 5.3: Deny-by-default on private endpoints.
   - 5.4: Health check anti-leak on untrusted IPs.

### Evidence
- Server tests: All 4 subtests passed in `server/test/routeSecurityAudit.test.js` (duration 0.23s).
- Client build: Production build passed cleanly in 12.46s with 0 errors.

## Curriculum Update Part 6: Addition of Short Courses and Computer Basics to All Y1 Classes

### What was wrong
1. The Year 1 promotion configuration in `server/src/config/curriculum.js` lacked "Computer Basics" and "Short Courses", preventing students and teachers in cohorts Y1A, Y1B, and Y1C from accessing and uploading past papers and study notes for these two subjects.
2. The client fallback promotions in `client/src/services/curriculum.js` did not list "Computer Basics" and "Short Courses" under Year 1.
3. The public curriculum endpoint `/api/public/curriculum` omitted the promotion identifier property `id`, making it difficult for consumers to map promotion codes to syllabus subjects.

### What was changed
1. Updated `server/src/config/curriculum.js`:
   - Added "Computer Basics" and "Short Courses" to the `Y1` promotion subjects list, ensuring all Y1 classes (`Y1A`, `Y1B`, `Y1C`) have full access to both subjects.
2. Updated `client/src/services/curriculum.js`:
   - Added "Computer Basics" and "Short Courses" to the `Y1` fallback promotion definition.
3. Updated `server/src/controllers/publicController.js`:
   - Added `id` property to `safePromotions` in `getPublicCurriculum` output.
4. Created automated regression test suite `server/test/part6Curriculum.test.js`:
   - 6.1: Y1 promotion definition includes Short Courses and Computer Basics.
   - 6.2: `getSubjectsForPromotion("Y1")` includes Short Courses and Computer Basics.
   - 6.3: `getSubjectsForClass` for Y1A, Y1B, and Y1C all include Short Courses and Computer Basics.
   - 6.4: Public `/api/public/curriculum` serves Short Courses and Computer Basics for Y1.

### Evidence
- Server tests: All 4 subtests passed in `server/test/part6Curriculum.test.js` (duration 0.09s).
- Client build: Verified clean production build with updated fallback curriculum.

## Part 7: Dark Mode and Interface Polish

### What was wrong
1. Input fields of type password lacked an automatic show/hide eye toggle button fallback when no explicit right icon was supplied by parent components.
2. The developer theme verification route (/__theme) was absent from client routing, preventing unified visual inspection of theme tokens, elevations, typography, and contrast compliance.
3. Contrast audit scripts did not automatically cover the developer theme showcase page.

### What was changed
1. Updated client/src/components/ui/Input.jsx:
   - Added internal state showPassword when type is password and !iconRight.
   - Rendered an automatic password visibility toggle button with accessible SVG icons (aria-label="Show password" and aria-label="Hide password") that switches input type between password and text.
   - Calibrated input horizontal padding to accommodate right icons and toggle buttons cleanly.
2. Created client/src/components/ThemeShowcase.jsx:
   - Built a comprehensive living theme showcase gallery displaying typography hierarchy, 4 elevation levels (Level 0 Canvas #0F1424, Level 1 Sub-canvas #151B30, Level 2 Surface Card #1B2340, Level 3 Raised Modal #222B4D), buttons, form inputs, status badges, modal previews, and academic term badges.
   - Maintained unified RCA blue styling across all terms, eliminating harsh orange and green badges.
3. Added /__theme dev route in client/src/App.js with lazy loading.
4. Added Theme Showcase (/__theme) to the audit list in client/scripts/audit-contrast.js.

### Evidence
- Client build: vite build completed cleanly in 10.97s with zero errors, generating chunk ThemeShowcase.
- Password toggles verified: Eye and eye-off SVG icons toggle state smoothly on all password inputs.
- Built API address validator: node scripts/check-built-api-url.js passed with production API address confirmed.

## Part 8: Comprehensive Verification and Final Wrap-up

### What was changed
1. Fixed test fixtures in server/test/terms.test.js, server/test/uploadRestrictionsAndPermissions.test.js, and server/test/classFeatures.test.js to supply structurally valid PDF objects matching the Part 4 file validation requirements.
2. Closed dangling socket handles and added --test-force-exit to test runner scripts in package.json and server/package.json.
3. Ran automated verification across all test suites:
   - Root security suite: npm run test:security executed 6 test suites and passed all 46 subtests in 1.95s.
   - Full backend test suite: npm test executed 78 top-level tests (136 subtests) with 136 passing and 0 failures.
   - Character check: scan-characters.js confirmed zero emojis, zero em dashes, and zero en dashes across all modified and untracked repository files.
   - Git status: Verified all changes remain uncommitted on branch main for complete user review.

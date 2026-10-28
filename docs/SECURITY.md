# RCA Archive Security Policy and Architecture

## 1. Security Architecture Overview

RCA Archive implements defense in depth across network, application, database, and client layers:
- Architecture: React (Vite) client on Vercel, Node 20 Express API on a VPS behind Nginx reverse proxy and PM2, MongoDB database with local authentication.
- Real-time: Authenticated Socket.IO with session validation and automatic disconnect on token revocation.
- Authorization Model: Deny-by-default global authentication middleware with a minimal public allowlist.
- Data Minimization: Role-based response serializers (`mapUserForRole`, `mapPaperForRole`) ensuring passwords, hashes, reset tokens, internal file paths, and private emails are never exposed.

## 2. Authentication and Session Management

### 2.1 Server-Side Sessions Collection
- MongoDB `sessions` collection with a native TTL index on `expiresAt` (`{ expireAfterSeconds: 0 }`).
- Unique session identifier (`jti` UUID) stored in JWT access token.
- Token lifetime: 30 minutes.
- Sliding idle expiration: 30 minutes of inactivity revokes the session.
- Absolute session lifetime: 12 hours maximum lifetime regardless of activity.

### 2.2 Token Revocation and Multi-Device Logout
- `POST /api/logout`: Revokes the current session and terminates corresponding Socket.IO connections.
- `POST /api/logout-all`: Revokes all sessions for the user across all devices, increments the user `tokenVersion`, and disconnects all user sockets.
- Security events that bump `tokenVersion`:
  - Password change
  - Password reset via email OTP
  - Account deletion
  - Account disabled by administrator
- Multi-tab synchronization: BroadcastChannel (`rca_auth_channel`) with localStorage storage event fallback immediately clears state across all open browser tabs on logout.
- Silent Renewal: Client automatically performs silent background token renewal during the final ~20% of token lifetime using a concurrency lock to avoid duplicate requests.

## 3. Network and Edge Protection

### 3.1 Rate Limiting (Draft-7 Standards)
- Factory: Shared `createLimiter` middleware enforcing RFC draft-7 standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `RateLimit-Policy`, and combined `RateLimit`).
- Legacy header elimination: All `X-RateLimit-*` headers are stripped.
- Binding Limit Resolution: When multiple limiters evaluate a request, response headers reflect the binding limit closest to exhaustion.
- Anti-Spoofing: Express configured with `trust proxy: 1`. Client IP is resolved strictly from `req.ip` parsed by Express from the single trusted upstream proxy, preventing `X-Forwarded-For` spoofing.
- Limiter scopes:
  - Global API: 120 req/min per IP
  - Authentication (login, OTP, password reset): 5 to 10 req/15min keyed by `${ip}_${account}`
  - Public info endpoints: 60 req/min per IP
  - Health checks: 60 req/min per IP
  - Admin management: 300 req/15min per account

### 3.2 Anti-Fingerprinting and Health Endpoint
- `X-Powered-By` header disabled globally.
- `GET /api/health`: Public requests return minimal `{ "status": "ok" }` (or 503 `{ "status": "unavailable" }`).
- Database health pings cached for 5 seconds to prevent denial of service.
- Internal diagnostic details (database name, uptime, version, commit, CORS count) are restricted to direct loopback connections without proxy headers or authenticated administrators.

## 4. File Upload and Serving Security

### 4.1 Structural Content Validation
- Replaces legacy magic-byte prefix checks with complete structural parsing.
- PDF Inspection: Verifies header, EOF trailer, catalog/root object; blocks HTML polyglots; strictly blocks dangerous interactive actions (`/JavaScript`, `/JS`, `/Launch`, `/SubmitForm`, `/ImportData`, `/RichMedia`, `/EmbeddedFiles`).
- OOXML (DOCX, PPTX, XLSX) Inspection: Verifies package structure (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`); blocks VBA macros (`vbaProject.bin`, `macroEnabled`); blocks embedded OLE/ActiveX controls; blocks external relationship targets and remote templates (`TargetMode="External"`).
- OLE Binary (DOC, PPT, XLS) Inspection: Verifies compound file headers; blocks VBA macros and macro storage streams (`_VBA_PROJECT`, `VBA`, `Macros`); blocks embedded object pools.
- ZIP Archive Inspection: Verifies central directory, limits uncompressed size to 100 MB, limits compression ratio to 50:1 (zip bomb defense), blocks path traversal (`..`, leading slashes) and symbolic links.
- Image Inspection: Verifies PNG, JPEG, GIF, and WebP signatures, dimensions, and termination chunks; strictly blocks SVG images to prevent stored XSS.
- Plain Text Inspection: Verifies valid UTF-8, rejects NUL bytes, and rejects embedded HTML/script tags.
- Antivirus: Integrates host ClamAV (`clamdscan` / `clamscan`) when available.

### 4.2 Derived Stored Extensions
- Stored filename extension is derived from detected MIME/structural type, keeping random UUID basenames.
- Prevents extension spoofing and MIME confusion attacks.

### 4.3 Content Delivery Isolation
- Headers enforced on all file delivery routes:
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy: default-src 'none'; sandbox; frame-ancestors 'self' https://*.vercel.app https://archive.innov.rw`
- Safe inline types: Only safe preview formats (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`) may be delivered inline. All executable and macro-capable formats are forced to download attachment.
- Signed Access Links: Generated with 128-bit cryptographic nonces (`crypto.randomBytes(16)`) and 10-minute expiry timestamps with constant-time HMAC validation.

## 5. Security Headers and Content Security Policy

### 5.1 API Headers (Helmet)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: cross-origin`

### 5.2 Client Headers (Vercel and Nginx)
- Frontend CSP:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://* wss://*; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`

### 5.3 Nginx Reverse Proxy Hardening
- `server_tokens off`
- Timeout limits: `client_body_timeout 15s`, `client_header_timeout 15s`, `keepalive_timeout 30s`, `send_timeout 15s`
- Request body limits: `client_max_body_size 50M`

## 6. Vulnerability Reporting

If you discover a security vulnerability in RCA Archive:
1. Do not open public GitHub issues.
2. Email security findings to: `security@innov.rw`.
3. Include detailed steps to reproduce, affected endpoints, and impact assessment.
4. The security team acknowledges reports within 24 hours and provides remediation timelines.

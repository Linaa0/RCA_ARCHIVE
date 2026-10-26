# RCA Archive Deployment Architecture and Operational Map

## 1. System Architecture Overview

RCA Archive separates frontend hosting and backend processing across distinct infrastructure:
- Frontend: Hosted on Vercel, serving static Single Page Application (SPA) bundles at `https://rcaarchive.innov.rw` and `https://rca-archive.vercel.app`.
- Backend: Hosted on a Dedicated VPS, running Express and Node.js via PM2 behind Nginx at `https://api.archive.innov.rw`.
- Database: MongoDB running locally on the VPS (`127.0.0.1:27017`).

```
+-------------------------------------------------------------+
|                        Client Browser                       |
+-------------------------------------------------------------+
       |                                              |
       | 1. HTTP GET (HTML / JS / CSS assets)         | 2. REST API / WebSocket
       v                                              v
+-------------------------------+             +-------------------------------+
|         Vercel CDN            |             |            VPS Nginx          |
|  rcaarchive.innov.rw          |             |     api.archive.innov.rw      |
|  rca-archive.vercel.app       |             |     Port 80/443 (SSL/TLS)     |
+-------------------------------+             +-------------------------------+
                                                              |
                                                              | reverse proxy (127.0.0.1:5077)
                                                              v
                                              +-------------------------------+
                                              |       PM2: Node.js 20         |
                                              |        Express Server         |
                                              +-------------------------------+
                                                              |
                                                              | TCP connection
                                                              v
                                              +-------------------------------+
                                              |        Local MongoDB          |
                                              |       127.0.0.1:27017         |
                                              +-------------------------------+
```

### Critical Architectural Principle: One Backend Only
The Vercel deployment hosts static client assets only. There are no serverless API routes (`api/[...path].js`) on Vercel. All client requests to `/api/*` target `https://api.archive.innov.rw/api/*` directly.

---

## 2. Environment Variables Configuration

### Frontend (Vercel)
In the Vercel Project Settings -> Environment Variables:

| Variable | Required | Default Value | Notes |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | No (Recommended) | `https://api.archive.innov.rw/api` | Client automatically falls back to this production URL when built without this variable. Setting it explicitly reinforces configuration. |

### Backend (VPS Server: `/var/www/rca-past-papers/server/.env`)

| Variable | Required | Example Production Value | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security guards and suppresses test bypasses. |
| `PORT` | Yes | `5077` | Port Express listens on behind Nginx. |
| `BASE_URL` | Yes | `https://api.archive.innov.rw` | Public origin of the API server. Used for signed download/view links. |
| `FRONTEND_BASE_URL` | Yes | `https://rcaarchive.innov.rw` | Public primary frontend origin. Used for emails and links. |
| `CORS_ORIGINS` | Yes | `https://rcaarchive.innov.rw,https://rca-archive.vercel.app` | Comma-separated list of allowed web origins. |
| `MONGO_URI` | Yes | `mongodb://127.0.0.1:27017/rca-archive` | Local MongoDB database URI. |
| `JWT_SECRET` | Yes | `<64-byte-secure-hex-or-string>` | Secret used to sign user auth tokens. |
| `FILE_ACCESS_SECRET` | Yes | `<64-byte-secure-hex-or-string>` | Secret used for HMAC signed download/view tokens. |
| `ADMIN_INVITE_SECRET` | Yes | `<64-byte-secure-hex-or-string>` | Secret used to sign teacher invitation tokens. |
| `SMTP_HOST` | Yes | `smtp.example.com` | Production SMTP mail server hostname. |
| `SMTP_PORT` | Yes | `587` | Production SMTP port (typically 587 or 465). |
| `SMTP_SECURE` | Yes | `false` | Set to true for port 465, false for port 587 (STARTTLS). |
| `SMTP_USER` | Yes | `no-reply@innov.rw` | SMTP authentication username. |
| `SMTP_PASS` | Yes | `<smtp-account-password>` | SMTP authentication password. |
| `EMAIL_FROM` | Yes | `RCA Archive <no-reply@innov.rw>` | Email sender identity. |

---

## 3. DNS Records and Ownership

| Hostname | Record Type | Target Value | Managed By | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `rcaarchive.innov.rw` | CNAME or A | `cname.vercel-dns.com` or `76.76.21.21` | Domain Registrar / Innov.rw DNS | Primary frontend domain pointing to Vercel |
| `rca-archive.vercel.app` | Default CNAME | `cname.vercel-dns.com` | Vercel | Secondary frontend domain / Vercel default domain |
| `api.archive.innov.rw` | A | `<VPS Public IPv4 Address>` | Domain Registrar / Innov.rw DNS | Backend API domain pointing to VPS Nginx |

---

## 4. 5-Minute Verification Checklist for Owner

1. **Verify Health Endpoint Directly**
   - Open browser or terminal to `https://api.archive.innov.rw/api/health`.
   - Expected output:
     ```json
     {
       "status": "ok",
       "server": "ok",
       "database": "connected",
       "version": "1.0.0",
       "allowedCorsOriginsCount": 2
     }
     ```
   - HTTP response code must be 200 OK.

2. **Open Frontend in Incognito Window**
   - Navigate to `https://rcaarchive.innov.rw/login`.
   - Open Developer Tools (F12) -> Network tab (filter by Fetch/XHR).
   - Ensure NO top sticky red banner ("We cannot reach the server right now") is displayed.

3. **Verify Authentication Network Request**
   - Attempt login with valid credentials.
   - Inspect the request URL in DevTools Network tab:
     * Request URL must be `https://api.archive.innov.rw/api/auth/login`.
     * Request URL must NOT be `https://rcaarchive.innov.rw/api/auth/login`.
     * Response status must be 200 OK (or 401 if wrong password, NEVER 405 Method Not Allowed).

4. **Verify Paper View and Download**
   - Click "View" or "Download" on any accessible past paper.
   - Observe request to `POST https://api.archive.innov.rw/api/papers/:id/access-link`.
   - Browser opens view or initiates download using the signed URL pointing to `https://api.archive.innov.rw/api/papers/access/:token/view` or `/download`.

5. **Verify Real-Time WebSocket Connection**
   - Check the DevTools Network tab filter "WS".
   - Confirm WebSocket connection established to `wss://api.archive.innov.rw/socket.io/?...`.
   - Status 101 Switching Protocols.

---

## 5. Troubleshooting Guide

| Issue / Symptom | Root Cause | Resolution Steps |
| :--- | :--- | :--- |
| **405 Method Not Allowed on Login / Signup** | The frontend is submitting API requests to `https://rcaarchive.innov.rw/api/...` instead of `https://api.archive.innov.rw/api/...`. Vercel does not support POST requests to static SPA files or missing serverless routes. | 1. Ensure `client/src/services/api.js` points to `https://api.archive.innov.rw/api`.<br>2. Re-run `npm run build` in `client/` and deploy to Vercel.<br>3. Verify that `api/` directory does not exist in root directory. |
| **404 Not Found on API Request** | Request route does not exist on Express server or request URL omitted the `/api` path prefix. | 1. Check client request path in Network tab.<br>2. Confirm URL has `/api` prefix (e.g., `https://api.archive.innov.rw/api/auth/login`).<br>3. Check route mounting in `server/src/app.js`. |
| **CORS Error (Access-Control-Allow-Origin Missing / Disallowed)** | Browser blocked cross-origin response because client domain is not in backend allowed origins. | 1. Verify `CORS_ORIGINS` in `server/.env` includes `https://rcaarchive.innov.rw` and `https://rca-archive.vercel.app`.<br>2. Restart PM2 on VPS (`pm2 restart rca-api`). |
| **502 Bad Gateway / 503 Service Unavailable** | Nginx is running on VPS but Express backend on port 5077 is offline or crashed. | 1. SSH into VPS.<br>2. Run `pm2 status` to check process state.<br>3. Run `pm2 logs rca-api` to inspect crash stack trace.<br>4. Run `node scripts/check-env.js` inside `server/` to identify missing variables.<br>5. Restart with `pm2 restart rca-api` or `pm2 start src/index.js --name rca-api`. |
| **SSL / TLS Certificate Error** | Let's Encrypt certificate on VPS expired or hostname not covered by certificate. | 1. SSH into VPS.<br>2. Run `sudo certbot --nginx -d api.archive.innov.rw`.<br>3. Reload Nginx (`sudo systemctl reload nginx`). |
| **Blank Page on Frontend** | SPA routing rewrite missing on Vercel or uncaught client runtime JS error. | 1. Ensure `vercel.json` contains `rewrites: [{"source": "/(.*)", "destination": "/index.html"}]`.<br>2. Check browser DevTools Console for JavaScript exceptions. |
| **Red Banner: "We cannot reach the server right now"** | The frontend health check to `https://api.archive.innov.rw/api/health` failed or timed out. | 1. Check VPS status and Nginx status.<br>2. Test health endpoint from curl: `curl -I https://api.archive.innov.rw/api/health`.<br>3. Click "Retry" button on banner after restoring backend. |

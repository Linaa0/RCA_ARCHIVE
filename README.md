# RCA Archive (Rwanda Coding Academy Past-Papers Portal)

A full-stack past-papers and learning resources portal for Rwanda Coding Academy students and faculty.

---

## Architecture & Project Structure

The repository is organized into a clean decoupled monorepo:

```
rca-archive/
├── client/                  # Frontend (React 19, Vite, React Router 7, Vanilla CSS)
│   ├── src/
│   │   ├── assets/          # Static branding assets and images
│   │   ├── components/      # UI components (Admin, Login, Search, Papers, etc.)
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── layouts/         # Layout components
│   │   ├── pages/           # Route views / page components
│   │   ├── services/        # Centralized Axios API instance (api.js)
│   │   ├── styles/          # Vanilla CSS stylesheets
│   │   └── utils/           # Auth storage and API helpers
│   ├── public/              # Static public web assets and icons
│   ├── index.html           # HTML entry point
│   ├── vite.config.js       # Vite configuration with API reverse proxy
│   ├── package.json         # Frontend-only dependencies
│   └── .env.example         # Client environment template
├── server/                  # Backend (Node.js 20, Express, MongoDB, Multer)
│   ├── src/
│   │   ├── config/          # Environment loading and constants
│   │   ├── controllers/     # Route group controllers (auth, papers, admin, etc.)
│   │   ├── middleware/      # Auth (JWT), role guards, upload, rate limiting
│   │   ├── models/          # MongoDB collections and index definitions
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Email/OTP, stream-based SHA-256 hashing, storage
│   │   ├── utils/           # String, URL, and user normalization utilities
│   │   ├── app.js           # Express application setup
│   │   └── server.js        # Server entry point
│   ├── scripts/             # Admin creation, seeding, and database checks
│   │   ├── create-admin.js  # Bootstrap admin user from environment
│   │   ├── check-db.js      # Diagnostic script for database connectivity
│   │   └── seedDatabase.js  # Seed initial test data
│   ├── uploads/             # Document storage directory (.gitkeep)
│   ├── ecosystem.config.cjs # PM2 production process configuration
│   ├── package.json         # Backend-only dependencies
│   └── .env.example         # Server environment template
├── nginx/                   # Production Nginx site configurations
│   ├── api.archive.innov.rw.conf
│   └── rcaarchive.innov.rw.conf
├── scripts/
│   └── deploy-backend.sh    # Production deployment shell script
├── .gitignore               # Root git ignore
├── package.json             # Root monorepo dev runner scripts
└── README.md                # Documentation
```

---

## Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **MongoDB**: >= 6.0 running locally or accessible via URI

---

## Quick Start (Local Development)

### 1. Install Dependencies

You can install all dependencies from the root directory:

```bash
npm run install:all
```

Or install in each directory individually:

```bash
# Root
npm install

# Client
cd client && npm install

# Server
cd server && npm install
```

### 2. Configure Environment Variables

#### Frontend (`client/.env`)
Copy `client/.env.example` to `client/.env`:

```bash
cp client/.env.example client/.env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL for API requests (production defaults to https://api.archive.innov.rw/api) | `/api` (Dev via Vite proxy) / `https://api.archive.innov.rw/api` (Production) |
| `VITE_BACKEND_URL` | Dev proxy destination URL for Vite | `http://localhost:5077` |

#### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env`:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend HTTP port | `5077` (Local) / `5009` (Production) |
| `NODE_ENV` | Runtime environment | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017` |
| `MONGO_DB_NAME` | Database name | `rca_past_papers` / `rca_archive_db` |
| `JWT_SECRET` | Secret key for JWT signing (>= 32 chars) | (Generate secure 64-byte hex string) |
| `ADMIN_BOOTSTRAP_EMAILS` | Comma-separated admin emails | `admin@rca.ac.rw` |
| `TEACHER_EMAILS` | Comma-separated teacher emails | `teacher@rca.ac.rw` |
| `BASE_URL` | Backend public base URL | `http://localhost:5077` |
| `FRONTEND_BASE_URL` | Frontend URL for links in emails | `http://localhost:3074` |
| `CORS_ORIGINS` | Additional allowed CORS origins | `https://rcaarchive.innov.rw,...` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username / email address | |
| `SMTP_PASS` | SMTP application password | |
| `EMAIL_FROM` | Sender identity in emails | `"RCA Archive" <email>` |

---

### 3. Run the Application

#### Run both Frontend & Backend concurrently:
```bash
npm run dev
```

- **Frontend**: [http://localhost:3074](http://localhost:3074)
- **Backend API**: [http://localhost:5077/api](http://localhost:5077/api)
- **Health Check**: [http://localhost:5077/api/health](http://localhost:5077/api/health)

#### Run individually:
```bash
# Frontend only
npm run dev:client
# or: cd client && npm run dev

# Backend only
npm run dev:server
# or: cd server && npm run dev
```

---

## Utility Scripts

### Create / Update Admin Account
Bootstrap or reset an administrator account:
```bash
node server/scripts/create-admin.js
```
*(Reads `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` from `server/.env`, or pass as arguments: `node server/scripts/create-admin.js <email> <password> [name]`)*

### Diagnostic Database Check
Check MongoDB connection and record counts:
```bash
node server/scripts/check-db.js
```

### Seed Initial Sample Data
```bash
node server/scripts/seedDatabase.js
```

---

## Production Deployment

### Production Domains
- **Frontend SPA**: `https://rcaarchive.innov.rw`
- **Backend API**: `https://api.archive.innov.rw` (runs on port `5009` behind Nginx)

### PM2 Process Manager
The backend is managed with PM2 using `server/ecosystem.config.cjs`:
```bash
cd /opt/apps/rca_archive
pm2 startOrReload server/ecosystem.config.cjs --update-env
pm2 save
```

### Automated CI/CD
Deployment is automated via GitHub Actions in `.github/workflows/deploy-backend.yml` executing `scripts/deploy-backend.sh`.

---

## Security Best Practices
- Real credentials and secrets are kept in .env files and never committed to version control.
- All file uploads are hashed using stream-based SHA-256 for instant deduplication.
- Login endpoints enforce failed attempt rate limiting with automated security email notifications.

---

## Academic Terms (Term 1, Term 2, Term 3)

The portal structures learning resources, past papers, notes, quizzes, exams, and assignments by Rwandan academic terms:

### Data Model and One Source of Truth
- Valid terms are numbers: 1, 2, or 3. Labels: "Term 1", "Term 2", "Term 3".
- Validated via `server/src/config/terms.js` and exposed publicly via `GET /api/curriculum` (`terms` array).
- Legacy records without a term are treated as "Term not set" (null or undefined) without destructive data migrations.
- Student submissions inherit their assignment term automatically.

### Validation Rules
- Required on upload: `POST /api/upload`, `POST /api/teacher/resources`, and `POST /api/assignments` reject missing or invalid term with HTTP 400 (`{ error: "Choose Term 1, Term 2 or Term 3", field: "term" }`). Validation occurs before file storage.
- Duplicate detection: whole-app SHA-256 hash check returns 409 specifying existing item location including term label (for example "This paper already exists in Year 2, Mathematics, Term 1.").

### Key API Endpoints
- `GET /api/curriculum`: Returns accredited subjects, promotions, and available academic terms with labels.
- `GET /api/papers?term=1|2|3|unset&withMeta=1`: Filters papers by term and returns `termCounts: { 1: n, 2: n, 3: n, unset: n }`.
- `PUT /api/papers/:id`: Updates term (allowed for uploader, any teacher, and admin; other students receive 403). Emits `paper:updated`.
- `PATCH /api/admin/papers/term`: Bulk updates terms for an array of paper IDs (`{ ids: [...], term: 1 }`). Admin-only, records audit log, emits real-time updates.
- `GET /api/admin/stats`: Includes `papersByTerm` (`{ 1, 2, 3, unset }`) and `papersByYearTerm` (Y1, Y2, Y3 rows by term columns, with real counts and zeros shown as 0).
- `GET /api/admin/users/:id/resources?term=...`: Per-user uploads with term filter and term counts.
- `PATCH /api/teacher/resources/:id/term`: Updates teacher resource term (owner teacher or admin). Emits `resource:updated`.
- `PATCH /api/assignments/:id/term`: Updates assignment term (owner teacher or admin). Emits `assignment:updated`.

### Deployment Synchronization
Important: The backend and frontend must be deployed together because the server strictly requires a valid term on all uploads.

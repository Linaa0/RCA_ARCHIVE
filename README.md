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
| `VITE_API_URL` | Base URL for API requests | `http://localhost:5077/api` |
| `VITE_BACKEND_URL` | Dev proxy destination URL | `http://localhost:5077` |

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
| `JWT_SECRET` | Secret key for JWT signing | `rca_secret_key_2024` |
| `ADMIN_BOOTSTRAP_EMAILS` | Comma-separated admin emails | `deenovdunya01@gmail.com,chretiensano@gmail.com,mucyoasifiwe80@gmail.com` |
| `ADMIN_BOOTSTRAP_EMAIL` | Admin email for `create-admin.js` | `mucyoasifiwe80@gmail.com` |
| `ADMIN_BOOTSTRAP_PASSWORD` | Admin password for `create-admin.js` | (Your secure password) |
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
- Real credentials and secrets are kept in `.env` files and **never** committed to version control.
- All file uploads are hashed using stream-based SHA-256 for instant deduplication.
- Login endpoints enforce failed attempt rate limiting with automated security email notifications.

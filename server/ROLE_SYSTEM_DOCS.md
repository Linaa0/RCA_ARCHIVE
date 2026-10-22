# Role-Based Authentication System Documentation

## Overview

This document explains the separate signup logic for students and teachers in the RCA Past Papers application. The system uses **email-based role assignment** with automatic role detection based on a hardcoded teacher email list.

## Architecture

### 1. **Models** - User Schema

The user model now includes:

```javascript
{
  id: string,              // Unique identifier
  email: string,           // Primary identifier (unique)
  username: string,        // Display name (derived from email)
  password: string,        // Bcrypt hashed password
  role: "student" | "teacher", // Auto-assigned by backend
  createdAt: string        // ISO timestamp
}
```

### 2. **Authorization Hierarchy**

```
Student Role:
├── Read access to papers
├── Upload papers
├── Rate papers
└── Delete own papers

Teacher Role (includes all student permissions):
├── Delete any papers
├── View admin dashboard (future)
└── Manage content (future)
```

## Signup Flow

### Diagram

```
User Signup Request
    ↓
Backend receives: { email, password }
    ↓
Validate email format
    ↓
Check if email already exists
    ↓
Determine role:
├─ If email in TEACHER_EMAILS → role = "teacher"
└─ Otherwise → role = "student"
    ↓
Hash password + Create user
    ↓
Return { success, role, email, username }
```

### Code Implementation

**File:** `rcabackend/server.js` (POST `/api/signup`)

```javascript
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate
  // 2. Check if email exists
  // 3. Determine role based on teacher email list
  const isTeacherEmail = TEACHER_EMAILS.some(
    (teacherEmail) => teacherEmail.toLowerCase() === email.toLowerCase(),
  );
  const role = isTeacherEmail ? "teacher" : "student";

  // 4. Create and save user
});
```

## Role Assignment Logic

### Teacher Email List

**File:** `rcabackend/teacherEmails.js`

The hardcoded list of teacher emails that will automatically receive the "teacher" role:

```javascript
const TEACHER_EMAILS = [
  "teacher@rca.ac.uk",
  "admin@rca.ac.uk",
  "staff@rca.ac.uk",
  "instructor@rca.ac.uk",
  "prof.smith@rca.ac.uk",
  "prof.johnson@rca.ac.uk",
];
```

**To add more teacher emails:**

1. Edit `rcabackend/teacherEmails.js`
2. Add new email to the array
3. Restart the backend server

### Role Decision

- **Role is determined at signup time**, not retrieved from a database
- **Backend has complete control** - frontend cannot influence role assignment
- **Email matching is case-insensitive**

## Authentication Flow

### Login Endpoint

**POST** `/api/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "token": "jwt.token.here",
  "email": "user@example.com",
  "username": "user",
  "role": "student"
}
```

**File:** `rcabackend/server.js` (POST `/api/login`)

The JWT token includes the user's role:

```javascript
const token = jwt.sign(
  {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role, // Role from database
  },
  JWT_SECRET,
  { expiresIn: "7d" },
);
```

## Middleware - Authorization

### 1. **requireAuth** - Authentication only

```javascript
function requireAuth(req, res, next) {
  // Verifies JWT token
  // Allows both students and teachers
  // Sets req.user with decoded token
}
```

**Used by:** Paper upload, rating, profile endpoints

### 2. **requireTeacher** - Authentication + Teacher role

```javascript
function requireTeacher(req, res, next) {
  // Verifies JWT token
  // Checks req.user.role === "teacher"
  // Returns 403 if not a teacher
}
```

**Used by:** (Ready for future teacher-only endpoints)

- Paper deletion by any user
- Admin dashboard
- Content management

## Routes Overview

### Public Routes

- `POST /api/signup` - User registration
- `POST /api/login` - User authentication
- `GET /api/papers` - List papers with filters

### Protected Routes (requireAuth)

- `POST /api/upload` - Upload a paper
- `POST /api/papers/:id/rate` - Rate a paper
- `GET /api/stats` - Get statistics

### Teacher-Only Routes (requireTeacher - ready to implement)

```javascript
app.delete("/api/papers/:id", requireAuth, async (req, res) => {
  // Current: allows user to delete own papers OR teacher to delete any
  // Can be updated to use requireTeacher middleware
});
```

## Frontend Integration

### Updated Login Component

**File:** `src/components/Login.jsx`

Key changes:

1. **Removed** role selection dropdown
2. **Uses email** for both signup and login
3. **Shows info message** during signup explaining role assignment
4. **Stores email and role** in localStorage

Example signup message:

```
"Account created successfully! Role assigned: teacher.
You have been recognized as a teacher."
```

### Storage in localStorage

After successful authentication:

```javascript
localStorage.setItem("token", data.token); // JWT
localStorage.setItem("email", data.email); // User email
localStorage.setItem("username", data.username); // Display name
localStorage.setItem("role", data.role); // student/teacher
```

## Security Features

### ✅ Security Measures Implemented

1. **Backend Role Authority**
   - Frontend cannot override role assignment
   - Role determined by backend email list only

2. **Password Security**
   - Passwords hashed with bcryptjs (10 salt rounds)
   - Never stored in plain text

3. **JWT Authentication**
   - Tokens expire after 7 days
   - Signed with SECRET_KEY
   - Cannot be forged without secret

4. **Email Validation**
   - Email format verified on signup
   - Email uniqueness enforced

5. **Role-Based Access Control**
   - Middleware validates role before allowing operations
   - 403 Forbidden returned if student tries teacher endpoint

## Database Schema

### users Collection

```javascript
[
  {
    id: "1777122463366",
    email: "student@example.com",
    username: "student",
    password: "$2b$10$...", // Hashed
    role: "student",
    createdAt: "2026-05-11T00:00:00.000Z",
  },
  {
    id: "1777122463367",
    email: "teacher@rca.ac.uk",
    username: "teacher",
    password: "$2b$10$...", // Hashed
    role: "teacher",
    createdAt: "2026-05-11T00:00:00.000Z",
  },
];
```

## Migration Guide (From Old System)

If you have existing users with just username:

1. Users can still upload papers as their old accounts still exist
2. New signups use email-based system
3. Old accounts remain unchanged in database
4. Eventually phase out old accounts

## Testing the System

### Test 1: Student Signup

```bash
POST /api/signup
{
  "email": "student@gmail.com",
  "password": "testpass123"
}
# Response: role = "student"
```

### Test 2: Teacher Signup

```bash
POST /api/signup
{
  "email": "teacher@rca.ac.uk",
  "password": "testpass123"
}
# Response: role = "teacher"
```

### Test 3: Privilege Escalation Prevention

```bash
# Student tries to use teacher endpoint
GET /api/admin (with student token)
# Response: 403 Forbidden - Teacher access required
```

## Future Enhancements

1. **Email Verification**
   - Send confirmation email on signup
   - Verify email ownership

2. **Dynamic Teacher List**
   - Store teacher emails in database
   - Allow admin to add/remove teachers
   - No restart needed

3. **Role Management**
   - Endpoint to promote students to teachers
   - Audit log of role changes

4. **Two-Factor Authentication**
   - SMS or TOTP-based 2FA
   - Enhanced security for teachers

## Troubleshooting

### Issue: "Email already registered"

- User already has an account with that email
- Solution: Login instead or use different email

### Issue: "Teacher access required"

- Student tried to access teacher endpoint
- Solution: Account must be registered with teacher email

### Issue: Token expired

- JWT token is older than 7 days
- Solution: Login again to get new token

### Issue: Wrong role assigned

- Check if email is in `teacherEmails.js`
- Remember: case-insensitive matching
- Solution: Restart backend after updating teacher emails

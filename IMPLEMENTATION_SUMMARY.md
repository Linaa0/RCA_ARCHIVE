# Implementation Summary - Role-Based Authentication System

## What Was Implemented

### 1. Backend Changes

#### **New Files Created:**

- `rcabackend/teacherEmails.js` - Hardcoded list of teacher emails
- `rcabackend/seedDatabase.js` - Utility to seed test data
- `rcabackend/ROLE_SYSTEM_DOCS.md` - Complete documentation

#### **Files Modified:**

- `rcabackend/server.js` - Updated signup/login logic and added `requireTeacher` middleware

**Key Backend Changes:**

```javascript
// 1. Import teacher emails
const { TEACHER_EMAILS } = require("./teacherEmails");

// 2. Add requireTeacher middleware
function requireTeacher(req, res, next) {
  // Validates user is authenticated AND has teacher role
}

// 3. Updated signup - uses email, auto-assigns role
POST / api / signup;
Input: {
  (email, password);
}
Output: {
  (message, role, email, username);
}

// 4. Updated login - uses email
POST / api / login;
Input: {
  (email, password);
}
Output: {
  (token, email, username, role);
}
```

### 2. Frontend Changes

#### **Files Modified:**

- `src/components/Login.jsx` - Converted to email-based auth, removed role selection
- `src/components/Login.css` - Added info box styling
- `src/components/Navbar.jsx` - Updated logout to handle email field

**Key Frontend Changes:**

1. Removed username input from signup
2. Uses email for both signup and login
3. Added informational message about teacher role assignment
4. Frontend stores email in localStorage
5. Role determined entirely by backend

### 3. Database Schema Updates

**Old Schema (Username-based):**

```javascript
{
  id, username, password, role: "student", createdAt
}
```

**New Schema (Email-based):**

```javascript
{
  id, email, username, password, role: "student"|"teacher", createdAt
}
```

## Security Features

### Implemented

- **Backend Role Authority**: Frontend cannot override role
- **Email-based Role Determination**: Role assigned by matching email against teacher list
- **Case-insensitive Email Matching**: "Teacher@RCA.AC.UK" == "teacher@rca.ac.uk"
- **JWT Token with Role**: Token includes role for client-side UI logic
- **requireTeacher Middleware**: Ready for teacher-only endpoints
- **Password Hashing**: bcryptjs with 10 salt rounds

## How the System Works

### Signup Flow

```
1. User enters email + password
2. Frontend sends to POST /api/signup
3. Backend receives { email, password }
4. Backend checks if email in TEACHER_EMAILS list
5. If match → role = "teacher", else → role = "student"
6. User saved to database with assigned role
7. Response includes role
8. Frontend shows appropriate message
```

### Login Flow

```
1. User enters email + password
2. Frontend sends to POST /api/login
3. Backend authenticates
4. Returns JWT with embedded role
5. Frontend stores email, role, and token
```

### Authorization Flow

```
requestAuth Middleware:
├─ Verify JWT token
└─ Allow any authenticated user

requireTeacher Middleware:
├─ Verify JWT token
├─ Check role === "teacher"
└─ Return 403 if not teacher
```

## Adding New Teachers

To add a new teacher who will automatically get the teacher role:

**File: `rcabackend/teacherEmails.js`**

```javascript
const TEACHER_EMAILS = [
  "teacher@rca.ac.uk",
  "admin@rca.ac.uk",
  // ... existing emails ...
  "newinstructor@rca.ac.uk", // ← Add here
];
```

Then restart the backend server.

## Testing the Implementation

### Test 1: Student Signup

```bash
curl -X POST http://localhost:5077/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@gmail.com","password":"pass123"}'

Response: {
  "message": "Account created successfully!",
  "role": "student",
  "email": "alice@gmail.com",
  "username": "alice"
}
```

### Test 2: Teacher Signup (Email in list)

```bash
curl -X POST http://localhost:5077/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@rca.ac.uk","password":"pass123"}'

Response: {
  "message": "Account created successfully!",
  "role": "teacher",
  "email": "teacher@rca.ac.uk",
  "username": "teacher"
}
```

### Test 3: Login

```bash
curl -X POST http://localhost:5077/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@gmail.com","password":"pass123"}'

Response: {
  "token": "eyJhbGciOi...",
  "email": "alice@gmail.com",
  "username": "alice",
  "role": "student"
}
```

## Frontend Integration Points

### Login Component

- Shows email field for both signup and login
- Removes role dropdown (backend decides)
- Shows info message during signup
- Displays role confirmation after successful signup

### Navbar Component

- Displays username (derived from email)
- Removes email from localStorage on logout

### Protected Routes

- Already have PrivateRoute component
- Can be extended with role-based routing if needed

## Usage Instructions

### For Users

1. **Signup**: Use your email address (not username)
2. **If Teacher**: Use your registered RCA email (e.g., teacher@rca.ac.uk)
3. **If Student**: Use any email address
4. **Login**: Use the same email + password

### For Administrators

1. **Add Teacher**: Add email to `rcabackend/teacherEmails.js`
2. **Restart Backend**: Changes take effect on next startup
3. **Existing Teachers**: Will automatically be recognized on next login

## 📊 Database Migration (Optional)

If you have existing username-based users:

- They remain unchanged
- New users use email-based system
- Can coexist temporarily
- Gradual migration possible

To seed test data:

```bash
cd rcabackend
node seedDatabase.js
```

## API Endpoints Summary

### Authentication

- `POST /api/signup` - Create new account (email-based)
- `POST /api/login` - Login (email-based)

### Papers (Protected with requireAuth)

- `POST /api/upload` - Upload new paper
- `GET /api/papers` - List papers
- `POST /api/papers/:id/rate` - Rate a paper
- `DELETE /api/papers/:id` - Delete paper (own or teacher)

## Future Enhancements

1. **Email Verification**: Confirm email ownership on signup
2. **Dynamic Teacher List**: Store teachers in database instead of hardcoding
3. **Admin Panel**: UI to manage teachers without restart
4. **Audit Logging**: Track who did what and when
5. **Password Reset**: Email-based password recovery

## Files Changed Summary

```
rcabackend/
├── teacherEmails.js ..................... NEW
├── seedDatabase.js ...................... NEW
├── ROLE_SYSTEM_DOCS.md .................. NEW
└── server.js ............................ UPDATED
    ├── Added TEACHER_EMAILS import
    ├── Added requireTeacher middleware
    ├── Updated POST /api/signup
    └── Updated POST /api/login

src/components/
├── Login.jsx ............................ UPDATED
│   ├── Email-based authentication
│   ├── Removed role selection
│   └── Added info message
├── Login.css ............................ UPDATED
│   └── Added form-info-box styling
└── Navbar.jsx ........................... UPDATED
    └── Updated logout to remove email
```

## Key Principles

1. **Never trust frontend role selection**
   - Backend is the source of truth
   - Role determined by email matching

2. **Clear separation of concerns**
   - Models: User schema with role
   - Routes: Signup/login with role logic
   - Middleware: Authorization checks
   - Seed data: Hardcoded teacher emails

3. **Backwards compatible**
   - Old users still work
   - New system uses email
   - Can migrate gradually

4. **Secure by default**
   - Password hashing
   - JWT tokens with roles
   - Middleware-enforced permissions
   - Case-insensitive email matching

---

**Status**: ✅ Implementation Complete

All requirements have been implemented with clean code organization and comprehensive documentation.

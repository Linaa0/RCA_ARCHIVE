# RCA Past Papers System — Setup Guide

## 📁 Project Structure
```
RCA_ARCHIVE/          ← Your existing React frontend
rca-backend/          ← New backend folder (place this alongside RCA_ARCHIVE)
```

---

## 🚀 Step 1 — Set Up the Backend

1. Create a folder called `rca-backend` anywhere on your computer
2. Copy `server.js` into it
3. Open terminal inside `rca-backend` and run:

```bash
npm init -y
npm install express bcryptjs jsonwebtoken multer lowdb cors
```

4. Start the backend:
```bash
node server.js
```

You should see: `✅ RCA Backend running on http://localhost:5000`

---

## 🖥️ Step 2 — Update Your Frontend Files

Replace these files in your `src/components/` folder:
- `Login.jsx` → use the new Login.jsx
- `Login.css` → use the new Login.css
- `Navbar.jsx` → use the new Navbar.jsx
- `Navbar.css` → use the new Navbar.css
- `SubjectPage.jsx` → use the new SubjectPage.jsx
- `SubjectPage.css` → use the new SubjectPage.css

Replace `src/App.js` with the new App.js (removes admin route).

---

## ▶️ Step 3 — Start the Frontend

In your `RCA_ARCHIVE` folder:
```bash
npm start
```

---

## ✅ How It Works

### Sign Up & Login
- Go to `/login`
- First time? Click "No account? Sign Up"
- Choose role: Student or Teacher
- After signup, log in with your username and password

### Uploading Papers
- Log in first
- Click any subject
- Click "⬆ Upload Paper / Note"
- Fill in the title, type, and choose a file
- Click Upload

### Duplicate Detection
- When you upload a file, the backend computes a **SHA-256 hash** of the file content
- If the same file was already uploaded (even with a different name), you will see a popup:
  > ⚠️ "This paper already exists! It was uploaded as [title] by [username]."
- The upload is blocked automatically

### Deleting Papers
- You can delete papers **you uploaded**
- Teachers can delete **any paper**

---

## 🔑 No More Admin
- The admin login and admin dashboard have been removed
- Every logged-in student and teacher can upload
- Teachers have extra permission to delete any paper

---

## 🗄️ Database
- All data is stored in `rca-backend/db.json` (auto-created)
- Uploaded files are stored in `rca-backend/uploads/`
- No extra database software needed!
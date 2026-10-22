# Teacher dashboard, assignments & appeals

## Who gets which dashboard
Decided by the email, in `server/src/config/roles.js`:

| Email | Role | Lands on |
|---|---|---|
| `mucyoasifiwe80@gmail.com` (+ the 2 other admin emails already in `config/env.js`) | admin | `/admin` |
| `isabellecadeau78@gmail.com` | teacher | `/teacher` |
| anything else | student | `/home` |

- Add teachers: put the email in `DEFAULT_TEACHER_EMAILS` in `roles.js` (or set the `TEACHER_EMAILS` env var, comma separated) and restart the server.
- The role is applied at **signup** and re-checked at **every login**, so someone who already signed up as a student gets promoted the next time they log in.
- Teachers created from the Admin panel keep working (nobody is ever auto-demoted).
- Routes are protected on the frontend (`PrivateRoute`) and on the backend (`requireTeacher` / `requireStudent` / `requireAdmin`).

## Flow
1. **Teacher** creates an assignment (title, subject, instructions, deadline) for all students or selected students.
2. **Student** sees it under *My Assignments* (and a summary on the dashboard) and submits text and/or a file before the deadline.
3. If the deadline passes without a submission, the student can send **one appeal** with a reason.
4. **Teacher** sees it under *Appealed Assignments* (count shown in the sidebar) and approves (choosing a new deadline) or rejects (with an optional message).
5. If approved, the student can submit until the new deadline.

Teacher sidebar: Dashboard · Assignments · Resources · Appealed Assignments · Profile · Log Out.

## Teacher resources
Teachers can upload PDF and document resources from **Resources**, choose whether each upload is a note or a past paper, and optionally add a subject and year/class. Notes and past papers appear in separate tabs. Each teacher sees only their own uploads; files are served through authenticated teacher-only routes.

## New API endpoints (all under `/api`, JWT required)
- `GET/PUT /me`, `PUT /me/password`
- `GET /teacher/stats`, `GET /teacher/students` (teacher)
- `GET/POST /teacher/resources`, `GET /teacher/resources/:id/file` (teacher)
- `GET/POST /assignments`, `GET/PUT/DELETE /assignments/:id`
- `POST /assignments/:id/submit` (student, multipart), `GET /assignments/:id/submissions/:sid/file`
- `POST /assignments/:id/appeal` (student)
- `GET /appeals`, `PATCH /appeals/:id/approve`, `PATCH /appeals/:id/reject` (teacher)

New MongoDB collections: `assignments`, `submissions`, `appeals`, `teacherResources` (indexes are created on startup).
Submitted files are stored in `server/submissions/` and are only downloadable through the authenticated endpoint.

## Bug fixed on the way
The login page sent `identifier` and read `data.user.role`, but the server expected `email` and returned `role`, so role-based redirects could not work. Both sides now agree.

# RCA Archive API Reference - Academic Terms

This document specifies the academic term integration across the RCA Archive backend API and frontend interfaces.

## 1. Terms Specification

Valid academic terms in the system are numeric:
- 1: Term 1
- 2: Term 2
- 3: Term 3

Legacy records without a term are treated as "unset" or "Term not set" (stored as null or undefined in MongoDB).
No destructive migrations are run on existing records.

Normalizer accepts:
- Numbers: 1, 2, 3
- Strings: "1", "2", "3", "term1", "term 1", "Term 1", "Term 2", "Term 3"
- Rejects any other value with HTTP 400.

## 2. Public Endpoints

### GET /api/curriculum
Returns accredited subjects, classes, promotions, and available terms.
Response includes:
```json
{
  "promotions": [...],
  "terms": [
    { "id": 1, "value": 1, "label": "Term 1" },
    { "id": 2, "value": 2, "label": "Term 2" },
    { "id": 3, "value": 3, "label": "Term 3" }
  ]
}
```

## 3. Upload and Creation Endpoints

### POST /api/upload
Uploads past papers, notes, quizzes, or exams.
Required fields:
- title (string)
- subject (string)
- year (number/string, 1, 2, or 3)
- type (string: "past_paper", "notes", "quiz", "exam")
- term (number/string: 1, 2, or 3)
- file (multipart file)

Validation:
If term is missing or invalid:
HTTP 400:
```json
{
  "error": "Choose Term 1, Term 2 or Term 3",
  "field": "term"
}
```
Validation occurs BEFORE the uploaded file is processed or stored. Any temporary upload file is immediately removed from disk upon validation failure.

Duplicate Detection:
If the file content SHA-256 hash already exists in the repository:
HTTP 409:
```json
{
  "error": "This paper already exists in Year 2, Mathematics, Term 1.",
  "location": {
    "year": "Year 2",
    "subject": "Mathematics",
    "term": 1,
    "termLabel": "Term 1",
    "type": "Past Paper",
    "title": "Existing Calculus Paper",
    "uploader": "Jane Doe"
  }
}
```

### POST /api/teacher/resources
Teacher resource creation (notes, reference materials, guides).
Required fields: title, subject, year, type, term, file.
Rejects missing or invalid term with HTTP 400 (`{ error: "Choose Term 1, Term 2 or Term 3", field: "term" }`).

### POST /api/assignments
Teacher assignment creation.
Required fields: title, subject, classId, deadline, term, instructions, optional attachment.
Rejects missing or invalid term with HTTP 400 (`{ error: "Choose Term 1, Term 2 or Term 3", field: "term" }`).

## 4. Listing and Search Endpoints

### GET /api/papers
Query parameters:
- subject (string)
- year (number)
- type (string)
- term (1, 2, 3, or "unset")
- withMeta (1: returns termCounts)

Response:
```json
{
  "papers": [...],
  "termCounts": {
    "1": 12,
    "2": 8,
    "3": 15,
    "unset": 4
  }
}
```

### GET /api/subject-materials
Query parameters:
- year (number)
- subject (string)
- term (1, 2, 3, or "unset")

Returns materials grouped into past papers, teacher resources, and assignments, all with term metadata and termCounts.

## 5. Updates and Permissions

### PUT /api/papers/:id
Updates paper metadata including term.
Allowed roles:
- The original uploader (student, teacher, or admin)
- Any teacher
- Any admin
Other students receive HTTP 403.
Emits `paper:updated` via Socket.IO.

### PATCH /api/teacher/resources/:id/term
Updates teacher resource term.
Allowed roles: owner teacher or admin.
Emits `resource:updated` via Socket.IO.

### PATCH /api/assignments/:id/term
Updates assignment term.
Allowed roles: owner teacher or admin.
Emits `assignment:updated` via Socket.IO.

### PATCH /api/admin/papers/term
Bulk updates terms across multiple papers.
Allowed roles: Admin only.
Request body:
```json
{
  "ids": ["paper_id_1", "paper_id_2"],
  "term": 1
}
```
Response:
```json
{
  "message": "Updated 2 papers to Term 1",
  "changed": 2,
  "term": 1,
  "termLabel": "Term 1"
}
```
Writes an audit log entry in `admin_audit_logs` and emits `paper:updated` for each affected document.

## 6. Admin Statistics Endpoints

### GET /api/admin/stats
Includes MongoDB aggregation results:
- `papersByTerm`: `{ "1": n, "2": n, "3": n, "unset": n }`
- `papersByYearTerm`: Y1, Y2, Y3 rows by Term 1, Term 2, Term 3, and unset columns, with real counts and zeros shown as 0.

### GET /api/admin/users/:id/resources
Returns papers and materials uploaded by a specific user:
- Query param: `?term=1|2|3|unset`
- Returns: `{ resources: [...], termCounts: { 1: n, 2: n, 3: n, unset: n }, total: n }`

## 7. Email and Notifications

Notifications and reminder emails including:
- Assignment deadline reminders (48-hour and 24-hour notifications)
- Deletion appeal decisions (approved/rejected)
All include the academic term label (for example "Term 1") in both the email text and subject context.

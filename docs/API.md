# Versioned REST API

Base URL: `http://localhost:5000/api/v1`. Except for login and health, endpoints
require the signed `college_session` HTTP-only cookie. The browser client sends
credentials with same-origin requests.

## Response contract

Collections:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Errors return `success: false`, a safe `message`, and an `errors` array. Database
details and stacks are not returned to clients.

## Authentication

- `POST /auth/login` — `{ "email": "...", "password": "..." }`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password` — `{ "currentPassword": "...", "newPassword": "..." }`
- `POST /auth/password-reset/request` — `{ "email": "..." }`, always returns a generic response
- `POST /auth/password-reset/complete` — `{ "token": "...", "newPassword": "..." }`

Sign-in attempts are rate-limited. JWTs are held only in an HTTP-only,
SameSite=Lax cookie. `COOKIE_SECURE=true` enables the Secure cookie flag.

## Phase 1 resources

`GET /users`, `POST /users`, `GET /users/:id`, `PATCH /users/:id`,
`DELETE /users/:id`, `POST /users/:id/reset-password`, `GET /roles`

`GET`, `POST`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` are available for:

- `/departments`
- `/academic-sessions`
- `/programs`
- `/students`
- `/faculty`
- `/courses`
- `/enrollments` (retained from the initial MVP)

Other endpoints:

- `GET /health`
- `GET /dashboard`
- `GET /college-settings`, `PATCH /college-settings`
- `GET /notifications?page=1&limit=20`
- `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- `GET /audit-logs?page=1&limit=20`

Collection endpoints support `page`, `limit` (maximum 100), `q`, `sort`,
`order=asc|desc`, and resource-specific filters such as `status`,
`department_id`, `program_id`, and `academic_session_id`. Sort fields and
filter names are allow-listed per resource; all values are parameterized.

## Phase 2 workflows

| Path | Methods | Permission |
| --- | --- | --- |
| `/classrooms` | `GET`, `POST`, `PATCH /:id` | `classrooms.read`, `classrooms.manage` |
| `/sections` | `GET`, `POST`, `PATCH /:id` | `sections.read`, `sections.manage` |
| `/course-assignments` | `GET`, `POST`, `PATCH /:id` | `course-assignments.read`, `course-assignments.manage` |
| `/enrollments` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` (withdraw) | `enrollments.read`, `enrollments.create`, `enrollments.manage` |
| `/timetable` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` | `timetable.read`, `timetable.manage` |
| `/attendance` | `GET`, `GET /mine`, `GET /roster`, `GET /report`, `POST /sessions` | `attendance.view`, `attendance.manage` |
| `/exams` | `GET`, `POST`, `POST /:id/publish`, `PUT /:id/results` | `exams.view`, `exams.create`, `exams.manage`, `grades.manage` |
| `/grades` | `GET`, `GET /scale`, `POST /scale`, `PATCH /scale/:id` | `grades.view`, `grades.manage` |
| `/gpa/:studentId`, `/gpa/me` | `GET` | `grades.view` |
| `/fees` | `GET`, `POST`; `/fees/structures` `GET`, `POST` | `fees.view`, `fees.manage` |
| `/payments` | `GET`, `POST`; `/receipts/:id` `GET` | `payments.view`, `payments.create` |
| `/invoices` | `GET`, `GET /:id` | `invoices.view` |
| `/documents` | `GET`, `POST` | `documents.view`, `documents.manage` |
| `/faculty-workload` | `GET` | `workload.view` |
| `/reports/:type` | `GET` | `reports.view` |

Phase 2 collection endpoints accept `page` and `limit` (maximum 100). Relevant
filters include academic session, program, department, semester, section, date
range, status, and assigned course. Timetable `day_of_week` uses ISO numbering
(Monday=1 through Sunday=7), and uses 24-hour `HH:MM` values.

Attendance roster requests use
`GET /attendance/roster?course_assignment_id=...&date=YYYY-MM-DD`. Marking uses
`POST /attendance/sessions` with `course_assignment_id`, `attendance_date`, and
`records` containing each `student_id`, status, and optional note. Exam results
are submitted as `PUT /exams/:id/results` with a `results` array of
`student_id` and `marks_obtained`; the server calculates percentage, letter
grade, and grade point from the active grade scale.

`POST /fees` accepts either a matching `fee_structure_id` or manual
`fee_type`/`total_amount`/`due_date` values. Discounts, scholarships, late
fees, paid amounts, balances, and statuses are calculated or validated by the
server. Non-cash payments require a unique transaction reference.
`GET /reports/:type` supports `enrollment`, `attendance`, `exam-performance`,
`gpa`, `fees`, `outstanding-balances`, and `faculty-workload`.

Faculty attendance and grade operations are checked against the faculty record
linked to the authenticated user and the assigned course. Student academic and
financial reads are scoped to the student's linked record; published grades
and final results only are exposed to students. GPA uses credit-hour-weighted
published final-exam grade points; the API does not accept client GPA values.
Payment writes lock the fee row, reject amounts above the outstanding balance,
and update the fee, invoice, receipt, and audit event in one transaction.
Receipt and invoice responses contain printable institutional and transaction
fields only and never return document storage keys or database connection data.

The document API currently stores metadata only. Integrations should write
objects through an external storage adapter and persist the provider and opaque
storage key; no local-filesystem path or storage key is exposed by read APIs.

## Authorization

Every protected endpoint authenticates against the current active database user
and loads that user's role permissions. Resource operations require
`resource.read`, `resource.create`, `resource.update`, or `resource.delete`;
user, settings, dashboard, notification, and audit routes have their own
permissions. `SUPER_ADMIN` is the only built-in permission bypass. Permission
assignments are stored in `roles`, `permissions`, and `role_permissions`.
Development seeding adds Phase 2 permissions to administrator, faculty,
student, and accountant roles. Accountant grants are limited to fees, payments,
invoices, and financial reports; they do not include institutional settings.
Student and faculty demo roles no longer receive the unscoped `students.read`
permission. Their Phase 2 records are accessed through server-scoped workflows.

`DELETE /users/:id` deactivates the account. The service prevents deactivating
or reassigning the final active `SUPER_ADMIN`.

## Phase 3 operations

| Path | Methods | Permission / scope |
| --- | --- | --- |
| `/library/categories`, `/library/books`, `/library/copies`, `/library/members` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Matching `library.<resource>.<action>` permissions |
| `/library/search`, `/library/availability` | `GET` | `library.books.read` |
| `/library/loans` | `GET`, `POST`; `POST /:id/return`, `POST /:id/renew` | `library.loans.read/create/update` |
| `/library/fines`, `/library/fines/overdue` | `GET` | `library.fines.read` |
| `/announcements` | `GET`, `POST`; `GET /:id`; `POST /:id/publish` | `announcements.read/create/publish`; recipient-scoped reads |
| `/search?q=...&limit=...` | `GET` | `search.read`; records are independently filtered to the caller's role |
| `/activity/:entityType/:entityId` | `GET` | `activity.read` plus record-level authorization |
| `/imports/:entity` | `POST` (`text/csv`) | `imports.run`; entity is students, faculty, or courses |
| `/exports/:report` | `GET` | `exports.run`; report is students, attendance, exam-results, fees, or payments |

Password reset links expire after 30 minutes, are single-use, and persist only a
SHA-256 token hash. Configure `EMAIL_API_URL` and `EMAIL_API_KEY` together; the
mail gateway receives `{ "to", "subject", "text" }` as JSON. If delivery is not
configured or fails, reset requests remain generic and the token is invalidated.
CSV imports are capped at 2 MB and 1,000 rows, process rows with savepoints, and
return row-level errors. CSV exports are capped at 50,000 rows and neutralize
spreadsheet formula cells.

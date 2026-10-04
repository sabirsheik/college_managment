# PostgreSQL data model

Create the local database `college_management`, set `DATABASE_URL` in the
ignored `backend/.env`, then run `npm run db:migrate` from `backend/`. Migrations
are ordered SQL files under `database/migrations`; applied migration names are
recorded in `schema_migrations`. `npm run db:seed` loads development roles,
permissions, sample accounts, and fictional academic data. Seeding requires
`SEED_USERS_PASSWORD` in the environment and never embeds a password.

## Tables and relationships

- `users` reference `roles`; `role_permissions` link roles and permissions.
- `college_settings` is a single institution settings row.
- `departments` have optional faculty heads.
- `programs` belong to departments.
- `academic_sessions` use a partial unique index to allow only one current
  session; date overlap is checked transactionally by the service.
- `students` belong to departments and may reference a program, session, and
  user. Registration/student IDs are unique.
- `faculty` belong to departments and may reference a user. Employee IDs are
  unique.
- `courses` belong to a department and program and may reference an instructor.
- `enrollments` reference students and courses and retain the initial MVP
  fields for compatibility.
- `notifications` belong to a user. `audit_logs` record actor, action, entity,
  safe metadata, client IP, user agent, and timestamp.

Institution records use PostgreSQL integer `SERIAL` IDs, foreign keys,
`TIMESTAMPTZ` timestamps, unique constraints, and checks for status and numeric
ranges. Indexes cover role/status, lookup identifiers, common relationship
filters, current sessions, audit chronology, and per-user unread notifications.

The second migration adds the Phase 1 schema to the original MVP schema without
rewriting existing rows. Legacy fields remain for compatibility with the first
MVP data.

The third migration adds Phase 2 workflow data:

- `classrooms` are unique by case-insensitive building and room number.
- `sections` bind a program, academic session, semester, and section name.
  Students reference matching section/program/session/semester values through
  a composite foreign key; section capacity is checked when a student is
  assigned.
- `course_assignments` bind a faculty member, course, section, program, session,
  and semester. A course can be assigned only once to a section in a given
  session and semester.
- `enrollments` retain the legacy fields and gain numeric semester, session,
  and enrollment date fields. A partial unique index prevents duplicate
  student/course/session/semester enrollments; the legacy uniqueness constraint
  that omitted the academic session is removed so the same course may be taken
  again in a later session.
- `timetable` references course assignments and rooms. API writes serialize
  schedule conflict checks with a transaction-scoped advisory lock and reject
  overlapping faculty, section, or room bookings.
- `attendance_sessions` and `attendance_records` capture class-day attendance,
  with one record per student and session.
- `exams`, `exam_results`, and `grade_scales` hold assessment and configurable
  grade data. A database trigger checks marks, percentage, letter grade, and
  grade point against the exam maximum and active scale.
- `fee_structures`, `student_fees`, `payments`, and `invoices` track assessed
  balances and payments. Check constraints enforce non-negative amounts and
  exact paid/remaining balances; payment transactions lock the fee record and
  create a unique receipt number.
- `student_documents` holds provider-neutral metadata (provider and opaque
  storage key), not file contents or public storage URLs.

Phase 2 API mutations write audit events in the same transaction where the
operation has multi-row or financial effects. Database-backed integration
tests require a configured PostgreSQL `DATABASE_URL`.

The fourth migration adds library categories, book titles and copies, members,
circulation loans, fine accrual fields, and librarian permissions. Active-copy
uniqueness is enforced by a partial index; write operations lock the relevant
member, copy, or loan row before applying circulation rules.

The fifth migration adds targeted announcement records, resolved recipients,
and a notification link for each delivery. Recipient rows and their generated
notifications are committed with publication as a single transaction.

The sixth migration adds single-use password-reset token hashes and database
triggers that reject audit-log updates, deletes, and truncation. Migrations run
in independent transactions protected by a PostgreSQL advisory lock; applied
migrations are forward-only.

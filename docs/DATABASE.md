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
- `enrollments` reference students and courses and retain the original
  student/course/semester uniqueness constraint.
- `notifications` belong to a user. `audit_logs` record actor, action, entity,
  safe metadata, client IP, user agent, and timestamp.

Institution records use PostgreSQL integer `SERIAL` IDs, foreign keys,
`TIMESTAMPTZ` timestamps, unique constraints, and checks for status and numeric
ranges. Indexes cover role/status, lookup identifiers, common relationship
filters, current sessions, audit chronology, and per-user unread notifications.

The second migration adds the Phase 1 schema to the original MVP schema without
rewriting existing rows. Legacy fields remain for compatibility with the first
MVP data.

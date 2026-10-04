# Campus College Management

College management platform with secure Phase 1 and Phase 2 foundations plus
Phase 3 operational workflows. The application includes session
authentication, database-backed RBAC, academic records and schedules,
attendance, exams and grades, GPA, student finances, documents, reports,
notifications, audit events, and a responsive administrative workspace.

## Technology

- React 18, Vite, React Router
- Node.js 20+, Express 4, PostgreSQL, `pg`
- JWT in an HTTP-only cookie, bcrypt password hashing
- Helmet, CORS allow-list, sign-in rate limiting, Pino request logging

## Local setup

1. Install Node.js 20+ and PostgreSQL. Create the `college_management` database.
2. Install the backend and frontend dependencies once:

```powershell
npm --prefix backend install
npm --prefix frontend install
```

3. Start both apps and prepare the local database with one command, from the
   project root or from `backend/`:

```powershell
npm run dev
```

If `DATABASE_URL` is missing or still has the sample placeholder, enter the
local PostgreSQL connection URL when prompted. The launcher saves it and
generated development-only auth/seed values in the Git-ignored root `.env`,
applies migrations, seeds demo roles/accounts, and starts both the API and
frontend. An existing value in `.env` is loaded automatically. Later starts
need only `npm run dev`. The launcher refuses production mode and non-local
databases to avoid seeding a remote/production database. For a custom existing
configuration, set values in `backend/.env` or root `.env` before starting.

The frontend is at <http://localhost:5173>, the API at
<http://localhost:5000>, and the health check (including PostgreSQL connectivity) at
<http://localhost:5000/api/v1/health>. The frontend defaults to this local API; set
`VITE_API_URL` to override its base URL.

Development seed accounts (all use the generated `SEED_USERS_PASSWORD` value
stored in your ignored `.env`):

- `admin@example.edu` — `SUPER_ADMIN`
- `manager@example.edu` — `ADMIN`
- `faculty@example.edu` — `FACULTY`
- `student@example.edu` — `STUDENT`
- `accounts@example.edu` — `ACCOUNTANT`
- `library@example.edu` — `LIBRARIAN`

Seed identities and academic records are fictitious. Never reuse development
credentials or seed data in production.

## Phase 1 modules

- Login, logout, current-user session, password change
- Users with role assignment, filtering, pagination, activation, and password reset
- Roles and permission tables with server-side permission enforcement
- College settings, departments, academic sessions, programs, students, faculty,
  and courses
- Dashboard summary, per-user notifications, and restricted audit log
- Search, filters, sorting, pagination, validation, empty/loading/error states,
  and student/faculty profiles

## Phase 2 workflows

- Classrooms, academic sections, course assignments, course enrollment, and
  conflict-checked weekly timetables
- Attendance sessions and records, faculty assignment checks, student-owned
  attendance views, and administrative reports
- Exams, configurable percentage-based grade scales, server-calculated marks
  and grades, published final-grade GPA/CGPA summaries
- Program/session/semester fee structures, student fee balances, transactional
  payments, unique receipts, printable invoices and receipts
- Student document metadata with provider-neutral storage keys, faculty
  workload, and filtered academic reports
- Role-specific Phase 2 permissions; student academic and financial API reads
  are scoped to the signed-in student's linked record

Apply all database migrations (including `003_phase_two.sql`) before starting
the Phase 2 API. Existing MVP enrollment rows are retained; only newly created
Phase 2 enrollments include the academic session and numeric semester used for
duplicate prevention and reporting.

## Phase 3 operations

- Dedicated student, faculty, accountant, and librarian portals, with a scoped
  administrator dashboard, financial/attendance summaries, and monthly trends
- Search across role-authorized records, targeted announcements, and library
  catalogue/circulation management
- Validated CSV exchange, password recovery through a configured mail gateway,
  request IDs, structured logging, rate limits, and stricter production config
- Additive migrations serialize through a PostgreSQL advisory lock. Apply
  migrations in the deployment pipeline before starting API instances.

For the security model, OpenAPI contract, supported configuration, deployment,
backup, recovery, and incident procedures, see [operations](docs/OPERATIONS.md),
[OpenAPI](docs/openapi.yaml), [API](docs/API.md), [database](docs/DATABASE.md),
and [architecture](docs/ARCHITECTURE.md).

## Tests and builds

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

Database integration requires a running PostgreSQL server and configured
`DATABASE_URL`. Authentication is enabled by default; there is no public CRUD
mode. Database-backed workflows cannot be verified without a configured
PostgreSQL test database.

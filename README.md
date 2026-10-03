# Campus College Management

Phase 1 foundation for a secure, multi-role college administration platform.
The application includes session authentication, database-backed RBAC, academic
records, institutional settings, notifications, audit events, and a responsive
administrative workspace.

## Technology

- React 18, Vite, React Router
- Node.js 20+, Express 4, PostgreSQL, `pg`
- JWT in an HTTP-only cookie, bcrypt password hashing
- Helmet, CORS allow-list, sign-in rate limiting, Pino request logging

## Local setup

1. Install Node.js 20+ and PostgreSQL. Create the `college_management` database.
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `DATABASE_URL` in that ignored local file to the connection string for
   your PostgreSQL instance. Do not put database credentials in source files.
4. Generate a private JWT secret (for example,
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   and set `JWT_SECRET`. Set `SEED_USERS_PASSWORD` to a private development
   password of at least 12 characters; it is shared by the fake seed accounts.
5. Install dependencies, migrate/seed, then start the backend and frontend.

```powershell
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend is at <http://localhost:5173>, the API at
<http://localhost:5000>, and the health check (including PostgreSQL connectivity) at
<http://localhost:5000/api/v1/health>. The backend reads environment values
from `backend/.env`. The frontend defaults to this local API; set
`VITE_API_URL` to override its base URL.

Development seed accounts (all use the `SEED_USERS_PASSWORD` value from your
local environment):

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

## Tests and builds

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

Database integration requires a running PostgreSQL server and configured
`DATABASE_URL`. Authentication is enabled by default; there is no public CRUD
mode. Before production use, configure TLS/secure cookies, backups, deployment
secrets, email delivery, operational monitoring, and a reviewed permission
matrix.

Further documentation: [API](docs/API.md), [database](docs/DATABASE.md), and
[architecture](docs/ARCHITECTURE.md).

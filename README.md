# College Management System

A full-stack starter application for managing students, faculty, departments,
courses, and enrollments.

## Requirements

- Node.js 20 or later
- PostgreSQL 14 or later

## Setup

1. Create a PostgreSQL database named `college_management`.
2. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.
3. Install dependencies in `backend` and `frontend`.
4. Run the database migration and optional demo seed from `backend`.
5. Start the API and frontend in separate terminals.

```powershell
Copy-Item .env.example .env
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

The frontend runs at <http://localhost:5173>; the API health endpoint is
<http://localhost:4000/api/health>.

## Features

- Dashboard counts and recent enrollment activity
- Create, view, update, and delete departments, students, faculty, courses,
  and enrollments
- PostgreSQL foreign keys and unique enrollment constraints
- API-side input validation and parameterized database queries

The starter does not include authentication or role-based access control.
Protect the API before deploying it to a public network.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/API.md](docs/API.md), and [docs/DATABASE.md](docs/DATABASE.md).

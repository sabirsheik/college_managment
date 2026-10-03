# Architecture

- `frontend/` is a React single-page application built with Vite.
- `backend/` is an Express API. Routes validate resource names, controllers
  orchestrate requests, services hold resource rules, and repositories issue
  parameterized PostgreSQL queries.
- `database/` contains the versioned schema migration and optional demo seed.
- The frontend uses `VITE_API_URL` to select the API origin; by default it
  calls `http://localhost:4000/api`.

The API is intentionally unauthenticated for local development. Add
authentication, authorization, and production deployment configuration before
handling real student records.

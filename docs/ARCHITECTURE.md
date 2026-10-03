# Architecture

## Runtime

- `frontend/` is a Vite-powered React SPA. React Router separates login,
  protected application routes, and permission-aware modules. A centralized
  fetch client sends HTTP-only cookie credentials and normalizes API errors.
- `backend/` is an Express REST API mounted at `/api/v1`. The dependency flow is
  Route → Controller → Service → Repository → PostgreSQL. Controllers format
  responses; services enforce domain rules; repositories use parameterized SQL.
- `database/migrations/` holds additive, ordered SQL migrations. The migration
  runner records each successful migration in `schema_migrations`.

## Authentication and permissions

Passwords are hashed with bcrypt. Login issues a signed JWT in an HTTP-only,
SameSite=Lax cookie; JavaScript cannot read or persist the token. Authentication
reloads the active user, role, and permission names from PostgreSQL on each API
request, so deactivation and permission changes take effect on the next request.
The API uses a strict frontend origin allow-list, Helmet security headers,
request-size limits, and sign-in rate limiting.

Roles are data, not frontend assumptions. `roles`, `permissions`, and
`role_permissions` are the authorization source; `requirePermission` guards the
server routes. The UI uses the session permission list only to shape navigation
and affordances—the server remains authoritative.

## Reliability and security

Resource names, writable fields, filters, and sorting are allow-listed. SQL
values use placeholders. Academic session date overlap checks run under a
transaction-scoped advisory lock; the database enforces one current session.
User role changes/deactivation serialize the final-active-super-admin check.
Audit records track sign-in, sign-out, and administrative mutations. Structured
request logs omit query strings and sensitive request bodies.

Phase 1 uses integer `SERIAL` identifiers consistently for institution records,
with `TIMESTAMPTZ` creation/update times and PostgreSQL foreign keys. Profile
image and logo fields currently accept HTTPS/HTTP URLs; managed file uploads
belong in a later storage integration.

## Extension points

Add new modules by defining migration constraints/indexes, resource field
validation and repository allow-lists, a service/controller/route with explicit
permissions, and a frontend resource/page definition. Prefer domain-specific
services whenever a workflow spans multiple records or needs transactional
invariants.

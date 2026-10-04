# Operations and deployment

## Configuration and secrets

Use separate, secret-managed configuration for development, staging, and
production. Do not commit `.env` files or place credentials in build artifacts.
Required values are `DATABASE_URL`, `JWT_SECRET` (at least 32 characters),
`FRONTEND_URL`, and production `COOKIE_SECURE=true` and `DATABASE_SSL=true`.
Use `DATABASE_SSL_CA` only when the provider requires a custom CA bundle.
`TRUST_PROXY_HOPS` must equal the number of trusted proxies in front of the
API; never enable broad proxy trust on an internet-facing server.

Set `DATABASE_POOL_MAX` to a value that fits the database connection budget
across all API replicas, migration jobs, and other clients. The pool defaults
to 10 connections per process. Keep `statement_timeout`, request size, and
request timeout limits enabled. `EMAIL_API_URL` and `EMAIL_API_KEY` are an
optional pair for password reset delivery; use a trusted HTTPS gateway and
rotate its credential independently.

## Release and migration sequence

1. Build and test the frontend and backend from the release commit.
2. Back up the production database and verify that the backup job completed.
3. Run `npm run db:migrate` once as a deployment job, using the same release
   and database configuration as the API. PostgreSQL advisory locks serialize
   concurrent migration runners; do not use this as a substitute for a
   single controlled deployment job.
4. Start the API replicas and frontend release. Keep the previous application
   image available for rollback.
5. Check `/api/v1/health`, sign-in, and representative role-scoped reads.
6. Monitor errors and database health before completing the release.

Migrations are additive and recorded in `schema_migrations`. Treat applied
migrations as forward-only. Do not edit or rerun an applied migration to roll
back production data. Correct mistakes with a reviewed forward migration.
Application rollback is safe only when the previous version is compatible with
the already-applied schema. If data restoration is required, use the approved
point-in-time or snapshot restore procedure and record the recovery point.

## Backups and recovery

- Prefer the managed PostgreSQL provider's encrypted automated snapshots and
  point-in-time recovery. Define the recovery point objective (RPO) and recovery
  time objective (RTO) with the institution before launch.
- Keep backup retention aligned with institutional records policy and legal
  requirements. Restrict backup access separately from routine application
  credentials; encrypt exports and never place them in a public web directory.
- Perform a scheduled restore drill into an isolated database. Verify schema
  migrations, row counts, authentication, academic records, and financial
  totals before declaring the restore procedure usable.
- For an export-based recovery, use provider-approved `pg_dump`/`pg_restore`
  tooling, capture the database version and migration list, and preserve
  ownership/privilege handling in the recovery runbook.
- Record restore operator, source snapshot, target, timestamps, validation,
  and any data loss. Do not run tests or restore drills against production.

Audit logs are append-only through database triggers. Define a retention and
archival policy with the institution before production. Removal or archival
must be performed through a reviewed database-administrator process or a
dedicated migration, with a protected archive and documented approval; the
application role should not mutate audit history.

## Health, monitoring, and incident response

`GET /api/v1/health` reports service and database availability without exposing
credentials or SQL details; a failed database check returns HTTP 503. Monitor
availability, latency, HTTP 5xx/429 counts, pool saturation, PostgreSQL
storage/connections, backup completion, and migration outcomes. Use request IDs
to correlate sanitized structured API logs. Logs omit query strings and
request bodies; access logs and retained audit records still require restricted
access and a documented retention period.

Configure alerts for sustained health failures, elevated errors, exhausted
database connections, failed backups, and unusual authentication throttling.
On suspected credential exposure, rotate the affected secret, revoke active
sessions by incrementing user token versions or deactivating the account, and
review audit and provider logs. Preserve incident evidence under the
institution's response policy.

## Production checklist

- [ ] HTTPS for the frontend and API; secure, HTTP-only, SameSite cookies.
- [ ] Exact `FRONTEND_URL`, restrictive network access, managed database TLS.
- [ ] Unique, rotated production secrets; no development seed accounts or
  `SEED_USERS_PASSWORD` in the production environment.
- [ ] Reviewed least-privilege database role and role/permission grants.
- [ ] Email reset delivery tested with a non-production account and provider.
- [ ] Backup/restore drill, RPO/RTO, and audit retention approved.
- [ ] Health checks, request-ID log access, rate-limit and error alerts tested.
- [ ] Dependency and security review, database integration tests, and a release
  rollback plan completed.

This repository does not include infrastructure-as-code, payment-gateway
integration, managed object-storage provisioning, or a specific cloud provider
deployment. Configure those through institution-approved infrastructure and
provider controls rather than embedding provider credentials in the app.

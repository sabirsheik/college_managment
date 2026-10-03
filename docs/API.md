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

## Authorization

Every protected endpoint authenticates against the current active database user
and loads that user's role permissions. Resource operations require
`resource.read`, `resource.create`, `resource.update`, or `resource.delete`;
user, settings, dashboard, notification, and audit routes have their own
permissions. `SUPER_ADMIN` is the only built-in permission bypass. Permission
assignments are stored in `roles`, `permissions`, and `role_permissions`.

`DELETE /users/:id` deactivates the account. The service prevents deactivating
or reassigning the final active `SUPER_ADMIN`.

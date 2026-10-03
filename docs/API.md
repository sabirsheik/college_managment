# API

Base URL: `http://localhost:4000/api`

## Endpoints

- `GET /health` — API status
- `GET /dashboard` — aggregate totals and latest enrollments
- `GET /:resource` — list records
- `POST /:resource` — create a record
- `GET /:resource/:id` — read one record
- `PUT /:resource/:id` — replace editable fields
- `DELETE /:resource/:id` — delete a record

Supported resources are `students`, `faculty`, `departments`, `courses`, and
`enrollments`. Send and receive JSON. Invalid input returns `400`, missing
records return `404`, and database constraint violations return `409`.

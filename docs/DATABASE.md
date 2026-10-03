# Database

The PostgreSQL schema is defined in
`database/migrations/001_initial_schema.sql`. Apply it with
`npm run db:migrate` from `backend`. The optional demo records are in
`database/seeds/001_demo.sql` and can be loaded with `npm run db:seed`.

Departments are referenced by students, faculty, and courses. Enrollments
reference students and courses and are unique per student, course, and
semester. Deleting referenced records is restricted by foreign keys.

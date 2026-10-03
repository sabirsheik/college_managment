import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const roleNames = ['SUPER_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN'];
const resourceNames = [
  'users', 'departments', 'academic-sessions', 'programs', 'students', 'faculty', 'courses', 'enrollments'
];
const permissions = [
  'dashboard.read', 'college-settings.read', 'college-settings.update',
  'notifications.read', 'audit-logs.read', 'roles.read',
  ...resourceNames.flatMap((resource) =>
    (resource === 'users' ? ['read', 'create', 'update', 'delete', 'reset-password'] :
      ['read', 'create', 'update', 'delete']).map((action) => `${resource}.${action}`)
  )
];
const limited = [
  'dashboard.read', 'notifications.read', 'students.read', 'faculty.read',
  'departments.read', 'academic-sessions.read', 'programs.read', 'courses.read'
];
const demoUsers = [
  ['admin@example.edu', 'Avery', 'Administrator', 'SUPER_ADMIN'],
  ['manager@example.edu', 'Morgan', 'Manager', 'ADMIN'],
  ['faculty@example.edu', 'Riley', 'Faculty', 'FACULTY'],
  ['student@example.edu', 'Casey', 'Student', 'STUDENT'],
  ['accounts@example.edu', 'Taylor', 'Accountant', 'ACCOUNTANT'],
  ['library@example.edu', 'Quinn', 'Librarian', 'LIBRARIAN']
];

const password = process.env.SEED_USERS_PASSWORD;
if (!password || password.length < 12) {
  throw new Error('Set SEED_USERS_PASSWORD to a development-only password of at least 12 characters.');
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const role of roleNames) {
    await client.query(
      'INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [role]
    );
  }
  for (const name of permissions) {
    await client.query(
      'INSERT INTO permissions (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
  }
  const allPermissions = await client.query('SELECT id, name FROM permissions');
  const roles = await client.query('SELECT id, name FROM roles');
  for (const role of roles.rows) {
    const allowed = role.name === 'SUPER_ADMIN' || role.name === 'ADMIN'
      ? allPermissions.rows.map((permission) => permission.id)
      : allPermissions.rows
        .filter((permission) => limited.includes(permission.name))
        .map((permission) => permission.id);
    for (const permissionId of allowed) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [role.id, permissionId]
      );
    }
  }

  for (const [email, firstName, lastName, role] of demoUsers) {
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
       SELECT $1, $2, $3, $4, id FROM roles WHERE name = $5
       ON CONFLICT DO NOTHING`,
      [email, hash, firstName, lastName, role]
    );
  }

  await client.query(`
    INSERT INTO college_settings (id, college_name, city, country, timezone, currency)
    VALUES (1, 'Northstar College', 'Example City', 'Example Country', 'UTC', 'USD')
    ON CONFLICT (id) DO UPDATE SET
      college_name = EXCLUDED.college_name,
      city = EXCLUDED.city,
      country = EXCLUDED.country
    WHERE college_settings.college_name = 'College'
  `);
  await client.query(`
    INSERT INTO departments (name, code, description, status) VALUES
      ('Computer Science', 'CS', 'Computing and information sciences', 'ACTIVE'),
      ('Business Administration', 'BUS', 'Business and management studies', 'ACTIVE'),
      ('Applied Sciences', 'SCI', 'Applied science programs', 'ACTIVE')
    ON CONFLICT (code) DO NOTHING
  `);
  await client.query(`
    INSERT INTO academic_sessions (name, start_date, end_date, is_current, status)
    SELECT '2026-2027', '2026-09-01', '2027-06-30', TRUE, 'ACTIVE'
    WHERE NOT EXISTS (SELECT 1 FROM academic_sessions WHERE is_current)
    ON CONFLICT (name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO programs (department_id, name, code, degree_level, duration_years, status)
    SELECT d.id, 'Bachelor of Computer Science', 'BSCS', 'Bachelor', 4, 'ACTIVE'
    FROM departments d WHERE d.code = 'CS'
    ON CONFLICT (code) DO NOTHING
  `);

  const facultyUser = await client.query("SELECT id FROM users WHERE email = 'faculty@example.edu'");
  const studentUser = await client.query("SELECT id FROM users WHERE email = 'student@example.edu'");
  await client.query(`
    INSERT INTO faculty
      (employee_id, first_name, last_name, email, department_id, user_id,
       designation, qualification, employment_status)
    SELECT 'EMP-DEMO-001', 'Riley', 'Faculty', 'faculty@example.edu', d.id, $1,
      'Lecturer', 'MSc', 'ACTIVE'
    FROM departments d WHERE d.code = 'CS'
    ON CONFLICT (email) DO NOTHING
  `, [facultyUser.rows[0]?.id ?? null]);
  await client.query(`
    INSERT INTO students
      (student_id, student_number, registration_number, first_name, last_name, email,
       department_id, program_id, academic_session_id, enrollment_year, admission_date,
       semester, status, user_id)
    SELECT 'STU-DEMO-001', 'STU-DEMO-001', 'REG-DEMO-001', 'Casey', 'Student',
      'student@example.edu', d.id, p.id, a.id, 2026, '2026-09-01', 1, 'ACTIVE', $1
    FROM departments d
    JOIN programs p ON p.code = 'BSCS'
    JOIN academic_sessions a ON a.name = '2026-2027'
    WHERE d.code = 'CS'
    ON CONFLICT (student_number) DO NOTHING
  `, [studentUser.rows[0]?.id ?? null]);
  await client.query(`
    INSERT INTO courses (code, course_code, title, name, credits, credit_hours,
      department_id, program_id, semester, status)
    SELECT 'CS-101', 'CS-101', 'Introduction to Computing',
      'Introduction to Computing', 3, 3, d.id, p.id, 1, 'ACTIVE'
    FROM departments d JOIN programs p ON p.code = 'BSCS'
    WHERE d.code = 'CS'
    ON CONFLICT (code) DO NOTHING
  `);
  await client.query(`
    INSERT INTO enrollments (student_id, course_id, semester, status)
    SELECT s.id, c.id, 'Fall 2026', 'enrolled'
    FROM students s CROSS JOIN courses c
    WHERE s.registration_number = 'REG-DEMO-001' AND c.course_code = 'CS-101'
    ON CONFLICT (student_id, course_id, semester) DO NOTHING
  `);
  await client.query('COMMIT');
  console.log('Development roles, permissions, accounts, and sample academic records are ready.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

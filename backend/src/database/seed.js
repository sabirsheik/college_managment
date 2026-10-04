import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';

const roleNames = ['SUPER_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN'];
const resourceNames = [
  'users', 'departments', 'academic-sessions', 'programs', 'students', 'faculty', 'courses', 'enrollments'
];
const permissions = [
  'dashboard.read', 'college-settings.read', 'college-settings.update',
  'notifications.read', 'audit-logs.read', 'roles.read',
  'classrooms.read', 'classrooms.manage', 'sections.read', 'sections.manage',
  'course-assignments.read', 'course-assignments.manage', 'enrollments.manage',
  'timetable.read', 'timetable.manage',
  'imports.run', 'exports.run',
  'attendance.view', 'attendance.manage', 'exams.view', 'exams.create', 'exams.manage',
  'grades.view', 'grades.manage', 'fees.view', 'fees.manage', 'payments.view',
  'payments.create', 'invoices.view', 'documents.view', 'documents.manage',
  'workload.view', 'reports.view',
  ...resourceNames.flatMap((resource) =>
    (resource === 'users' ? ['read', 'create', 'update', 'delete', 'reset-password'] :
      ['read', 'create', 'update', 'delete']).map((action) => `${resource}.${action}`)
  )
];
const limited = [
  'dashboard.read', 'notifications.read', 'students.read', 'faculty.read',
  'departments.read', 'academic-sessions.read', 'programs.read', 'courses.read'
];
const facultyPermissions = [
  'classrooms.read', 'sections.read', 'course-assignments.read', 'enrollments.read',
  'timetable.read', 'attendance.view', 'attendance.manage', 'exams.view',
  'exams.create', 'exams.manage', 'grades.view', 'grades.manage', 'workload.view',
  'reports.view', 'exports.run'
];
const studentPermissions = [
  'classrooms.read', 'sections.read', 'course-assignments.read', 'enrollments.read',
  'enrollments.create', 'timetable.read', 'attendance.view', 'exams.view',
  'grades.view', 'fees.view', 'payments.view', 'payments.create', 'invoices.view',
  'documents.view'
];
const accountantPermissions = [
  'fees.view', 'fees.manage', 'payments.view', 'payments.create', 'invoices.view',
  'reports.view', 'exports.run'
];
const libraryPermissions = [
  'library.categories.read', 'library.categories.create', 'library.categories.update', 'library.categories.delete',
  'library.books.read', 'library.books.create', 'library.books.update', 'library.books.delete',
  'library.copies.read', 'library.copies.create', 'library.copies.update', 'library.copies.delete',
  'library.members.read', 'library.members.create', 'library.members.update', 'library.members.delete',
  'library.loans.read', 'library.loans.create', 'library.loans.update', 'library.fines.read'
];
const librarianPermissions = [...libraryPermissions];
const bootstrapUsers = [
  ['admin@example.edu', 'College', 'Administrator', 'SUPER_ADMIN']
];

const password = process.env.SEED_USERS_PASSWORD;
if (process.env.NODE_ENV === 'production') {
  throw new Error('The development seed must never run in production.');
}
assertStrongPassword(password, 'SEED_USERS_PASSWORD');

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
    if (!roleNames.includes(role.name)) continue;
    const shared = [
      'dashboard.read', 'notifications.read', 'search.read', 'activity.read', 'announcements.read'
    ];
    const roleSpecific = role.name === 'SUPER_ADMIN' || role.name === 'ADMIN'
      ? allPermissions.rows.map((permission) => permission.id)
      : role.name === 'FACULTY'
        ? allPermissions.rows.filter((permission) =>
          [...shared, ...limited.filter((name) => name !== 'students.read'), ...facultyPermissions].includes(permission.name)
        ).map((permission) => permission.id)
        : role.name === 'STUDENT'
          ? allPermissions.rows.filter((permission) =>
            [...shared, ...studentPermissions].includes(permission.name)
          ).map((permission) => permission.id)
          : role.name === 'ACCOUNTANT'
            ? allPermissions.rows.filter((permission) =>
              [...shared, ...accountantPermissions].includes(permission.name)
            ).map((permission) => permission.id)
            : role.name === 'LIBRARIAN'
              ? allPermissions.rows.filter((permission) =>
                [...shared, ...librarianPermissions].includes(permission.name)
              ).map((permission) => permission.id)
              : [];
    await client.query(
      'DELETE FROM role_permissions WHERE role_id=$1 AND NOT (permission_id=ANY($2::int[]))',
      [role.id, roleSpecific]
    );
    for (const permissionId of roleSpecific) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [role.id, permissionId]
      );
    }
  }

  for (const [email, firstName, lastName, role] of bootstrapUsers) {
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
       SELECT $1, $2, $3, $4, id FROM roles WHERE name = $5
       ON CONFLICT DO NOTHING`,
      [email, hash, firstName, lastName, role]
    );
  }

  await client.query('COMMIT');
  console.log('Development roles, permissions, and administrator account are ready.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

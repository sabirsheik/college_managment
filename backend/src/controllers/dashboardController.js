import { pool } from '../config/database.js';

export async function getDashboard(req, res) {
  const [
    students, faculty, departments, programs, courses, currentSession,
    recentStudents, recentFaculty, recentActivity, notifications
  ] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM students WHERE status = $1', ['ACTIVE']),
    pool.query('SELECT COUNT(*)::int AS count FROM faculty WHERE employment_status = $1', ['ACTIVE']),
    pool.query('SELECT COUNT(*)::int AS count FROM departments WHERE status = $1', ['ACTIVE']),
    pool.query('SELECT COUNT(*)::int AS count FROM programs WHERE status = $1', ['ACTIVE']),
    pool.query('SELECT COUNT(*)::int AS count FROM courses WHERE status = $1', ['ACTIVE']),
    pool.query('SELECT id, name, start_date, end_date FROM academic_sessions WHERE is_current = TRUE LIMIT 1'),
    req.user.permissions.includes('students.read') ? pool.query(
      `SELECT id, student_id, first_name, last_name, registration_number, created_at
       FROM students ORDER BY created_at DESC, id DESC LIMIT 5`
    ) : Promise.resolve({ rows: [] }),
    req.user.permissions.includes('faculty.read') ? pool.query(
      `SELECT id, employee_id, first_name, last_name, designation, created_at
       FROM faculty ORDER BY created_at DESC, id DESC LIMIT 5`
    ) : Promise.resolve({ rows: [] }),
    pool.query(
      `SELECT id, action, entity_type, entity_id, created_at FROM audit_logs
       WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 8`,
      [req.user.id]
    ),
    pool.query(
      `SELECT id, title, message, type, created_at FROM notifications
       WHERE user_id = $1 AND NOT is_read ORDER BY created_at DESC LIMIT 5`,
      [req.user.id]
    )
  ]);
  res.json({
    success: true,
    message: 'Dashboard loaded successfully.',
    data: {
      totals: {
        students: students.rows[0].count,
        faculty: faculty.rows[0].count,
        departments: departments.rows[0].count,
        programs: programs.rows[0].count,
        courses: courses.rows[0].count
      },
      currentAcademicSession: currentSession.rows[0] || null,
      recentStudents: recentStudents.rows,
      recentFaculty: recentFaculty.rows,
      recentActivity: recentActivity.rows,
      notifications: notifications.rows
    }
  });
}

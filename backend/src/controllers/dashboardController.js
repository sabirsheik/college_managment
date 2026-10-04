import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';

async function personalNotifications(userId) {
  const result = await pool.query(
    `SELECT id, title, message, type, created_at FROM notifications
     WHERE user_id=$1 AND NOT is_read ORDER BY created_at DESC, id DESC LIMIT 5`,
    [userId]
  );
  return result.rows;
}

async function studentDashboard(req, res) {
  const studentResult = await pool.query(
    `SELECT s.id, s.registration_number, s.student_id, s.first_name, s.last_name,
      s.email, s.semester, p.name AS program_name, d.name AS department_name,
      sec.name AS section_name, a.name AS academic_session_name
     FROM students s LEFT JOIN programs p ON p.id=s.program_id
     LEFT JOIN departments d ON d.id=s.department_id
     LEFT JOIN sections sec ON sec.id=s.section_id
     LEFT JOIN academic_sessions a ON a.id=s.academic_session_id
     WHERE s.user_id=$1 AND s.status='ACTIVE'`,
    [req.user.id]
  );
  const student = studentResult.rows[0];
  if (!student) throw new HttpError(403, 'No active student record is linked to this account.');
  const [enrollments, attendance, exams, classes, fees, payments, notifications] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count FROM enrollments
       WHERE student_id=$1 AND status IN ('enrolled','completed')`,
      [student.id]
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE'))::int AS attended,
        COUNT(*) FILTER (WHERE ar.status <> 'EXCUSED')::int AS eligible
       FROM attendance_records ar WHERE ar.student_id=$1`,
      [student.id]
    ),
    pool.query(
      `SELECT e.id, e.name, e.exam_type, e.exam_date, c.course_code, c.name AS course_name
       FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
       JOIN courses c ON c.id=ca.course_id
       WHERE ca.section_id=$1 AND e.is_published AND e.exam_date >= CURRENT_DATE
       ORDER BY e.exam_date LIMIT 5`,
      [student.section_id]
    ),
    pool.query(
      `SELECT t.day_of_week, t.start_time, t.end_time, c.course_code, c.name AS course_name,
        r.building, r.room_number
       FROM timetable t JOIN course_assignments ca ON ca.id=t.course_assignment_id
       JOIN courses c ON c.id=ca.course_id JOIN classrooms r ON r.id=t.classroom_id
       JOIN academic_sessions a ON a.id=ca.academic_session_id
       WHERE ca.section_id=$1 AND ca.status='ACTIVE'
         AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
       ORDER BY t.day_of_week, t.start_time LIMIT 20`,
      [student.section_id]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS fees,
        COALESCE(SUM(remaining_amount),0)::numeric(12,2) AS outstanding,
        COUNT(*) FILTER (WHERE due_date<CURRENT_DATE AND remaining_amount>0)::int AS overdue
       FROM student_fees WHERE student_id=$1`,
      [student.id]
    ),
    pool.query(
      `SELECT id, receipt_number, amount, payment_method, payment_date
       FROM payments WHERE student_id=$1 ORDER BY payment_date DESC LIMIT 5`,
      [student.id]
    ),
    personalNotifications(req.user.id)
  ]);
  res.json({
    success: true, message: 'Student portal loaded.',
    data: {
      portalType: 'STUDENT', profile: student,
      totals: { enrolledCourses: enrollments.rows[0].count },
      attendance: {
        attended: attendance.rows[0].attended, eligible: attendance.rows[0].eligible,
        percentage: attendance.rows[0].eligible
          ? Number((100 * attendance.rows[0].attended / attendance.rows[0].eligible).toFixed(2))
          : null
      },
      upcomingExams: exams.rows, weeklyTimetable: classes.rows,
      feeBalance: fees.rows[0], recentPayments: payments.rows, notifications
    }
  });
}

async function facultyDashboard(req, res) {
  const facultyResult = await pool.query(
    `SELECT id, employee_id, first_name, last_name, designation, department_id
     FROM faculty WHERE user_id=$1 AND employment_status='ACTIVE'`,
    [req.user.id]
  );
  const faculty = facultyResult.rows[0];
  if (!faculty) throw new HttpError(403, 'No active faculty record is linked to this account.');
  const [assignments, classes, exams, notifications, teachingSummary] = await Promise.all([
    pool.query(
      `SELECT ca.id, c.course_code, c.name AS course_name, s.id AS section_id, s.name AS section_name,
        ca.semester, a.name AS academic_session_name
       FROM course_assignments ca JOIN courses c ON c.id=ca.course_id
       JOIN sections s ON s.id=ca.section_id JOIN academic_sessions a ON a.id=ca.academic_session_id
       WHERE ca.faculty_id=$1 AND ca.status='ACTIVE' ORDER BY a.start_date DESC, ca.semester, c.course_code LIMIT 100`,
      [faculty.id]
    ),
    pool.query(
      `SELECT t.day_of_week, t.start_time, t.end_time, c.course_code, c.name AS course_name,
        s.name AS section_name, r.building, r.room_number
       FROM timetable t JOIN course_assignments ca ON ca.id=t.course_assignment_id
       JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id
       JOIN classrooms r ON r.id=t.classroom_id JOIN academic_sessions a ON a.id=ca.academic_session_id
       WHERE ca.faculty_id=$1 AND ca.status='ACTIVE'
         AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
       ORDER BY t.day_of_week, t.start_time LIMIT 100`,
      [faculty.id]
    ),
    pool.query(
      `SELECT e.id, e.name, e.exam_type, e.exam_date, c.course_code, s.name AS section_name
       FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
       JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id
       WHERE ca.faculty_id=$1 AND ca.status='ACTIVE' AND e.exam_date>=CURRENT_DATE
       ORDER BY e.exam_date LIMIT 10`,
      [faculty.id]
    ),
    personalNotifications(req.user.id),
    pool.query(
      `SELECT COUNT(DISTINCT ca.id)::int AS assigned_courses,
        COUNT(DISTINCT ca.section_id)::int AS sections,
        COUNT(t.id)::int AS weekly_classes,
        COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time-t.start_time))/3600),0)::numeric(8,2)
          AS total_teaching_hours
       FROM course_assignments ca
       JOIN academic_sessions a ON a.id=ca.academic_session_id
       LEFT JOIN timetable t ON t.course_assignment_id=ca.id
         AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
       WHERE ca.faculty_id=$1 AND ca.status='ACTIVE'`,
      [faculty.id]
    )
  ]);
  res.json({
    success: true, message: 'Faculty portal loaded.',
    data: {
      portalType: 'FACULTY', profile: faculty,
      totals: {
        assignedCourses: teachingSummary.rows[0].assigned_courses,
        sections: teachingSummary.rows[0].sections,
        weeklyClasses: teachingSummary.rows[0].weekly_classes,
        totalTeachingHours: Number(teachingSummary.rows[0].total_teaching_hours)
      },
      assignments: assignments.rows, weeklyTimetable: classes.rows, upcomingExams: exams.rows, notifications
    }
  });
}

async function accountantDashboard(req, res) {
  const [balances, payments, recent] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(paid_amount),0)::numeric(14,2) AS collected,
        COALESCE(SUM(remaining_amount),0)::numeric(14,2) AS pending,
        COALESCE(SUM(remaining_amount) FILTER (WHERE due_date<CURRENT_DATE),0)::numeric(14,2) AS overdue
       FROM student_fees`,
      []
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2) AS amount
       FROM payments WHERE payment_date >= CURRENT_DATE`,
      []
    ),
    pool.query(
      `SELECT p.id, p.receipt_number, p.amount, p.payment_method, p.payment_date,
        s.registration_number, s.first_name || ' ' || s.last_name AS student_name
       FROM payments p JOIN students s ON s.id=p.student_id
       ORDER BY p.payment_date DESC LIMIT 10`,
      []
    )
  ]);
  res.json({
    success: true, message: 'Accountant portal loaded.',
    data: {
      portalType: 'ACCOUNTANT', financials: balances.rows[0],
      today: payments.rows[0], recentTransactions: recent.rows
    }
  });
}

async function librarianDashboard(req, res) {
  const [catalog, circulation, overdue, recent] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE is_active)::int AS active_titles,
        COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive_titles
       FROM library_books`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS active_loans FROM library_loans WHERE returned_at IS NULL`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS overdue_loans FROM library_loans
       WHERE returned_at IS NULL AND due_date < CURRENT_DATE`
    ),
    pool.query(
      `SELECT l.id, l.issued_at, l.due_date, m.member_code, m.full_name,
        b.title AS book_title, (l.returned_at IS NOT NULL) AS returned
       FROM library_loans l JOIN library_members m ON m.id=l.member_id
       JOIN library_copies cp ON cp.id=l.copy_id JOIN library_books b ON b.id=cp.book_id
       ORDER BY l.issued_at DESC, l.id DESC LIMIT 8`
    )
  ]);
  res.json({
    success: true, message: 'Librarian portal loaded.',
    data: {
      portalType: 'LIBRARIAN',
      totals: { ...catalog.rows[0], ...circulation.rows[0], ...overdue.rows[0] },
      recentLoans: recent.rows
    }
  });
}

export async function getDashboard(req, res) {
  if (req.user.role === 'STUDENT') return studentDashboard(req, res);
  if (req.user.role === 'FACULTY') return facultyDashboard(req, res);
  if (req.user.role === 'ACCOUNTANT') return accountantDashboard(req, res);
  if (req.user.role === 'LIBRARIAN') return librarianDashboard(req, res);
  const [
    students, faculty, departments, programs, courses, currentSession,
    recentStudents, recentFaculty, recentActivity, notifications,
    paymentsByMonth, enrollmentsByMonth, attendanceByStatus, feeSummary
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
    ),
    pool.query(
      `SELECT DATE_TRUNC('month', payment_date)::date AS month, SUM(amount)::numeric(14,2) AS amount
       FROM payments
       WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
       GROUP BY DATE_TRUNC('month', payment_date) ORDER BY month`
    ),
    pool.query(
      `SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*)::int AS count
       FROM students
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
       GROUP BY DATE_TRUNC('month', created_at) ORDER BY month`
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM attendance_records GROUP BY status ORDER BY status`
    ),
    pool.query(
      `SELECT COALESCE(SUM(paid_amount),0)::numeric(14,2) AS collected,
        COALESCE(SUM(remaining_amount),0)::numeric(14,2) AS outstanding
       FROM student_fees`
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
      notifications: notifications.rows,
      analytics: {
        paymentsByMonth: paymentsByMonth.rows,
        enrollmentsByMonth: enrollmentsByMonth.rows,
        attendanceByStatus: attendanceByStatus.rows,
        fees: feeSummary.rows[0]
      }
    }
  });
}

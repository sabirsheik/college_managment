import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

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
  'reports.view'
];
const studentPermissions = [
  'classrooms.read', 'sections.read', 'course-assignments.read', 'enrollments.read',
  'enrollments.create', 'timetable.read', 'attendance.view', 'exams.view',
  'grades.view', 'fees.view', 'payments.view', 'payments.create', 'invoices.view',
  'documents.view'
];
const accountantPermissions = [
  'fees.view', 'fees.manage', 'payments.view', 'payments.create', 'invoices.view',
  'reports.view'
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
    if (role.name === 'STUDENT' || role.name === 'FACULTY') {
      await client.query(
        `DELETE FROM role_permissions rp USING permissions p
         WHERE rp.permission_id=p.id AND rp.role_id=$1 AND p.name='students.read'`,
        [role.id]
      );
    }
    const rolePermissions = role.name === 'SUPER_ADMIN' || role.name === 'ADMIN'
      ? allPermissions.rows.map((permission) => permission.id)
      : allPermissions.rows.filter((permission) => {
        const roleSpecific = role.name === 'FACULTY' ? facultyPermissions
          : role.name === 'STUDENT' ? studentPermissions
            : role.name === 'ACCOUNTANT' ? accountantPermissions : [];
        const shared = role.name === 'STUDENT' ? ['dashboard.read', 'notifications.read']
          : role.name === 'FACULTY' ? limited.filter((name) => name !== 'students.read')
            : limited;
        return shared.includes(permission.name) || roleSpecific.includes(permission.name);
      }).map((permission) => permission.id);
    for (const permissionId of rolePermissions) {
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
  await client.query(`
    INSERT INTO classrooms (building, room_number, capacity, room_type, facilities, status)
    VALUES ('Main Building', '101', 40, 'CLASSROOM', ARRAY['Projector', 'Whiteboard'], 'ACTIVE')
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO sections (program_id, academic_session_id, semester, name, capacity, status)
    SELECT p.id, a.id, 1, 'A', 40, 'ACTIVE'
    FROM programs p CROSS JOIN academic_sessions a
    WHERE p.code='BSCS' AND a.name='2026-2027'
    ON CONFLICT (program_id, academic_session_id, semester, name) DO NOTHING
  `);
  await client.query(`
    UPDATE students s SET section_id=sec.id
    FROM sections sec JOIN programs p ON p.id=sec.program_id
    JOIN academic_sessions a ON a.id=sec.academic_session_id
    WHERE s.registration_number='REG-DEMO-001' AND p.code='BSCS'
      AND a.name='2026-2027' AND sec.semester=1 AND sec.name='A'
  `);
  await client.query(`
    UPDATE courses c SET faculty_id=f.id
    FROM faculty f
    WHERE c.course_code='CS-101' AND f.employee_id='EMP-DEMO-001'
  `);
  await client.query(`
    INSERT INTO course_assignments
      (program_id, faculty_id, course_id, section_id, academic_session_id, semester, classroom_id, status)
    SELECT sec.program_id, f.id, c.id, sec.id, sec.academic_session_id, sec.semester, r.id, 'ACTIVE'
    FROM sections sec JOIN programs p ON p.id=sec.program_id
    JOIN faculty f ON f.employee_id='EMP-DEMO-001'
    JOIN courses c ON c.course_code='CS-101'
    JOIN classrooms r ON r.building='Main Building' AND r.room_number='101'
    WHERE p.code='BSCS' AND sec.name='A' AND sec.semester=1
    ON CONFLICT (course_id, section_id, academic_session_id, semester)
    DO UPDATE SET faculty_id=EXCLUDED.faculty_id, classroom_id=EXCLUDED.classroom_id, status='ACTIVE'
  `);
  await client.query(`
    UPDATE enrollments e SET academic_session_id=s.academic_session_id,
      semester_number=s.semester, semester=s.semester::text, enrollment_date='2026-09-01'
    FROM students s JOIN courses c ON c.course_code='CS-101'
    WHERE e.student_id=s.id AND e.course_id=c.id AND s.registration_number='REG-DEMO-001'
      AND e.academic_session_id IS NULL
  `);
  await client.query(`
    INSERT INTO timetable (course_assignment_id, classroom_id, day_of_week, start_time, end_time)
    SELECT ca.id, r.id, 1, '09:00', '10:00'
    FROM course_assignments ca JOIN courses c ON c.id=ca.course_id
    JOIN classrooms r ON r.building='Main Building' AND r.room_number='101'
    WHERE c.course_code='CS-101'
      AND NOT EXISTS (SELECT 1 FROM timetable t WHERE t.course_assignment_id=ca.id AND t.day_of_week=1)
  `);
  await client.query(`
    INSERT INTO attendance_sessions (course_assignment_id, attendance_date, topic, marked_by)
    SELECT ca.id, '2026-10-02', 'Introduction to Computing', u.id
    FROM course_assignments ca JOIN courses c ON c.id=ca.course_id
    JOIN faculty f ON f.id=ca.faculty_id JOIN users u ON u.id=f.user_id
    WHERE c.course_code='CS-101'
    ON CONFLICT (course_assignment_id, attendance_date) DO NOTHING
  `);
  await client.query(`
    INSERT INTO attendance_records (attendance_session_id, student_id, status)
    SELECT ats.id, s.id, 'PRESENT'
    FROM attendance_sessions ats JOIN course_assignments ca ON ca.id=ats.course_assignment_id
    JOIN courses c ON c.id=ca.course_id JOIN students s ON s.section_id=ca.section_id
    WHERE c.course_code='CS-101' AND s.registration_number='REG-DEMO-001'
    ON CONFLICT (attendance_session_id, student_id) DO UPDATE SET status='PRESENT', updated_at=NOW()
  `);
  await client.query(`
    INSERT INTO exams (course_assignment_id, name, exam_type, exam_date, maximum_marks,
      passing_marks, is_published, created_by)
    SELECT ca.id, 'Final Examination', 'FINAL', '2026-10-02', 100, 60, TRUE, u.id
    FROM course_assignments ca JOIN courses c ON c.id=ca.course_id
    JOIN users u ON u.email='manager@example.edu'
    WHERE c.course_code='CS-101'
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO exam_results (exam_id, student_id, marks_obtained, percentage, letter_grade, grade_point, graded_by)
    SELECT e.id, s.id, 88, 88, 'B+', 3.5, f.user_id
    FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
    JOIN courses c ON c.id=ca.course_id
    JOIN students s ON s.registration_number='REG-DEMO-001'
    JOIN faculty f ON f.id=ca.faculty_id
    WHERE c.course_code='CS-101' AND e.exam_type='FINAL'
    ON CONFLICT (exam_id, student_id) DO UPDATE SET marks_obtained=EXCLUDED.marks_obtained,
      percentage=EXCLUDED.percentage, letter_grade=EXCLUDED.letter_grade,
      grade_point=EXCLUDED.grade_point, graded_by=EXCLUDED.graded_by, updated_at=NOW()
  `);
  await client.query(`
    INSERT INTO fee_structures (program_id, semester, academic_session_id, fee_type, amount, due_date, status)
    SELECT p.id, 1, a.id, 'TUITION', 3000, '2026-10-15', 'ACTIVE'
    FROM programs p JOIN academic_sessions a ON a.name='2026-2027'
    WHERE p.code='BSCS'
    ON CONFLICT (program_id, semester, academic_session_id, fee_type) DO NOTHING
  `);
  await client.query(`
    INSERT INTO student_fees
      (student_id, fee_structure_id, academic_session_id, semester, fee_type, total_amount,
       discount, scholarship, late_fee, paid_amount, remaining_amount, due_date, status)
    SELECT s.id, fs.id, fs.academic_session_id, fs.semester, fs.fee_type, fs.amount,
      0, 0, 0, 0, fs.amount, fs.due_date, 'PENDING'
    FROM students s JOIN programs p ON p.id=s.program_id
    JOIN fee_structures fs ON fs.program_id=p.id AND fs.academic_session_id=s.academic_session_id
      AND fs.semester=s.semester AND fs.fee_type='TUITION'
    WHERE s.registration_number='REG-DEMO-001'
    ON CONFLICT (student_id, fee_structure_id) WHERE fee_structure_id IS NOT NULL DO NOTHING
  `);
  await client.query(`
    INSERT INTO invoices (invoice_number, student_fee_id, due_date, status, created_by)
    SELECT 'INV-DEMO-001', sf.id, sf.due_date, 'OPEN', u.id
    FROM student_fees sf JOIN students s ON s.id=sf.student_id
    JOIN users u ON u.email='manager@example.edu'
    WHERE s.registration_number='REG-DEMO-001' AND sf.fee_type='TUITION'
    ON CONFLICT DO NOTHING
  `);
  await client.query('COMMIT');
  console.log('Development roles, permissions, accounts, and Phase 1/2 sample workflows are ready.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

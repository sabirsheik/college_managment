import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';
import { writeAudit } from '../utils/audit.js';
import { calculateFeeBalance, calculateGrade, hasTwoDecimalPlaces, weightedGpa } from '../utils/phaseTwoRules.js';

const statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const examTypes = ['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ASSIGNMENT'];
const feeTypes = ['TUITION', 'ADMISSION', 'EXAM', 'LIBRARY', 'LAB', 'OTHER'];
const paymentMethods = ['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'];
const documentTypes = ['ADMISSION_LETTER', 'STUDENT_ID_CARD', 'FEE_RECEIPT', 'TRANSCRIPT', 'CERTIFICATE', 'OTHER'];

async function auditedMutation(req, action, entity, sql, values) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(sql, values);
    if (!result.rowCount) throw new HttpError(404, 'Record not found.');
    await writeAudit(req, action, entity, result.rows[0].id, {}, client);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function id(value, field = 'ID') {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > 2147483647) {
    throw new HttpError(400, `${field} must be a positive integer.`);
  }
  return result;
}

function date(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} must be a valid date (YYYY-MM-DD).`);
  }
  return value;
}

function object(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object.');
  return body;
}

function required(body, keys) {
  for (const key of keys) if (body[key] === undefined || body[key] === null) throw new HttpError(400, `${key} is required.`);
}

function page(query) {
  const p = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(p) || p < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page and limit must be valid integers (limit maximum is 100).');
  }
  return { p, limit, offset: (p - 1) * limit };
}

async function list(res, query, sql, values, countSql, countValues = values) {
  const { p, limit, offset } = page(query);
  const [rows, count] = await Promise.all([
    pool.query(`${sql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]),
    pool.query(countSql, countValues)
  ]);
  const total = count.rows[0].total;
  res.json({
    success: true, message: 'Records fetched successfully.', data: rows.rows,
    meta: { page: p, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

async function studentId(req, db = pool) {
  const result = await db.query('SELECT id FROM students WHERE user_id=$1', [req.user.id]);
  if (!result.rowCount) throw new HttpError(403, 'No student record is linked to this account.');
  return result.rows[0].id;
}

async function facultyId(req, db = pool) {
  const result = await db.query('SELECT id FROM faculty WHERE user_id=$1', [req.user.id]);
  if (!result.rowCount) throw new HttpError(403, 'No faculty record is linked to this account.');
  return result.rows[0].id;
}

const studentRole = (req) => req.user.role === 'STUDENT';
const facultyRole = (req) => req.user.role === 'FACULTY';

async function canManageAssignment(req, assignmentId, db = pool) {
  const result = await db.query('SELECT faculty_id FROM course_assignments WHERE id=$1', [assignmentId]);
  if (!result.rowCount) throw new HttpError(404, 'Course assignment not found.');
  if (facultyRole(req) && result.rows[0].faculty_id !== await facultyId(req, db)) {
    throw new HttpError(403, 'Faculty can manage only their assigned courses.');
  }
  return result.rows[0];
}

export async function listAttendanceSessions(req, res) {
  const values = [];
  const clauses = [];
  if (req.query.course_assignment_id) {
    values.push(id(req.query.course_assignment_id));
    clauses.push(`a.course_assignment_id=$${values.length}`);
  }
  if (req.query.from) { values.push(date(req.query.from, 'from')); clauses.push(`a.attendance_date >= $${values.length}`); }
  if (req.query.to) { values.push(date(req.query.to, 'to')); clauses.push(`a.attendance_date <= $${values.length}`); }
  if (studentRole(req)) {
    values.push(await studentId(req));
    clauses.push(`EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.attendance_session_id=a.id AND ar.student_id=$${values.length})`);
  } else if (facultyRole(req)) {
    values.push(await facultyId(req));
    clauses.push(`ca.faculty_id=$${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM attendance_sessions a JOIN course_assignments ca ON ca.id=a.course_assignment_id
    JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id`;
  await list(res, req.query,
    `SELECT a.*, c.course_code, c.name AS course_name, s.name AS section_name ${from} ${where}
     ORDER BY a.attendance_date DESC, a.id DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function markAttendance(req, res) {
  const body = object(req.body);
  required(body, ['course_assignment_id', 'attendance_date', 'records']);
  const assignmentId = id(body.course_assignment_id);
  const attendanceDate = date(body.attendance_date, 'attendance_date');
  if (!Array.isArray(body.records) || !body.records.length || body.records.length > 500) {
    throw new HttpError(400, 'records must contain between 1 and 500 attendance records.');
  }
  const seen = new Set();
  for (const record of body.records) {
    if (!record || !Number.isSafeInteger(Number(record.student_id)) || Number(record.student_id) < 1 ||
        !statuses.includes(record.status)) throw new HttpError(400, 'Each record needs a valid student_id and attendance status.');
    if (seen.has(Number(record.student_id))) throw new HttpError(400, 'A student may appear only once per attendance session.');
    seen.add(Number(record.student_id));
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignment = await canManageAssignment(req, assignmentId, client);
    const sectionResult = await client.query('SELECT section_id, academic_session_id FROM course_assignments WHERE id=$1', [assignmentId]);
    const sectionId = sectionResult.rows[0].section_id;
    const sessionResult = await client.query('SELECT start_date, end_date FROM academic_sessions WHERE id=$1', [sectionResult.rows[0].academic_session_id]);
    const session = sessionResult.rows[0];
    if (attendanceDate < String(session.start_date).slice(0, 10) ||
        attendanceDate > String(session.end_date).slice(0, 10)) {
      throw new HttpError(400, 'Attendance date must be within the academic session.');
    }
    const students = await client.query(
      `SELECT id FROM students WHERE id=ANY($1::int[]) AND section_id=$2 AND status='ACTIVE'`,
      [[...seen], sectionId]
    );
    if (students.rowCount !== seen.size) throw new HttpError(400, 'Attendance may be recorded only for active students in the assigned section.');
    const sessionRecord = await client.query(
      `INSERT INTO attendance_sessions (course_assignment_id, attendance_date, topic, marked_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (course_assignment_id, attendance_date)
       DO UPDATE SET topic=EXCLUDED.topic, marked_by=EXCLUDED.marked_by
       RETURNING *`,
      [assignmentId, attendanceDate, body.topic == null ? null : String(body.topic).slice(0, 200), req.user.id]
    );
    for (const record of body.records) {
      await client.query(
        `INSERT INTO attendance_records (attendance_session_id, student_id, status, note)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (attendance_session_id, student_id)
         DO UPDATE SET status=EXCLUDED.status, note=EXCLUDED.note, updated_at=NOW()`,
        [sessionRecord.rows[0].id, Number(record.student_id), record.status,
          record.note == null ? null : String(record.note).slice(0, 500)]
      );
    }
    await writeAudit(req, 'MARK_ATTENDANCE', 'attendance_sessions', sessionRecord.rows[0].id,
      { courseAssignmentId: assignmentId, recordCount: seen.size }, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Attendance saved successfully.', data: sessionRecord.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAttendanceMine(req, res) {
  const ownId = await studentId(req);
  const values = [ownId];
  const clauses = ['ar.student_id=$1'];
  if (req.query.from) { values.push(date(req.query.from, 'from')); clauses.push(`a.attendance_date >= $${values.length}`); }
  if (req.query.to) { values.push(date(req.query.to, 'to')); clauses.push(`a.attendance_date <= $${values.length}`); }
  const where = clauses.join(' AND ');
  const result = await pool.query(
    `SELECT a.attendance_date, ar.status, ar.note, c.course_code, c.name AS course_name,
      s.name AS section_name, ca.semester, ca.academic_session_id
     FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id
     JOIN course_assignments ca ON ca.id=a.course_assignment_id
     JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id
     WHERE ${where} ORDER BY a.attendance_date DESC`,
    values
  );
  const summary = await pool.query(
    `SELECT c.course_code, c.name AS course_name, COUNT(*)::int AS total_classes,
      COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE'))::int AS attended_classes,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE')) /
        NULLIF(COUNT(*) FILTER (WHERE ar.status <> 'EXCUSED'), 0), 2) AS attendance_percentage
     FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id
     JOIN course_assignments ca ON ca.id=a.course_assignment_id JOIN courses c ON c.id=ca.course_id
     WHERE ar.student_id=$1 GROUP BY c.id ORDER BY c.course_code`,
    [ownId]
  );
  res.json({ success: true, message: 'Attendance fetched successfully.', data: { records: result.rows, courses: summary.rows } });
}

export async function getAttendanceRoster(req, res) {
  const assignmentId = id(req.query.course_assignment_id, 'course_assignment_id');
  const attendanceDate = date(req.query.date, 'date');
  await canManageAssignment(req, assignmentId);
  const assignment = await pool.query(
    `SELECT ca.section_id, ca.academic_session_id, c.course_code, c.name AS course_name,
      s.name AS section_name, a.start_date, a.end_date
     FROM course_assignments ca JOIN courses c ON c.id=ca.course_id
     JOIN sections s ON s.id=ca.section_id JOIN academic_sessions a ON a.id=ca.academic_session_id
     WHERE ca.id=$1`,
    [assignmentId]
  );
  if (!assignment.rowCount) throw new HttpError(404, 'Course assignment not found.');
  if (attendanceDate < String(assignment.rows[0].start_date).slice(0, 10) ||
      attendanceDate > String(assignment.rows[0].end_date).slice(0, 10)) {
    throw new HttpError(400, 'Attendance date must be within the academic session.');
  }
  const students = await pool.query(
    `SELECT st.id AS student_id, st.registration_number,
      st.first_name || ' ' || st.last_name AS student_name, ar.status, ar.note
     FROM students st
     LEFT JOIN attendance_sessions ats ON ats.course_assignment_id=$1 AND ats.attendance_date=$2
     LEFT JOIN attendance_records ar ON ar.attendance_session_id=ats.id AND ar.student_id=st.id
     WHERE st.section_id=$3 AND st.status='ACTIVE'
     ORDER BY st.last_name, st.first_name`,
    [assignmentId, attendanceDate, assignment.rows[0].section_id]
  );
  res.json({
    success: true, message: 'Attendance roster fetched.',
    data: { assignment: assignment.rows[0], students: students.rows }
  });
}

export async function attendanceReport(req, res) {
  if (studentRole(req)) throw new HttpError(403, 'Use the personal attendance endpoint to view your attendance.');
  const values = [];
  const clauses = [];
  for (const field of ['academic_session_id', 'section_id', 'semester']) {
    if (req.query[field]) {
      values.push(id(req.query[field], field));
      const column = field === 'section_id' ? 'ca.section_id' : `ca.${field}`;
      clauses.push(`${column}=$${values.length}`);
    }
  }
  if (req.query.from) { values.push(date(req.query.from, 'from')); clauses.push(`a.attendance_date >= $${values.length}`); }
  if (req.query.to) { values.push(date(req.query.to, 'to')); clauses.push(`a.attendance_date <= $${values.length}`); }
  if (req.query.course_assignment_id) { values.push(id(req.query.course_assignment_id)); clauses.push(`a.course_assignment_id=$${values.length}`); }
  if (facultyRole(req)) { values.push(await facultyId(req)); clauses.push(`ca.faculty_id=$${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id
    JOIN course_assignments ca ON ca.id=a.course_assignment_id JOIN students st ON st.id=ar.student_id
    JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id`;
  const rows = await pool.query(
    `SELECT st.id AS student_id, st.registration_number, st.first_name || ' ' || st.last_name AS student_name,
      c.course_code, c.name AS course_name, s.name AS section_name, ar.status, a.attendance_date
     ${from} ${where} ORDER BY a.attendance_date DESC, st.last_name, st.first_name`,
    values
  );
  const totals = await pool.query(
    `SELECT COUNT(*)::int AS total_records,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE')) /
        NULLIF(COUNT(*) FILTER (WHERE ar.status <> 'EXCUSED'),0),2) AS attendance_percentage
     ${from} ${where}`, values);
  res.json({ success: true, message: 'Attendance report generated.', data: { rows: rows.rows, summary: totals.rows[0] } });
}

export async function listExams(req, res) {
  const values = [];
  const clauses = [];
  if (req.query.course_assignment_id) { values.push(id(req.query.course_assignment_id)); clauses.push(`e.course_assignment_id=$${values.length}`); }
  if (facultyRole(req)) { values.push(await facultyId(req)); clauses.push(`ca.faculty_id=$${values.length}`); }
  if (studentRole(req)) {
    values.push(await studentId(req));
    clauses.push(`EXISTS (SELECT 1 FROM students st WHERE st.id=$${values.length} AND st.section_id=ca.section_id)`);
    clauses.push('e.is_published=TRUE');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
    JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id`;
  await list(res, req.query,
    `SELECT e.*, c.course_code, c.name AS course_name, s.name AS section_name,
      ca.academic_session_id, ca.semester ${from} ${where} ORDER BY e.exam_date DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function getExamRoster(req, res) {
  const examId = id(req.params.id);
  const examResult = await pool.query(
    `SELECT e.*, ca.faculty_id, ca.section_id, c.course_code, c.name AS course_name,
      s.name AS section_name
     FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
     JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id
     WHERE e.id=$1`,
    [examId]
  );
  const exam = examResult.rows[0];
  if (!exam) throw new HttpError(404, 'Exam not found.');
  if (facultyRole(req) && exam.faculty_id !== await facultyId(req)) {
    throw new HttpError(403, 'Faculty can view only assigned course rosters.');
  }
  const students = await pool.query(
    `SELECT st.id AS student_id, st.registration_number,
      st.first_name || ' ' || st.last_name AS student_name,
      er.marks_obtained, er.percentage, er.letter_grade, er.grade_point
     FROM students st LEFT JOIN exam_results er ON er.student_id=st.id AND er.exam_id=$1
     WHERE st.section_id=$2 AND st.status='ACTIVE'
     ORDER BY st.last_name, st.first_name`,
    [examId, exam.section_id]
  );
  res.json({ success: true, message: 'Exam roster fetched.', data: { exam, students: students.rows } });
}

export async function createExam(req, res) {
  const body = object(req.body);
  required(body, ['course_assignment_id', 'name', 'exam_type', 'exam_date', 'maximum_marks', 'passing_marks']);
  if (!examTypes.includes(body.exam_type)) throw new HttpError(400, 'Invalid exam_type.');
  const maximum = Number(body.maximum_marks);
  const passing = Number(body.passing_marks);
  if (!Number.isFinite(maximum) || maximum <= 0 || !hasTwoDecimalPlaces(maximum) ||
      !Number.isFinite(passing) || passing < 0 || !hasTwoDecimalPlaces(passing) || passing > maximum) {
    throw new HttpError(400, 'Marks must be valid and passing_marks cannot exceed maximum_marks.');
  }
  const assignmentId = id(body.course_assignment_id);
  await canManageAssignment(req, assignmentId);
  const record = await auditedMutation(req, 'CREATE', 'exams',
    `INSERT INTO exams (course_assignment_id, name, exam_type, exam_date, maximum_marks, passing_marks, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [assignmentId, String(body.name).trim().slice(0, 160), body.exam_type, date(body.exam_date, 'exam_date'),
      maximum, passing, req.user.id]
  );
  res.status(201).json({ success: true, message: 'Exam created successfully.', data: record });
}

export async function publishExam(req, res) {
  const examId = id(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exam = await client.query(
      `SELECT e.*, ca.faculty_id FROM exams e JOIN course_assignments ca ON ca.id=e.course_assignment_id
       WHERE e.id=$1 FOR UPDATE`,
      [examId]
    );
    if (!exam.rowCount) throw new HttpError(404, 'Exam not found.');
    if (facultyRole(req) && exam.rows[0].faculty_id !== await facultyId(req, client)) throw new HttpError(403, 'Faculty can manage only their assigned courses.');
    const missing = await client.query(
      `SELECT st.id FROM students st JOIN course_assignments ca ON ca.section_id=st.section_id
       WHERE ca.id=$1 AND st.status='ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_id=$2 AND er.student_id=st.id) LIMIT 1`,
      [exam.rows[0].course_assignment_id, examId]
    );
    if (missing.rowCount) throw new HttpError(409, 'All active students must have a result before the exam is published.');
    const result = await client.query('UPDATE exams SET is_published=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *', [examId]);
    await writeAudit(req, 'PUBLISH', 'exams', examId, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Exam results published.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function saveExamResults(req, res) {
  const examId = id(req.params.id);
  const body = object(req.body);
  if (!Array.isArray(body.results) || !body.results.length || body.results.length > 500) {
    throw new HttpError(400, 'results must contain between 1 and 500 student results.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const examResult = await client.query(
      `SELECT e.*, ca.faculty_id, ca.section_id FROM exams e
       JOIN course_assignments ca ON ca.id=e.course_assignment_id WHERE e.id=$1 FOR UPDATE`,
      [examId]
    );
    const exam = examResult.rows[0];
    if (!exam) throw new HttpError(404, 'Exam not found.');
    if (exam.is_published) throw new HttpError(409, 'Published exam results are locked.');
    if (facultyRole(req) && exam.faculty_id !== await facultyId(req, client)) throw new HttpError(403, 'Faculty can grade only their assigned courses.');
    const seen = new Set();
    for (const row of body.results) {
      const student = id(row.student_id, 'student_id');
      if (seen.has(student)) throw new HttpError(400, 'A student may appear only once per exam.');
      seen.add(student);
      const marks = Number(row.marks_obtained);
      const member = await client.query(
        "SELECT 1 FROM students WHERE id=$1 AND section_id=$2 AND status='ACTIVE'",
        [student, exam.section_id]
      );
      if (!member.rowCount) throw new HttpError(400, 'Results may be entered only for active students in the assigned section.');
      const scales = await client.query('SELECT letter_grade, minimum_percentage, maximum_percentage, grade_point, is_active FROM grade_scales WHERE is_active');
      const grade = calculateGrade(marks, exam.maximum_marks, scales.rows);
      await client.query(
        `INSERT INTO exam_results (exam_id, student_id, marks_obtained, percentage,
          letter_grade, grade_point, graded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (exam_id, student_id) DO UPDATE SET marks_obtained=EXCLUDED.marks_obtained,
           percentage=EXCLUDED.percentage, letter_grade=EXCLUDED.letter_grade,
           grade_point=EXCLUDED.grade_point, graded_by=EXCLUDED.graded_by, updated_at=NOW()`,
        [examId, student, marks, grade.percentage, grade.letterGrade, grade.gradePoint, req.user.id]
      );
    }
    await writeAudit(req, 'GRADE', 'exams', examId, { count: seen.size }, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Exam results saved and grades calculated.', data: { exam_id: examId, records_saved: seen.size } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listGrades(req, res) {
  const values = [];
  const clauses = [];
  if (req.query.student_id) { values.push(id(req.query.student_id)); clauses.push(`er.student_id=$${values.length}`); }
  if (req.query.exam_id) { values.push(id(req.query.exam_id)); clauses.push(`er.exam_id=$${values.length}`); }
  if (studentRole(req)) {
    values.push(await studentId(req));
    clauses.push(`er.student_id=$${values.length}`);
    clauses.push('e.is_published=TRUE');
  } else if (facultyRole(req)) {
    values.push(await facultyId(req));
    clauses.push(`ca.faculty_id=$${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM exam_results er JOIN exams e ON e.id=er.exam_id
    JOIN course_assignments ca ON ca.id=e.course_assignment_id
    JOIN courses c ON c.id=ca.course_id JOIN students st ON st.id=er.student_id`;
  await list(res, req.query,
    `SELECT er.*, e.name AS exam_name, e.exam_type, e.exam_date, c.course_code, c.name AS course_name,
      st.registration_number, st.first_name || ' ' || st.last_name AS student_name ${from} ${where}
     ORDER BY e.exam_date DESC, st.last_name`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function listGradeScale(_req, res) {
  const result = await pool.query('SELECT * FROM grade_scales WHERE is_active ORDER BY minimum_percentage DESC');
  res.json({ success: true, message: 'Active grade scale fetched.', data: result.rows });
}

export async function createGradeScale(req, res) {
  const body = object(req.body);
  required(body, ['letter_grade', 'minimum_percentage', 'maximum_percentage', 'grade_point']);
  const low = Number(body.minimum_percentage);
  const high = Number(body.maximum_percentage);
  const point = Number(body.grade_point);
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(point) ||
      !hasTwoDecimalPlaces(low) || !hasTwoDecimalPlaces(high) || !hasTwoDecimalPlaces(point) ||
      low < 0 || high > 100 || low > high || point < 0 || point > 4) {
    throw new HttpError(400, 'Grade scale values are outside valid ranges.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 4)');
    const overlap = await client.query(
      'SELECT 1 FROM grade_scales WHERE is_active AND $1 <= maximum_percentage AND $2 >= minimum_percentage LIMIT 1',
      [low, high]
    );
    if (overlap.rowCount) throw new HttpError(409, 'Active grade percentage ranges cannot overlap.');
    const result = await client.query(
      `INSERT INTO grade_scales (letter_grade, minimum_percentage, maximum_percentage, grade_point)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [String(body.letter_grade).trim().toUpperCase().slice(0, 5), low, high, point]
    );
    await writeAudit(req, 'CREATE', 'grade_scales', result.rows[0].id, {}, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Grade scale created.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateGradeScale(req, res) {
  const scaleId = id(req.params.id);
  const body = object(req.body);
  const allowed = ['minimum_percentage', 'maximum_percentage', 'grade_point', 'is_active'];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'Provide valid grade-scale fields.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 4)');
    const currentResult = await client.query('SELECT * FROM grade_scales WHERE id=$1 FOR UPDATE', [scaleId]);
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'Grade scale not found.');
    const next = { ...current, ...body };
    const low = Number(next.minimum_percentage);
    const high = Number(next.maximum_percentage);
    const point = Number(next.grade_point);
    if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(point) ||
        !hasTwoDecimalPlaces(low) || !hasTwoDecimalPlaces(high) || !hasTwoDecimalPlaces(point) ||
        low < 0 || high > 100 || low > high || point < 0 || point > 4 ||
        typeof next.is_active !== 'boolean') {
      throw new HttpError(400, 'Grade scale values are outside valid ranges.');
    }
    if (next.is_active) {
      const overlap = await client.query(
        `SELECT 1 FROM grade_scales WHERE is_active AND id<>$1
         AND $2 <= maximum_percentage AND $3 >= minimum_percentage LIMIT 1`,
        [scaleId, low, high]
      );
      if (overlap.rowCount) throw new HttpError(409, 'Active grade percentage ranges cannot overlap.');
    }
    const result = await client.query(
      `UPDATE grade_scales SET minimum_percentage=$1, maximum_percentage=$2,
       grade_point=$3, is_active=$4 WHERE id=$5 RETURNING *`,
      [low, high, point, next.is_active, scaleId]
    );
    await writeAudit(req, 'UPDATE', 'grade_scales', scaleId, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Grade scale updated.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGpa(req, res) {
  if (facultyRole(req)) throw new HttpError(403, 'Faculty can view assigned course grades but not a student-wide academic summary.');
  const ownId = studentRole(req) ? await studentId(req) : null;
  if (ownId && req.params.studentId && req.params.studentId !== 'me' &&
      Number(req.params.studentId) !== ownId) throw new HttpError(403, 'Students can view only their own academic summary.');
  const student = ownId ?? id(req.params.studentId, 'studentId');
  const result = await pool.query(
    `SELECT ca.academic_session_id, a.name AS academic_session_name, ca.semester,
      c.course_code, c.name AS course_name, c.credit_hours,
      er.letter_grade, er.grade_point, er.percentage
     FROM exam_results er JOIN exams e ON e.id=er.exam_id
     JOIN course_assignments ca ON ca.id=e.course_assignment_id
     JOIN courses c ON c.id=ca.course_id JOIN academic_sessions a ON a.id=ca.academic_session_id
     WHERE er.student_id=$1 AND e.exam_type='FINAL' AND e.is_published=TRUE
       AND ($2::integer IS NULL OR ca.academic_session_id=$2)
     ORDER BY a.start_date, ca.semester, c.course_code`,
    [student, req.query.academic_session_id ? id(req.query.academic_session_id) : null]
  );
  const byTerm = new Map();
  for (const row of result.rows) {
    const key = `${row.academic_session_id}:${row.semester}`;
    const term = byTerm.get(key) || {
      academic_session_id: row.academic_session_id, academic_session_name: row.academic_session_name,
      semester: row.semester, courses: []
    };
    term.courses.push(row);
    byTerm.set(key, term);
  }
  const terms = [...byTerm.values()].map((term) => {
    const summary = weightedGpa(term.courses);
    return {
      academic_session_id: term.academic_session_id, academic_session_name: term.academic_session_name,
      semester: term.semester, gpa: summary.gpa, credit_hours: summary.creditHours, courses: term.courses
    };
  });
  const overall = weightedGpa(result.rows);
  res.json({
    success: true, message: 'Academic summary calculated from published final grades.',
    data: { student_id: student, cgpa: overall.gpa,
      completed_credit_hours: overall.creditHours, semesters: terms }
  });
}

export async function listFeeStructures(req, res) {
  const values = [];
  const clauses = [];
  for (const field of ['program_id', 'semester', 'academic_session_id', 'status']) {
    if (req.query[field]) { values.push(field === 'status' ? req.query[field] : id(req.query[field], field)); clauses.push(`f.${field}=$${values.length}`); }
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = 'FROM fee_structures f JOIN programs p ON p.id=f.program_id JOIN academic_sessions a ON a.id=f.academic_session_id';
  await list(res, req.query,
    `SELECT f.*, p.name AS program_name, a.name AS academic_session_name ${from} ${where} ORDER BY a.start_date DESC, f.semester, f.fee_type`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function createFeeStructure(req, res) {
  const body = object(req.body);
  required(body, ['program_id', 'semester', 'academic_session_id', 'fee_type', 'amount', 'due_date']);
  if (!feeTypes.includes(body.fee_type)) throw new HttpError(400, 'Invalid fee_type.');
  const amount = Number(body.amount);
  calculateFeeBalance({ totalAmount: amount });
  const record = await auditedMutation(req, 'CREATE', 'fee_structures',
    `INSERT INTO fee_structures (program_id, semester, academic_session_id, fee_type, amount, description, due_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id(body.program_id), id(body.semester), id(body.academic_session_id), body.fee_type,
      amount, body.description == null ? null : String(body.description).slice(0, 500),
      date(body.due_date, 'due_date'), body.status || 'ACTIVE']
  );
  res.status(201).json({ success: true, message: 'Fee structure created.', data: record });
}

export async function listStudentFees(req, res) {
  const values = [];
  const clauses = [];
  if (req.query.student_id) { values.push(id(req.query.student_id)); clauses.push(`f.student_id=$${values.length}`); }
  if (req.query.status) { values.push(req.query.status); clauses.push(`f.status=$${values.length}`); }
  if (studentRole(req)) { values.push(await studentId(req)); clauses.push(`f.student_id=$${values.length}`); }
  if (req.query.academic_session_id) { values.push(id(req.query.academic_session_id)); clauses.push(`f.academic_session_id=$${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = 'FROM student_fees f JOIN students s ON s.id=f.student_id JOIN academic_sessions a ON a.id=f.academic_session_id';
  await list(res, req.query,
    `SELECT f.*, CASE WHEN f.status IN ('PENDING','PARTIAL') AND f.due_date<CURRENT_DATE
      THEN 'OVERDUE' ELSE f.status END AS status,
    s.registration_number, s.first_name || ' ' || s.last_name AS student_name,
      a.name AS academic_session_name ${from} ${where} ORDER BY f.due_date DESC, f.id DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function createStudentFee(req, res) {
  const body = object(req.body);
  required(body, ['student_id', 'academic_session_id', 'semester']);
  const studentIdValue = studentRole(req) ? await studentId(req) : id(body.student_id);
  if (studentRole(req) && body.student_id !== undefined && Number(body.student_id) !== studentIdValue) throw new HttpError(403, 'Students can access only their own fees.');
  const studentResult = await pool.query('SELECT program_id FROM students WHERE id=$1', [studentIdValue]);
  if (!studentResult.rowCount) throw new HttpError(404, 'Student not found.');
  let feeType = body.fee_type;
  let total = Number(body.total_amount);
  let dueDate = body.due_date;
  let feeStructureId = null;
  if (body.fee_structure_id != null) {
    const structure = await pool.query(
      `SELECT id, program_id, semester, academic_session_id, fee_type, amount, due_date
       FROM fee_structures WHERE id=$1 AND status='ACTIVE'`,
      [id(body.fee_structure_id)]
    );
    const selected = structure.rows[0];
    if (!selected) throw new HttpError(404, 'Active fee structure not found.');
    if (selected.program_id !== studentResult.rows[0].program_id ||
        selected.semester !== id(body.semester) ||
        selected.academic_session_id !== id(body.academic_session_id)) {
      throw new HttpError(400, 'Fee structure does not apply to this student, session, and semester.');
    }
    feeType = selected.fee_type;
    total = Number(selected.amount);
    dueDate = selected.due_date;
    feeStructureId = selected.id;
  } else if (body.fee_type === undefined || body.total_amount === undefined || body.due_date === undefined) {
    throw new HttpError(400, 'fee_type, total_amount, and due_date are required without a fee structure.');
  }
  if (!feeTypes.includes(feeType)) throw new HttpError(400, 'Invalid fee_type.');
  const discount = Number(body.discount || 0);
  const scholarship = Number(body.scholarship || 0);
  const lateFee = Number(body.late_fee || 0);
  const balance = calculateFeeBalance({ totalAmount: total, discount, scholarship, lateFee });
  const amountDue = balance.assessedAmount;
  const dueDateValue = date(dueDate, 'due_date');
  const overdue = dueDateValue < new Date().toISOString().slice(0, 10);
  const initialStatus = total > 0 && discount + scholarship === total && lateFee === 0
    ? 'WAIVED'
    : amountDue === 0 ? 'PAID' : overdue ? 'OVERDUE' : 'PENDING';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fee = await client.query(
      `INSERT INTO student_fees (student_id, fee_structure_id, academic_session_id, semester, fee_type,
        total_amount, discount, scholarship, late_fee, paid_amount, remaining_amount, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12) RETURNING *`,
      [studentIdValue, feeStructureId,
        id(body.academic_session_id), id(body.semester), feeType,
        total, discount, scholarship, lateFee, amountDue, dueDateValue, initialStatus]
    );
    const invoiceNumber = `INV-${String((await client.query("SELECT nextval('invoice_number_seq') AS n")).rows[0].n).padStart(8, '0')}`;
    const invoice = await client.query(
      `INSERT INTO invoices (invoice_number, student_fee_id, due_date, status, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [invoiceNumber, fee.rows[0].id, fee.rows[0].due_date,
        initialStatus === 'PAID' ? 'PAID' : initialStatus === 'WAIVED' ? 'VOID' : 'OPEN', req.user.id]
    );
    await writeAudit(req, 'CREATE', 'student_fees', fee.rows[0].id, { invoiceId: invoice.rows[0].id }, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Student fee and invoice created.', data: { fee: fee.rows[0], invoice: invoice.rows[0] } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createPayment(req, res) {
  const body = object(req.body);
  required(body, ['fee_id', 'amount', 'payment_method']);
  if (!paymentMethods.includes(body.payment_method)) throw new HttpError(400, 'Invalid payment_method.');
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Payment amount must be greater than zero.');
  calculateFeeBalance({ totalAmount: amount });
  if (body.transaction_reference != null &&
      (typeof body.transaction_reference !== 'string' || body.transaction_reference.trim().length > 120)) {
    throw new HttpError(400, 'transaction_reference must be a string of at most 120 characters.');
  }
  const transactionReference = body.transaction_reference == null ? null : body.transaction_reference.trim();
  if (body.payment_method !== 'CASH' && !transactionReference) {
    throw new HttpError(400, 'transaction_reference is required for non-cash payments.');
  }
  const feeId = id(body.fee_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const feeResult = await client.query('SELECT * FROM student_fees WHERE id=$1 FOR UPDATE', [feeId]);
    const fee = feeResult.rows[0];
    if (!fee) throw new HttpError(404, 'Student fee not found.');
    if (studentRole(req) && fee.student_id !== await studentId(req, client)) throw new HttpError(403, 'Students can pay only their own fees.');
    if (amount > Number(fee.remaining_amount)) throw new HttpError(409, 'Payment exceeds the outstanding balance.');
    const sequence = (await client.query("SELECT nextval('receipt_number_seq') AS n")).rows[0].n;
    const receiptNumber = `RCPT-${String(sequence).padStart(8, '0')}`;
    const paymentDate = body.payment_date ? new Date(body.payment_date) : new Date();
    if (Number.isNaN(paymentDate.getTime())) throw new HttpError(400, 'payment_date is invalid.');
    const payment = await client.query(
      `INSERT INTO payments (receipt_number, student_id, fee_id, amount, payment_method, transaction_reference, payment_date, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, receipt_number, student_id, fee_id, amount, payment_method, transaction_reference, payment_date`,
      [receiptNumber, fee.student_id, feeId, amount, body.payment_method,
        transactionReference,
        paymentDate.toISOString(), req.user.id]
    );
    const balance = calculateFeeBalance({
      totalAmount: fee.total_amount,
      discount: fee.discount,
      scholarship: fee.scholarship,
      lateFee: fee.late_fee,
      paidAmount: Number(fee.paid_amount) + amount
    });
    const paid = balance.paidAmount;
    const remaining = balance.remainingAmount;
    const isOverdue = String(fee.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const status = remaining === 0 ? 'PAID' : isOverdue ? 'OVERDUE' : 'PARTIAL';
    const invoiceStatus = remaining === 0 ? 'PAID' : 'PARTIAL';
    const updatedFee = await client.query(
      `UPDATE student_fees SET paid_amount=$1, remaining_amount=$2, status=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`, [paid, remaining, status, feeId]);
    await client.query('UPDATE invoices SET status=$1 WHERE student_fee_id=$2', [invoiceStatus, feeId]);
    await writeAudit(req, 'PAYMENT', 'payments', payment.rows[0].id,
      { receiptNumber, amount }, client);
    await client.query('COMMIT');
    res.status(201).json({
      success: true, message: 'Payment recorded successfully.',
      data: { payment: payment.rows[0], fee: updatedFee.rows[0] }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPayments(req, res) {
  const values = [];
  const clauses = [];
  if (req.query.student_id) { values.push(id(req.query.student_id)); clauses.push(`p.student_id=$${values.length}`); }
  if (req.query.from) { values.push(date(req.query.from, 'from')); clauses.push(`p.payment_date >= $${values.length}::date`); }
  if (req.query.to) { values.push(date(req.query.to, 'to')); clauses.push(`p.payment_date < ($${values.length}::date + INTERVAL '1 day')`); }
  if (studentRole(req)) { values.push(await studentId(req)); clauses.push(`p.student_id=$${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM payments p JOIN students s ON s.id=p.student_id JOIN student_fees f ON f.id=p.fee_id`;
  await list(res, req.query,
    `SELECT p.id, p.receipt_number, p.student_id, p.fee_id, p.amount, p.payment_method,
      p.transaction_reference, p.payment_date, s.registration_number, s.first_name || ' ' || s.last_name AS student_name,
      f.fee_type ${from} ${where} ORDER BY p.payment_date DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function getReceipt(req, res) {
  const paymentId = id(req.params.id);
  const values = [paymentId];
  let scope = '';
  if (studentRole(req)) { values.push(await studentId(req)); scope = 'AND s.id=$2'; }
  const result = await pool.query(
    `SELECT p.receipt_number, p.payment_date, p.amount, p.payment_method, p.transaction_reference,
      s.registration_number, s.first_name, s.last_name, s.email,
      f.fee_type, f.academic_session_id, f.semester,
      cs.college_name, cs.address, cs.phone, cs.email AS college_email, cs.currency
     FROM payments p JOIN students s ON s.id=p.student_id
     JOIN student_fees f ON f.id=p.fee_id CROSS JOIN college_settings cs
     WHERE p.id=$1 ${scope}`,
    values
  );
  if (!result.rowCount) throw new HttpError(404, 'Receipt not found.');
  res.json({ success: true, message: 'Receipt fetched.', data: result.rows[0] });
}

export async function listInvoices(req, res) {
  const values = [];
  const clauses = [];
  if (studentRole(req)) { values.push(await studentId(req)); clauses.push(`s.id=$${values.length}`); }
  if (req.query.student_id) { values.push(id(req.query.student_id)); clauses.push(`s.id=$${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM invoices i JOIN student_fees f ON f.id=i.student_fee_id JOIN students s ON s.id=f.student_id`;
  await list(res, req.query,
    `SELECT i.*, CASE WHEN i.status IN ('OPEN','PARTIAL') AND i.due_date<CURRENT_DATE THEN 'OVERDUE' ELSE i.status END AS status,
      f.fee_type, f.total_amount, f.discount, f.scholarship, f.late_fee, f.paid_amount,
      f.remaining_amount, s.registration_number, s.first_name || ' ' || s.last_name AS student_name ${from} ${where}
     ORDER BY i.issued_at DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`);
}

export async function getInvoice(req, res) {
  const invoiceId = id(req.params.id);
  const values = [invoiceId];
  let scope = '';
  if (studentRole(req)) { values.push(await studentId(req)); scope = 'AND s.id=$2'; }
  const result = await pool.query(
    `SELECT i.invoice_number, i.issued_at, i.due_date, i.status AS invoice_status,
      f.fee_type, f.total_amount, f.discount, f.scholarship, f.late_fee, f.paid_amount, f.remaining_amount,
      s.registration_number, s.first_name, s.last_name, s.email, cs.college_name, cs.address, cs.phone,
      cs.email AS college_email, cs.currency
     FROM invoices i JOIN student_fees f ON f.id=i.student_fee_id JOIN students s ON s.id=f.student_id
     CROSS JOIN college_settings cs WHERE i.id=$1 ${scope}`,
    values
  );
  if (!result.rowCount) throw new HttpError(404, 'Invoice not found.');
  res.json({ success: true, message: 'Invoice fetched.', data: result.rows[0] });
}

export async function listDocuments(req, res) {
  const values = [];
  let where = '';
  if (studentRole(req)) { values.push(await studentId(req)); where = 'WHERE d.student_id=$1'; }
  else if (req.query.student_id) { values.push(id(req.query.student_id)); where = 'WHERE d.student_id=$1'; }
  if (req.query.document_type) {
    values.push(req.query.document_type);
    where += `${where ? ' AND' : 'WHERE'} d.document_type=$${values.length}`;
  }
  const source = `FROM student_documents d JOIN students s ON s.id=d.student_id`;
  await list(res, req.query,
    `SELECT d.id, d.student_id, d.document_type, d.original_name, d.storage_provider, d.mime_type,
      d.size_bytes, d.created_at, s.registration_number ${source} ${where} ORDER BY d.created_at DESC`,
    values, `SELECT COUNT(*)::int AS total ${source} ${where}`);
}

export async function createDocument(req, res) {
  const body = object(req.body);
  required(body, ['student_id', 'document_type', 'original_name', 'storage_provider', 'storage_key', 'mime_type', 'size_bytes']);
  const ownId = studentRole(req) ? await studentId(req) : null;
  const student = ownId ?? id(body.student_id);
  if (ownId && Number(body.student_id) !== ownId) throw new HttpError(403, 'Students can create metadata only for their own documents.');
  if (!documentTypes.includes(body.document_type) || !['LOCAL', 'S3', 'CLOUDINARY', 'FIREBASE'].includes(body.storage_provider)) {
    throw new HttpError(400, 'Invalid document type or storage provider.');
  }
  const size = Number(body.size_bytes);
  if (!Number.isSafeInteger(size) || size < 1 || size > 25 * 1024 * 1024) throw new HttpError(400, 'Document size must be between 1 byte and 25 MB.');
  const record = await auditedMutation(req, 'CREATE', 'student_documents',
    `INSERT INTO student_documents (student_id, document_type, original_name, storage_provider,
      storage_key, mime_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, student_id, document_type, original_name, storage_provider, mime_type, size_bytes, created_at`,
    [student, body.document_type, String(body.original_name).trim().slice(0, 255), body.storage_provider,
      String(body.storage_key).trim(), String(body.mime_type).trim().slice(0, 120), size, req.user.id]
  );
  res.status(201).json({ success: true, message: 'Document metadata created.', data: record });
}

export async function facultyWorkload(req, res) {
  const values = [];
  const clauses = [];
  if (facultyRole(req)) { values.push(await facultyId(req)); clauses.push(`ca.faculty_id=$${values.length}`); }
  if (req.query.faculty_id) { values.push(id(req.query.faculty_id)); clauses.push(`ca.faculty_id=$${values.length}`); }
  if (req.query.academic_session_id) { values.push(id(req.query.academic_session_id)); clauses.push(`ca.academic_session_id=$${values.length}`); }
  if (req.query.department_id) { values.push(id(req.query.department_id)); clauses.push(`f.department_id=$${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT f.id AS faculty_id, f.employee_id, f.first_name || ' ' || f.last_name AS faculty_name,
      d.name AS department_name, COUNT(DISTINCT ca.id)::int AS assigned_courses,
      COUNT(DISTINCT ca.section_id)::int AS sections,
      COUNT(t.id)::int AS weekly_classes,
      COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time-t.start_time))/3600),0)::numeric(8,2) AS teaching_hours
     FROM faculty f JOIN departments d ON d.id=f.department_id
     LEFT JOIN course_assignments ca ON ca.faculty_id=f.id AND ca.status='ACTIVE'
     LEFT JOIN timetable t ON t.course_assignment_id=ca.id
     ${where} GROUP BY f.id, d.name ORDER BY teaching_hours DESC, faculty_name`,
    values
  );
  res.json({ success: true, message: 'Faculty workload fetched.', data: result.rows });
}

export async function academicReport(req, res) {
  const type = req.params.type;
  const allowed = ['enrollment', 'attendance', 'exam-performance', 'gpa', 'fees', 'outstanding-balances', 'faculty-workload'];
  if (!allowed.includes(type)) throw new HttpError(404, 'Unknown report type.');
  if (studentRole(req)) throw new HttpError(403, 'Academic reports are not available to student accounts.');
  if (facultyRole(req) && !['attendance', 'exam-performance', 'gpa'].includes(type)) {
    throw new HttpError(403, 'Faculty can view only assigned academic reports.');
  }
  if (req.user.role === 'ACCOUNTANT' && !['fees', 'outstanding-balances'].includes(type)) {
    throw new HttpError(403, 'Accountant reports are limited to fee and outstanding-balance data.');
  }
  const values = [];
  const clauses = [];
  const studentFilters = {
    academic_session_id: 'ca.academic_session_id',
    department_id: 'st.department_id',
    program_id: 'st.program_id',
    semester: 'ca.semester',
    section_id: 'ca.section_id'
  };
  const enrollmentFilters = {
    academic_session_id: 'en.academic_session_id',
    department_id: 'st.department_id',
    program_id: 'st.program_id',
    semester: 'en.semester_number',
    section_id: 'st.section_id'
  };
  const feeFilters = {
    academic_session_id: 'f.academic_session_id',
    department_id: 'st.department_id',
    program_id: 'st.program_id',
    semester: 'f.semester',
    section_id: 'st.section_id'
  };
  const filters = type === 'enrollment' ? enrollmentFilters
    : ['fees', 'outstanding-balances'].includes(type) ? feeFilters : studentFilters;
  for (const [param, column] of Object.entries(filters)) {
    if (req.query[param]) { values.push(id(req.query[param], param)); clauses.push(`${column}=$${values.length}`); }
  }
  let dateColumn;
  if (type === 'enrollment') dateColumn = 'en.enrollment_date';
  else if (['fees', 'outstanding-balances'].includes(type)) dateColumn = 'f.due_date';
  else if (type === 'attendance') dateColumn = 'a.attendance_date';
  else if (type === 'exam-performance' || type === 'gpa') dateColumn = 'e.exam_date';
  if (dateColumn && req.query.from) { values.push(date(req.query.from, 'from')); clauses.push(`${dateColumn} >= $${values.length}`); }
  if (dateColumn && req.query.to) { values.push(date(req.query.to, 'to')); clauses.push(`${dateColumn} <= $${values.length}`); }
  if (facultyRole(req)) { values.push(await facultyId(req)); clauses.push(`ca.faculty_id=$${values.length}`); }
  if (type === 'outstanding-balances') clauses.push('f.remaining_amount > 0');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let sql;
  if (type === 'enrollment') {
    sql = `SELECT en.academic_session_id, en.semester_number AS semester, st.program_id, st.department_id,
      COUNT(*)::int AS enrollment_count, COUNT(DISTINCT en.student_id)::int AS students
      FROM enrollments en JOIN students st ON st.id=en.student_id
      ${where}
      GROUP BY en.academic_session_id, en.semester_number, st.program_id, st.department_id
      ORDER BY en.academic_session_id, semester`;
  } else if (type === 'attendance') {
    sql = `SELECT ca.academic_session_id, ca.semester, ca.section_id,
      COUNT(*)::int AS records, COUNT(*) FILTER (WHERE ar.status='PRESENT')::int AS present,
      COUNT(*) FILTER (WHERE ar.status='ABSENT')::int AS absent,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE')) /
        NULLIF(COUNT(*) FILTER (WHERE ar.status <> 'EXCUSED'),0),2) AS attendance_percentage
      FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id
      JOIN course_assignments ca ON ca.id=a.course_assignment_id JOIN students st ON st.id=ar.student_id
      ${where}
      GROUP BY ca.academic_session_id, ca.semester, ca.section_id ORDER BY ca.academic_session_id, ca.semester`;
  } else if (type === 'exam-performance') {
    sql = `SELECT ca.academic_session_id, ca.semester, ca.section_id, e.exam_type,
      COUNT(er.id)::int AS graded_students, ROUND(AVG(er.percentage),2) AS average_percentage,
      COUNT(*) FILTER (WHERE er.marks_obtained >= e.passing_marks)::int AS passed
      FROM exam_results er JOIN exams e ON e.id=er.exam_id JOIN course_assignments ca ON ca.id=e.course_assignment_id
      JOIN students st ON st.id=er.student_id LEFT JOIN departments d ON d.id=st.department_id
      LEFT JOIN programs p ON p.id=st.program_id ${where}
      GROUP BY ca.academic_session_id, ca.semester, ca.section_id, e.exam_type
      ORDER BY ca.academic_session_id, ca.semester, e.exam_type`;
  } else if (type === 'gpa') {
    sql = `SELECT ca.academic_session_id, ca.semester, st.id AS student_id,
      st.registration_number, st.first_name || ' ' || st.last_name AS student_name,
      ROUND(SUM(c.credit_hours*er.grade_point)/NULLIF(SUM(c.credit_hours),0),2) AS gpa
      FROM exam_results er JOIN exams e ON e.id=er.exam_id JOIN course_assignments ca ON ca.id=e.course_assignment_id
      JOIN students st ON st.id=er.student_id JOIN courses c ON c.id=ca.course_id
      ${where ? `${where} AND` : 'WHERE'} e.exam_type='FINAL' AND e.is_published
      GROUP BY ca.academic_session_id, ca.semester, st.id ORDER BY ca.academic_session_id, ca.semester, student_name`;
  } else if (type === 'fees' || type === 'outstanding-balances') {
    sql = `SELECT f.academic_session_id, f.semester, st.program_id, st.department_id, f.status,
      COUNT(*)::int AS fee_count,
      SUM(f.total_amount-f.discount-f.scholarship+f.late_fee)::numeric(12,2) AS billed,
      SUM(f.paid_amount)::numeric(12,2) AS collected,
      SUM(f.remaining_amount)::numeric(12,2) AS outstanding
      FROM student_fees f JOIN students st ON st.id=f.student_id
      ${where}
      GROUP BY f.academic_session_id, f.semester, st.program_id, st.department_id, f.status
      ORDER BY f.academic_session_id, f.semester, f.status`;
  } else {
    const workloadClauses = [];
    const workloadValues = [];
    for (const [param, column] of Object.entries({
      academic_session_id: 'ca.academic_session_id', department_id: 'f.department_id',
      semester: 'ca.semester', section_id: 'ca.section_id'
    })) {
      if (req.query[param]) {
        workloadValues.push(id(req.query[param], param));
        workloadClauses.push(`${column}=$${workloadValues.length}`);
      }
    }
    const workloadWhere = workloadClauses.length ? `WHERE ${workloadClauses.join(' AND ')}` : '';
    const workload = await pool.query(
      `SELECT f.id AS faculty_id, f.employee_id, f.first_name || ' ' || f.last_name AS faculty_name,
        d.name AS department_name, COUNT(DISTINCT ca.id)::int AS assigned_courses,
        COUNT(DISTINCT ca.section_id)::int AS sections, COUNT(t.id)::int AS weekly_classes,
        COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time-t.start_time))/3600),0)::numeric(8,2) AS teaching_hours
       FROM faculty f JOIN departments d ON d.id=f.department_id
       LEFT JOIN course_assignments ca ON ca.faculty_id=f.id AND ca.status='ACTIVE'
       LEFT JOIN timetable t ON t.course_assignment_id=ca.id ${workloadWhere}
       GROUP BY f.id, d.name ORDER BY teaching_hours DESC, faculty_name`, workloadValues);
    res.json({ success: true, message: 'Faculty workload report generated.', data: workload.rows });
    return;
  }
  const result = await pool.query(sql, values);
  res.json({ success: true, message: `${type} report generated.`, data: result.rows });
}

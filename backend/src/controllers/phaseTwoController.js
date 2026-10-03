import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';
import { writeAudit } from '../utils/audit.js';
import { timeRangeOverlaps, validTimeRange } from '../utils/phaseTwoRules.js';

const roomTypes = ['LECTURE_HALL', 'LAB', 'CLASSROOM', 'SEMINAR_ROOM'];
const activeStates = ['ACTIVE', 'INACTIVE'];

function positiveId(value, label = 'ID') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  return id;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return body;
}

function requiredText(value, field, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function pageQuery(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page and limit must be valid integers (limit maximum is 100).');
  }
  return { page, limit, offset: (page - 1) * limit };
}

async function sendPage(res, db, sql, values, countSql = null, countValues = values, query = {}) {
  const { page, limit, offset } = pageQuery(query);
  const count = await db.query(countSql || `SELECT COUNT(*)::int AS total FROM (${sql}) page_rows`, countValues);
  const result = await db.query(`${sql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
  const total = count.rows[0].total;
  res.json({
    success: true,
    message: 'Records fetched successfully.',
    data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

async function ownStudentId(req, db = pool) {
  const result = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!result.rowCount) throw new HttpError(403, 'No student record is linked to this account.');
  return result.rows[0].id;
}

async function ownFacultyId(req, db = pool) {
  const result = await db.query('SELECT id FROM faculty WHERE user_id = $1', [req.user.id]);
  if (!result.rowCount) throw new HttpError(403, 'No faculty record is linked to this account.');
  return result.rows[0].id;
}

function isStudent(req) {
  return req.user.role === 'STUDENT';
}

function isFaculty(req) {
  return req.user.role === 'FACULTY';
}

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

function requireKeys(body, keys) {
  for (const key of keys) if (body[key] === undefined || body[key] === null) {
    throw new HttpError(400, `${key} is required.`);
  }
}

export async function listClassrooms(req, res) {
  const clauses = [];
  const values = [];
  if (req.query.status) { values.push(req.query.status); clauses.push(`status = $${values.length}`); }
  if (req.query.room_type) { values.push(req.query.room_type); clauses.push(`room_type = $${values.length}`); }
  if (req.query.q) {
    values.push(`%${String(req.query.q).slice(0, 100)}%`);
    clauses.push(`(building ILIKE $${values.length} OR room_number ILIKE $${values.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  await sendPage(res, pool, `SELECT * FROM classrooms ${where} ORDER BY building, room_number`, values,
    `SELECT COUNT(*)::int AS total FROM classrooms ${where}`, values, req.query);
}

export async function createClassroom(req, res) {
  const body = bodyObject(req.body);
  requireKeys(body, ['building', 'room_number', 'capacity', 'room_type']);
  const capacity = Number(body.capacity);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647) {
    throw new HttpError(400, 'capacity must be a positive integer.');
  }
  if (!roomTypes.includes(body.room_type)) throw new HttpError(400, 'Invalid room_type.');
  const facilities = body.facilities ?? [];
  if (!Array.isArray(facilities) || facilities.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new HttpError(400, 'facilities must be an array of non-empty strings.');
  }
  const record = await auditedMutation(req, 'CREATE', 'classrooms',
    `INSERT INTO classrooms (building, room_number, capacity, room_type, facilities, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [requiredText(body.building, 'building', 120), requiredText(body.room_number, 'room_number', 40),
      capacity, body.room_type, facilities.map((value) => value.trim()), body.status || 'ACTIVE']
  );
  res.status(201).json({ success: true, message: 'Classroom created successfully.', data: record });
}

export async function updateClassroom(req, res) {
  const id = positiveId(req.params.id);
  const body = bodyObject(req.body);
  const allowed = ['building', 'room_number', 'capacity', 'room_type', 'facilities', 'status'];
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowed.includes(key))) throw new HttpError(400, 'Provide valid classroom fields.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 3)');
    const current = await client.query('SELECT * FROM classrooms WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rowCount) throw new HttpError(404, 'Classroom not found.');
    const next = { ...current.rows[0], ...body };
    const capacity = Number(next.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647) {
      throw new HttpError(400, 'capacity must be a positive integer.');
    }
    if (!roomTypes.includes(next.room_type) || !activeStates.includes(next.status)) throw new HttpError(400, 'Invalid classroom type or status.');
    if (!Array.isArray(next.facilities) || next.facilities.some((value) => typeof value !== 'string')) {
      throw new HttpError(400, 'facilities must be an array of strings.');
    }
    const sections = await client.query(
      `SELECT s.id FROM sections s
       WHERE EXISTS (SELECT 1 FROM timetable t JOIN course_assignments ca ON ca.id=t.course_assignment_id
         WHERE t.classroom_id=$1 AND ca.section_id=s.id)
       ORDER BY s.id FOR UPDATE`,
      [id]
    );
    for (const section of sections.rows) {
      const count = await client.query(
        "SELECT COUNT(*)::int AS total FROM students WHERE section_id=$1 AND status='ACTIVE'",
        [section.id]
      );
      if (next.status !== 'ACTIVE' || count.rows[0].total > capacity) {
        throw new HttpError(409, 'Classroom cannot be deactivated or reduced below the size of its scheduled section.');
      }
    }
    const result = await client.query(
      `UPDATE classrooms SET building=$1, room_number=$2, capacity=$3, room_type=$4,
       facilities=$5, status=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [requiredText(next.building, 'building', 120), requiredText(next.room_number, 'room_number', 40),
        capacity, next.room_type, next.facilities, next.status, id]
    );
    await writeAudit(req, 'UPDATE', 'classrooms', id, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Classroom updated successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listSections(req, res) {
  const values = [];
  const clauses = [];
  for (const field of ['program_id', 'academic_session_id', 'semester', 'status']) {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      values.push(field === 'status' ? req.query[field] : positiveId(req.query[field], field));
      clauses.push(`s.${field} = $${values.length}`);
    }
  }
  if (isStudent(req)) {
    values.push(await ownStudentId(req));
    clauses.push(`EXISTS (SELECT 1 FROM students st WHERE st.section_id=s.id AND st.id=$${values.length})`);
  } else if (isFaculty(req)) {
    values.push(await ownFacultyId(req));
    clauses.push(`EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.section_id=s.id AND ca.faculty_id=$${values.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = 'FROM sections s JOIN programs p ON p.id=s.program_id JOIN academic_sessions a ON a.id=s.academic_session_id';
  await sendPage(res, pool,
    `SELECT s.*, p.name AS program_name, p.code AS program_code, a.name AS academic_session_name ${from} ${where} ORDER BY a.start_date DESC, p.name, s.semester, s.name`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`, values, req.query);
}

export async function createSection(req, res) {
  const body = bodyObject(req.body);
  requireKeys(body, ['program_id', 'academic_session_id', 'semester', 'name', 'capacity']);
  const semester = positiveId(body.semester, 'semester');
  const capacity = positiveId(body.capacity, 'capacity');
  if (semester > 20) throw new HttpError(400, 'semester must be between 1 and 20.');
  const record = await auditedMutation(req, 'CREATE', 'sections',
    `INSERT INTO sections (program_id, academic_session_id, semester, name, capacity, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [positiveId(body.program_id, 'program_id'), positiveId(body.academic_session_id, 'academic_session_id'),
      semester, requiredText(body.name, 'name', 40), capacity, body.status || 'ACTIVE']
  );
  res.status(201).json({ success: true, message: 'Section created successfully.', data: record });
}

export async function updateSection(req, res) {
  const id = positiveId(req.params.id);
  const body = bodyObject(req.body);
  const allowed = ['program_id', 'academic_session_id', 'semester', 'name', 'capacity', 'status'];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'Provide valid section fields.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 3)');
    const current = await client.query('SELECT * FROM sections WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rowCount) throw new HttpError(404, 'Section not found.');
    const next = { ...current.rows[0], ...body };
    if (!activeStates.includes(next.status)) throw new HttpError(400, 'Invalid section status.');
    const semester = positiveId(next.semester);
    if (semester > 20) throw new HttpError(400, 'semester must be between 1 and 20.');
    const capacity = positiveId(next.capacity);
    const enrolled = await client.query(
      "SELECT COUNT(*)::int AS total FROM students WHERE section_id=$1 AND status='ACTIVE'",
      [id]
    );
    if (capacity < enrolled.rows[0].total) {
      throw new HttpError(409, 'Section capacity cannot be lower than its current active student count.');
    }
    const result = await client.query(
      `UPDATE sections SET program_id=$1, academic_session_id=$2, semester=$3, name=$4,
       capacity=$5, status=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [positiveId(next.program_id), positiveId(next.academic_session_id), semester,
        requiredText(next.name, 'name', 40), capacity, next.status, id]
    );
    await writeAudit(req, 'UPDATE', 'sections', id, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Section updated successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listCourseAssignments(req, res) {
  const values = [];
  const clauses = [];
  for (const field of ['faculty_id', 'course_id', 'section_id', 'academic_session_id', 'semester', 'status']) {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      values.push(field === 'status' ? req.query[field] : positiveId(req.query[field], field));
      clauses.push(`ca.${field}=$${values.length}`);
    }
  }
  if (isFaculty(req)) {
    values.push(await ownFacultyId(req));
    clauses.push(`ca.faculty_id=$${values.length}`);
  } else if (isStudent(req)) {
    values.push(await ownStudentId(req));
    clauses.push(`EXISTS (SELECT 1 FROM students s WHERE s.id=$${values.length} AND s.section_id=ca.section_id)`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM course_assignments ca
    JOIN faculty f ON f.id=ca.faculty_id JOIN courses c ON c.id=ca.course_id
    JOIN sections s ON s.id=ca.section_id JOIN programs p ON p.id=ca.program_id
    JOIN academic_sessions a ON a.id=ca.academic_session_id
    LEFT JOIN classrooms r ON r.id=ca.classroom_id`;
  await sendPage(res, pool,
    `SELECT ca.*, f.first_name || ' ' || f.last_name AS faculty_name, c.course_code, c.name AS course_name,
      s.name AS section_name, p.name AS program_name, a.name AS academic_session_name,
      r.building AS classroom_building, r.room_number AS classroom_room ${from} ${where} ORDER BY c.course_code, s.name`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`, values, req.query);
}

export async function createCourseAssignment(req, res) {
  const body = bodyObject(req.body);
  requireKeys(body, ['faculty_id', 'course_id', 'section_id', 'academic_session_id', 'semester']);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const section = await client.query('SELECT * FROM sections WHERE id=$1 AND status=$2 FOR SHARE',
      [positiveId(body.section_id), 'ACTIVE']);
    if (!section.rowCount) throw new HttpError(400, 'An active section is required.');
    const semester = positiveId(body.semester);
    if (section.rows[0].academic_session_id !== Number(body.academic_session_id) ||
        section.rows[0].semester !== semester) throw new HttpError(400, 'Assignment session and semester must match its section.');
    const course = await client.query('SELECT program_id, semester FROM courses WHERE id=$1 AND status=$2',
      [positiveId(body.course_id), 'ACTIVE']);
    if (!course.rowCount || course.rows[0].program_id !== section.rows[0].program_id ||
        (course.rows[0].semester != null && course.rows[0].semester !== semester)) {
      throw new HttpError(400, 'Course must belong to the section program and semester.');
    }
    const faculty = await client.query("SELECT 1 FROM faculty WHERE id=$1 AND employment_status='ACTIVE'",
      [positiveId(body.faculty_id)]);
    if (!faculty.rowCount) throw new HttpError(400, 'An active faculty member is required.');
    if (body.classroom_id != null) {
      const room = await client.query("SELECT 1 FROM classrooms WHERE id=$1 AND status='ACTIVE'", [positiveId(body.classroom_id)]);
      if (!room.rowCount) throw new HttpError(400, 'An active classroom is required.');
    }
    const result = await client.query(
      `INSERT INTO course_assignments (program_id, faculty_id, course_id, section_id,
       academic_session_id, semester, classroom_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [section.rows[0].program_id, positiveId(body.faculty_id), positiveId(body.course_id),
        positiveId(body.section_id), positiveId(body.academic_session_id), semester,
        body.classroom_id == null ? null : positiveId(body.classroom_id), body.status || 'ACTIVE']
    );
    await writeAudit(req, 'CREATE', 'course_assignments', result.rows[0].id, {}, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Course assignment created successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCourseAssignment(req, res) {
  const id = positiveId(req.params.id);
  const body = bodyObject(req.body);
  const allowed = ['faculty_id', 'course_id', 'section_id', 'academic_session_id', 'semester', 'classroom_id', 'status'];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'Provide valid course-assignment fields.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 3)');
    const currentResult = await client.query('SELECT * FROM course_assignments WHERE id=$1 FOR UPDATE', [id]);
    if (!currentResult.rowCount) throw new HttpError(404, 'Course assignment not found.');
    const current = currentResult.rows[0];
    const next = { ...current, ...body };
    const sectionResult = await client.query(
      "SELECT program_id, academic_session_id, semester FROM sections WHERE id=$1 AND status='ACTIVE'",
      [positiveId(next.section_id)]
    );
    const section = sectionResult.rows[0];
    const semester = positiveId(next.semester);
    if (!section || section.academic_session_id !== Number(next.academic_session_id) ||
        section.semester !== semester) throw new HttpError(400, 'Assignment session and semester must match its active section.');
    const course = await client.query(
      "SELECT program_id, semester FROM courses WHERE id=$1 AND status='ACTIVE'",
      [positiveId(next.course_id)]
    );
    if (!course.rowCount || course.rows[0].program_id !== section.program_id ||
        (course.rows[0].semester != null && course.rows[0].semester !== semester)) {
      throw new HttpError(400, 'Course must belong to the section program and semester.');
    }
    const faculty = await client.query(
      "SELECT 1 FROM faculty WHERE id=$1 AND employment_status='ACTIVE'",
      [positiveId(next.faculty_id)]
    );
    if (!faculty.rowCount) throw new HttpError(400, 'An active faculty member is required.');
    if (!activeStates.includes(next.status)) throw new HttpError(400, 'Invalid assignment status.');
    if (next.classroom_id != null) {
      const room = await client.query(
        "SELECT 1 FROM classrooms WHERE id=$1 AND status='ACTIVE'",
        [positiveId(next.classroom_id)]
      );
      if (!room.rowCount) throw new HttpError(400, 'An active classroom is required.');
    }
    const assignmentChanged = ['faculty_id', 'course_id', 'section_id', 'academic_session_id', 'semester']
      .some((field) => Number(next[field]) !== Number(current[field])) ||
      (next.classroom_id == null ? null : Number(next.classroom_id)) !== current.classroom_id ||
      next.status !== current.status;
    if (assignmentChanged) {
      const hasSchedule = await client.query('SELECT 1 FROM timetable WHERE course_assignment_id=$1 LIMIT 1', [id]);
      if (hasSchedule.rowCount) {
        throw new HttpError(409, 'Delete this assignment timetable before changing its faculty, course, section, session, semester, classroom, or status.');
      }
    }
    const result = await client.query(
      `UPDATE course_assignments SET program_id=$1, faculty_id=$2, course_id=$3, section_id=$4,
       academic_session_id=$5, semester=$6, classroom_id=$7, status=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [section.program_id, positiveId(next.faculty_id), positiveId(next.course_id), positiveId(next.section_id),
        positiveId(next.academic_session_id), semester,
        next.classroom_id == null ? null : positiveId(next.classroom_id), next.status, id]
    );
    await writeAudit(req, 'UPDATE', 'course_assignments', id, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Course assignment updated successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listEnrollments(req, res) {
  const values = [];
  const clauses = [];
  for (const field of ['student_id', 'course_id', 'academic_session_id', 'semester_number', 'status']) {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      values.push(field === 'status' ? req.query[field] : positiveId(req.query[field], field));
      clauses.push(`e.${field}=$${values.length}`);
    }
  }
  if (isStudent(req)) {
    values.push(await ownStudentId(req));
    clauses.push(`e.student_id=$${values.length}`);
  } else if (isFaculty(req)) {
    values.push(await ownFacultyId(req));
    clauses.push(`EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.faculty_id=$${values.length} AND ca.course_id=e.course_id AND ca.academic_session_id=e.academic_session_id AND ca.semester=e.semester_number)`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = 'FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id LEFT JOIN academic_sessions a ON a.id=e.academic_session_id';
  await sendPage(res, pool,
    `SELECT e.*, s.first_name || ' ' || s.last_name AS student_name, s.registration_number,
      c.course_code, c.name AS course_name, a.name AS academic_session_name ${from} ${where} ORDER BY e.enrollment_date DESC, e.id DESC`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`, values, req.query);
}

export async function getEnrollment(req, res) {
  const enrollmentId = positiveId(req.params.id);
  const values = [enrollmentId];
  let scope = '';
  if (isStudent(req)) {
    values.push(await ownStudentId(req));
    scope = 'AND e.student_id=$2';
  } else if (isFaculty(req)) {
    values.push(await ownFacultyId(req));
    scope = `AND EXISTS (SELECT 1 FROM course_assignments ca
      WHERE ca.faculty_id=$2 AND ca.course_id=e.course_id
        AND ca.academic_session_id=e.academic_session_id AND ca.semester=e.semester_number)`;
  }
  const result = await pool.query(
    `SELECT e.*, s.registration_number, s.first_name || ' ' || s.last_name AS student_name,
      c.course_code, c.name AS course_name, a.name AS academic_session_name
     FROM enrollments e JOIN students s ON s.id=e.student_id
     JOIN courses c ON c.id=e.course_id LEFT JOIN academic_sessions a ON a.id=e.academic_session_id
     WHERE e.id=$1 ${scope}`,
    values
  );
  if (!result.rowCount) throw new HttpError(404, 'Enrollment not found.');
  res.json({ success: true, message: 'Enrollment fetched successfully.', data: result.rows[0] });
}

export async function createEnrollment(req, res) {
  const body = bodyObject(req.body);
  requireKeys(body, ['student_id', 'course_id', 'academic_session_id', 'semester']);
  const studentId = isStudent(req) ? await ownStudentId(req) : positiveId(body.student_id);
  if (isStudent(req) && body.student_id !== undefined && Number(body.student_id) !== studentId) {
    throw new HttpError(403, 'Students can enroll only themselves.');
  }
  const courseId = positiveId(body.course_id);
  const sessionId = positiveId(body.academic_session_id);
  const semester = positiveId(body.semester);
  const enrollmentDate = body.enrollment_date == null ? null : String(body.enrollment_date);
  if (enrollmentDate && (!/^\d{4}-\d{2}-\d{2}$/.test(enrollmentDate) ||
      Number.isNaN(Date.parse(`${enrollmentDate}T00:00:00Z`)) ||
      new Date(`${enrollmentDate}T00:00:00Z`).toISOString().slice(0, 10) !== enrollmentDate)) {
    throw new HttpError(400, 'enrollment_date must use YYYY-MM-DD.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const student = await client.query(
      `SELECT id, program_id, section_id, academic_session_id, semester, status
       FROM students WHERE id=$1 FOR UPDATE`,
      [studentId]
    );
    const record = student.rows[0];
    if (!record || record.status !== 'ACTIVE') throw new HttpError(400, 'An active student is required.');
    if (record.program_id == null || record.section_id == null ||
        (record.academic_session_id != null && record.academic_session_id !== sessionId) ||
        (record.semester != null && record.semester !== semester)) {
      throw new HttpError(400, 'Student program, section, session, and semester must be set consistently before enrollment.');
    }
    const assignment = await client.query(
      `SELECT 1 FROM course_assignments ca JOIN sections s ON s.id=ca.section_id
       WHERE ca.course_id=$1 AND ca.section_id=$2 AND ca.academic_session_id=$3
         AND ca.semester=$4 AND ca.status='ACTIVE' AND s.status='ACTIVE'`,
      [courseId, record.section_id, sessionId, semester]
    );
    if (!assignment.rowCount) throw new HttpError(400, 'Course is not assigned to the student section for this session and semester.');
    const result = await client.query(
      `INSERT INTO enrollments (student_id, course_id, semester, semester_number, academic_session_id, enrollment_date, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), 'enrolled') RETURNING *`,
      [studentId, courseId, String(semester), semester, sessionId, enrollmentDate]
    );
    await writeAudit(req, 'CREATE', 'enrollments', result.rows[0].id, {}, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Student enrolled successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEnrollment(req, res) {
  const enrollmentId = positiveId(req.params.id);
  const body = bodyObject(req.body);
  if (!['enrolled', 'completed', 'withdrawn'].includes(body.status) || Object.keys(body).some((key) => key !== 'status')) {
    throw new HttpError(400, 'status must be enrolled, completed, or withdrawn.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query('SELECT * FROM enrollments WHERE id=$1 FOR UPDATE', [enrollmentId]);
    if (!enrollment.rowCount) throw new HttpError(404, 'Enrollment not found.');
    if (isStudent(req) && enrollment.rows[0].student_id !== await ownStudentId(req, client)) {
      throw new HttpError(403, 'Students can update only their own enrollment.');
    }
    const result = await client.query(
      'UPDATE enrollments SET status=$1 WHERE id=$2 RETURNING *',
      [body.status, enrollmentId]
    );
    await writeAudit(req, 'UPDATE', 'enrollments', enrollmentId, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Enrollment updated successfully.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withdrawEnrollment(req, res) {
  const enrollmentId = positiveId(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE enrollments SET status='withdrawn' WHERE id=$1 RETURNING id`,
      [enrollmentId]
    );
    if (!result.rowCount) throw new HttpError(404, 'Enrollment not found.');
    await writeAudit(req, 'WITHDRAW', 'enrollments', enrollmentId, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Enrollment withdrawn successfully.', data: null });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listTimetable(req, res) {
  const values = [];
  const clauses = [];
  for (const field of ['classroom_id', 'day_of_week', 'academic_session_id', 'section_id', 'faculty_id']) {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      values.push(positiveId(req.query[field], field));
      const column = field === 'section_id' ? 'ca.section_id' :
        field === 'faculty_id' ? 'ca.faculty_id' : field === 'academic_session_id' ? 'ca.academic_session_id' : `t.${field}`;
      clauses.push(`${column}=$${values.length}`);
    }
  }
  if (isFaculty(req)) {
    values.push(await ownFacultyId(req));
    clauses.push(`ca.faculty_id=$${values.length}`);
  } else if (isStudent(req)) {
    values.push(await ownStudentId(req));
    clauses.push(`EXISTS (SELECT 1 FROM students st WHERE st.id=$${values.length} AND st.section_id=ca.section_id)`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `FROM timetable t JOIN course_assignments ca ON ca.id=t.course_assignment_id
    JOIN courses c ON c.id=ca.course_id JOIN sections s ON s.id=ca.section_id
    JOIN classrooms r ON r.id=t.classroom_id JOIN faculty f ON f.id=ca.faculty_id`;
  await sendPage(res, pool,
    `SELECT t.*, ca.course_id, ca.section_id, ca.faculty_id, ca.academic_session_id, ca.semester,
      c.course_code, c.name AS course_name, s.name AS section_name, r.building, r.room_number,
      f.first_name || ' ' || f.last_name AS faculty_name ${from} ${where} ORDER BY t.day_of_week, t.start_time`,
    values, `SELECT COUNT(*)::int AS total ${from} ${where}`, values, req.query);
}

async function saveTimetable(req, res, existingId = null) {
  const body = bodyObject(req.body);
  requireKeys(body, ['course_assignment_id', 'classroom_id', 'day_of_week', 'start_time', 'end_time']);
  const assignmentId = positiveId(body.course_assignment_id);
  const classroomId = positiveId(body.classroom_id);
  const day = positiveId(body.day_of_week);
  if (day > 7) throw new HttpError(400, 'day_of_week must be between 1 and 7.');
  const start = requiredText(body.start_time, 'start_time', 8);
  const end = requiredText(body.end_time, 'end_time', 8);
  if (!validTimeRange(start, end)) {
    throw new HttpError(400, 'Times must use HH:MM and end_time must be later than start_time.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 3)');
    const assignmentResult = await client.query(
      `SELECT ca.*, r.capacity FROM course_assignments ca
       JOIN courses c ON c.id=ca.course_id
       JOIN classrooms r ON r.id=$2 AND r.status='ACTIVE'
       WHERE ca.id=$1 AND ca.status='ACTIVE' FOR UPDATE`,
      [assignmentId, classroomId]
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) throw new HttpError(400, 'An active course assignment and classroom are required.');
    if (assignment.classroom_id != null && assignment.classroom_id !== classroomId) {
      throw new HttpError(400, 'Timetable classroom must match the classroom assigned to this course when one is specified.');
    }
    await client.query('SELECT id FROM sections WHERE id=$1 FOR UPDATE', [assignment.section_id]);
    const enrollmentCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM students WHERE section_id=$1 AND status='ACTIVE'",
      [assignment.section_id]
    );
    if (Number(assignment.capacity) < enrollmentCount.rows[0].count) {
      throw new HttpError(400, 'Classroom capacity is below the course enrollment capacity.');
    }
    const conflict = await client.query(
      `SELECT t.id, t.day_of_week, t.start_time::text AS start_time, t.end_time::text AS end_time
       FROM timetable t JOIN course_assignments other ON other.id=t.course_assignment_id
       JOIN academic_sessions other_session ON other_session.id=other.academic_session_id
       JOIN academic_sessions target_session ON target_session.id=$6
       WHERE t.day_of_week=$1
         AND ($2::integer IS NULL OR t.id <> $2)
         AND (t.classroom_id=$3 OR other.faculty_id=$4 OR other.section_id=$5)
         AND other.status='ACTIVE'
         AND target_session.start_date <= other_session.end_date
         AND other_session.start_date <= target_session.end_date
      `,
      [day, existingId, classroomId, assignment.faculty_id, assignment.section_id, assignment.academic_session_id]
    );
    if (conflict.rows.some((slot) => timeRangeOverlaps(
      { day_of_week: day, start_time: start, end_time: end }, slot
    ))) {
      throw new HttpError(409, 'The room, faculty member, or section already has a class during that time.');
    }
    const values = [assignmentId, classroomId, day, start, end];
    const result = existingId
      ? await client.query(
        `UPDATE timetable SET course_assignment_id=$1, classroom_id=$2, day_of_week=$3,
         start_time=$4, end_time=$5, updated_at=NOW() WHERE id=$6 RETURNING *`,
        [...values, existingId])
      : await client.query(
        `INSERT INTO timetable (course_assignment_id, classroom_id, day_of_week, start_time, end_time)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`, values);
    if (existingId && !result.rowCount) throw new HttpError(404, 'Timetable slot not found.');
    await writeAudit(req, existingId ? 'UPDATE' : 'CREATE', 'timetable', result.rows[0].id, {}, client);
    await client.query('COMMIT');
    res.status(existingId ? 200 : 201).json({
      success: true, message: `Timetable slot ${existingId ? 'updated' : 'created'} successfully.`, data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const createTimetableSlot = (req, res) => saveTimetable(req, res);
export const updateTimetableSlot = (req, res) => saveTimetable(req, res, positiveId(req.params.id));

export async function deleteTimetableSlot(req, res) {
  const id = positiveId(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 3)');
    const deleted = await client.query('DELETE FROM timetable WHERE id=$1 RETURNING id', [id]);
    if (!deleted.rowCount) throw new HttpError(404, 'Timetable slot not found.');
    await writeAudit(req, 'DELETE', 'timetable', id, {}, client);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Timetable slot deleted successfully.', data: null });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

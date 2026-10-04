import { pool } from '../config/database.js';
import { resources } from '../constants/resources.js';
import { validateResourceBody } from '../validators/resourceValidators.js';
import {
  createRecord
} from '../repositories/resourceRepository.js';
import { validateResourceRelationships } from '../services/resourceService.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';
import { parseCsv, serializeCsv } from '../utils/csv.js';

const importable = new Set(['students', 'faculty', 'courses']);
const exportable = new Set(['students', 'attendance', 'exam-results', 'fees', 'payments']);

function can(req, permission) {
  return req.user.role === 'SUPER_ADMIN' || req.user.permissions.includes(permission);
}

function positiveFilter(value, name) {
  if (value === undefined || value === '') return undefined;
  if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647) {
    throw new HttpError(400, `${name} must be a positive integer.`);
  }
  return Number(value);
}

function dateFilter(value, name) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${name} must be a valid date (YYYY-MM-DD).`);
  }
  return value;
}

function csvRowValues(resource, row) {
  const values = {};
  for (const [field, rawValue] of Object.entries(row)) {
    if (!Object.hasOwn(resource.fields, field)) throw new HttpError(400, `Unknown field: ${field}.`);
    const rule = resource.fields[field];
    const value = rawValue.trim();
    if (!value && rule.nullable) {
      values[field] = null;
    } else if (!value && !rule.required) {
      continue;
    } else if (rule.type === 'integer' || rule.type === 'number') {
      if (!value) {
        values[field] = value;
      } else if (rule.type === 'integer' && !/^\d+$/.test(value)) {
        throw new HttpError(400, `${field} must be an integer.`);
      } else {
        values[field] = Number(value);
      }
    } else if (rule.type === 'boolean') {
      if (value !== 'true' && value !== 'false') throw new HttpError(400, `${field} must be true or false.`);
      values[field] = value === 'true';
    } else {
      values[field] = value;
    }
  }
  return values;
}

function rowFailure(error) {
  if (error.code === '23505') return 'A record with a duplicate unique value already exists.';
  if (error.code === '23503') return 'A referenced record does not exist.';
  if (error.code === '23514') return 'The row violates a database validation rule.';
  if (error instanceof HttpError) return error.message;
  return 'The row could not be imported.';
}

export async function importCsv(req, res) {
  const entity = req.params.entity;
  if (!importable.has(entity)) throw new HttpError(404, 'Unsupported import entity.');
  if (typeof req.body !== 'string') throw new HttpError(400, 'Provide the CSV body as text/csv.');
  const parsed = parseCsv(req.body, { maximumRows: 1000, maximumColumns: 80 });
  const resource = resources[entity];
  const fields = new Set(parsed.flatMap(({ values }) => Object.keys(values)));
  const requiredFields = Object.entries(resource.fields)
    .filter(([, rule]) => rule.required)
    .map(([name]) => name);
  const missing = requiredFields.filter((field) => !fields.has(field));
  if (missing.length) throw new HttpError(400, `CSV is missing required columns: ${missing.join(', ')}.`);

  const client = await pool.connect();
  const errors = [];
  let imported = 0;
  try {
    await client.query('BEGIN');
    for (const row of parsed) {
      const savepoint = `import_row_${row.rowNumber}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
        const values = validateResourceBody(resource, csvRowValues(resource, row.values));
        await validateResourceRelationships(entity, values, undefined, client);
        const record = await createRecord(resource, values, client);
        await writeAudit(req, 'IMPORT', resource.table, record.id, { row: row.rowNumber }, client);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        imported += 1;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        errors.push({ row: row.rowNumber, message: rowFailure(error) });
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.status(errors.length ? 207 : 201).json({
    success: errors.length === 0,
    message: `Imported ${imported} of ${parsed.length} ${entity}.`,
    data: { total: parsed.length, imported, failed: errors.length, errors }
  });
}

function addFilter(clauses, values, sql, value) {
  if (value === undefined) return;
  values.push(value);
  clauses.push(sql.replace('?', `$${values.length}`));
}

function csvResponse(res, name, headers, rows) {
  const csv = serializeCsv(headers, rows);
  res.status(200);
  res.type('text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('X-Exported-Count', String(rows.length));
  res.send(`\uFEFF${csv}`);
}

export async function exportCsv(req, res) {
  const report = req.params.report;
  if (!exportable.has(report)) throw new HttpError(404, 'Unsupported export report.');
  if (req.user.role === 'STUDENT') throw new HttpError(403, 'CSV exports are not available to student accounts.');
  if (req.user.role === 'ACCOUNTANT' && !['fees', 'payments'].includes(report)) {
    throw new HttpError(403, 'Accountants can export only financial reports.');
  }
  if (req.user.role === 'FACULTY' && !['attendance', 'exam-results'].includes(report)) {
    throw new HttpError(403, 'Faculty can export only assigned academic reports.');
  }

  const values = [];
  const clauses = [];
  const department = positiveFilter(req.query.department_id, 'department_id');
  const program = positiveFilter(req.query.program_id, 'program_id');
  const session = positiveFilter(req.query.academic_session_id, 'academic_session_id');
  const semester = positiveFilter(req.query.semester, 'semester');
  const section = positiveFilter(req.query.section_id, 'section_id');
  const from = dateFilter(req.query.from, 'from');
  const to = dateFilter(req.query.to, 'to');
  if (from && to && from > to) throw new HttpError(400, 'from must not be after to.');
  let sql;
  let headers;

  if (report === 'students') {
    if (!can(req, 'students.read')) throw new HttpError(403, 'You cannot export student records.');
    addFilter(clauses, values, 's.department_id = ?', department);
    addFilter(clauses, values, 's.program_id = ?', program);
    addFilter(clauses, values, 's.academic_session_id = ?', session);
    addFilter(clauses, values, 's.semester = ?', semester);
    sql = `SELECT s.registration_number, s.student_id, s.first_name, s.last_name, s.email,
      d.name AS department, p.name AS program, sec.name AS section, s.semester, s.status
      FROM students s JOIN departments d ON d.id=s.department_id
      LEFT JOIN programs p ON p.id=s.program_id LEFT JOIN sections sec ON sec.id=s.section_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY s.registration_number LIMIT 50000`;
    headers = ['registration_number', 'student_id', 'first_name', 'last_name', 'email', 'department', 'program', 'section', 'semester', 'status'];
  } else if (report === 'attendance') {
    if (!can(req, 'attendance.view')) throw new HttpError(403, 'You cannot export attendance records.');
    addFilter(clauses, values, 'ca.academic_session_id = ?', session);
    addFilter(clauses, values, 'ca.semester = ?', semester);
    addFilter(clauses, values, 'ca.section_id = ?', section);
    addFilter(clauses, values, 'a.attendance_date >= ?', from);
    addFilter(clauses, values, 'a.attendance_date <= ?', to);
    if (req.user.role === 'FACULTY') {
      values.push(req.user.id);
      clauses.push(`EXISTS (SELECT 1 FROM faculty own_f WHERE own_f.user_id=$${values.length} AND own_f.id=ca.faculty_id)`);
    }
    sql = `SELECT s.registration_number, s.first_name, s.last_name, c.course_code, sec.name AS section,
      a.attendance_date, ar.status, ar.note
      FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id
      JOIN course_assignments ca ON ca.id=a.course_assignment_id JOIN students s ON s.id=ar.student_id
      JOIN courses c ON c.id=ca.course_id JOIN sections sec ON sec.id=ca.section_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY a.attendance_date DESC, s.registration_number LIMIT 50000`;
    headers = ['registration_number', 'first_name', 'last_name', 'course_code', 'section', 'attendance_date', 'status', 'note'];
  } else if (report === 'exam-results') {
    if (!can(req, 'grades.view')) throw new HttpError(403, 'You cannot export exam results.');
    addFilter(clauses, values, 'ca.academic_session_id = ?', session);
    addFilter(clauses, values, 'ca.semester = ?', semester);
    addFilter(clauses, values, 'ca.section_id = ?', section);
    addFilter(clauses, values, 'e.exam_date >= ?', from);
    addFilter(clauses, values, 'e.exam_date <= ?', to);
    if (req.user.role === 'FACULTY') {
      values.push(req.user.id);
      clauses.push(`EXISTS (SELECT 1 FROM faculty own_f WHERE own_f.user_id=$${values.length} AND own_f.id=ca.faculty_id)`);
    }
    sql = `SELECT s.registration_number, s.first_name, s.last_name, c.course_code, sec.name AS section,
      e.name AS exam, e.exam_type, e.exam_date, er.marks_obtained, e.maximum_marks,
      er.percentage, er.letter_grade, er.grade_point
      FROM exam_results er JOIN exams e ON e.id=er.exam_id
      JOIN course_assignments ca ON ca.id=e.course_assignment_id JOIN students s ON s.id=er.student_id
      JOIN courses c ON c.id=ca.course_id JOIN sections sec ON sec.id=ca.section_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY e.exam_date DESC, s.registration_number LIMIT 50000`;
    headers = ['registration_number', 'first_name', 'last_name', 'course_code', 'section', 'exam', 'exam_type', 'exam_date', 'marks_obtained', 'maximum_marks', 'percentage', 'letter_grade', 'grade_point'];
  } else if (report === 'fees') {
    if (!can(req, 'fees.view')) throw new HttpError(403, 'You cannot export fee records.');
    addFilter(clauses, values, 'f.academic_session_id = ?', session);
    addFilter(clauses, values, 'f.semester = ?', semester);
    addFilter(clauses, values, 's.department_id = ?', department);
    addFilter(clauses, values, 's.program_id = ?', program);
    addFilter(clauses, values, 'f.due_date >= ?', from);
    addFilter(clauses, values, 'f.due_date <= ?', to);
    sql = `SELECT s.registration_number, s.first_name, s.last_name, f.fee_type, f.total_amount,
      f.discount, f.scholarship, f.late_fee, f.paid_amount, f.remaining_amount, f.due_date, f.status
      FROM student_fees f JOIN students s ON s.id=f.student_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY f.due_date, s.registration_number LIMIT 50000`;
    headers = ['registration_number', 'first_name', 'last_name', 'fee_type', 'total_amount', 'discount', 'scholarship', 'late_fee', 'paid_amount', 'remaining_amount', 'due_date', 'status'];
  } else {
    if (!can(req, 'payments.view')) throw new HttpError(403, 'You cannot export payment records.');
    addFilter(clauses, values, 'p.payment_date >= ?::date', from);
    addFilter(clauses, values, 'p.payment_date < (?::date + INTERVAL \'1 day\')', to);
    sql = `SELECT p.receipt_number, s.registration_number, s.first_name, s.last_name,
      f.fee_type, p.amount, p.payment_method, p.transaction_reference, p.payment_date
      FROM payments p JOIN students s ON s.id=p.student_id JOIN student_fees f ON f.id=p.fee_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY p.payment_date DESC LIMIT 50000`;
    headers = ['receipt_number', 'registration_number', 'first_name', 'last_name', 'fee_type', 'amount', 'payment_method', 'transaction_reference', 'payment_date'];
  }

  const result = await pool.query(sql, values);
  csvResponse(res, report, headers, result.rows);
}

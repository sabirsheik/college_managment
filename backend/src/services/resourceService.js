import { pool } from '../config/database.js';
import { resources } from '../constants/resources.js';
import { HttpError } from '../utils/httpError.js';
import {
  createRecord, deleteRecord, getRecord, listRecords, updateRecord
} from '../repositories/resourceRepository.js';
import { validateResourceBody } from '../validators/resourceValidators.js';
import { writeAudit } from '../utils/audit.js';

export function getResource(name) {
  const resource = Object.hasOwn(resources, name) ? resources[name] : undefined;
  if (!resource) throw new HttpError(404, 'Unknown resource.');
  return resource;
}

async function assertSessionDates(values, excludeId, db = pool) {
  const { start_date: startDate, end_date: endDate } = values;
  if (startDate && endDate && endDate < startDate) {
    throw new HttpError(400, 'Session end date cannot be before its start date.');
  }
  if (values.is_current && values.status !== 'ACTIVE') {
    throw new HttpError(400, 'The current academic session must be active.');
  }
  if (!startDate || !endDate) return;
  const result = await db.query(
    `SELECT id FROM academic_sessions
     WHERE start_date <= $1::date AND end_date >= $2::date
       AND ($3::integer IS NULL OR id <> $3)
     LIMIT 1`,
    [endDate, startDate, excludeId ?? null]
  );
  if (result.rowCount) throw new HttpError(409, 'Academic sessions cannot overlap.');
}

function ownFields(resource, body) {
  for (const key of Object.keys(body || {})) {
    if (!Object.hasOwn(resource.fields, key)) throw new HttpError(400, `Unknown field: ${key}.`);
  }
}

export const listResourceRecords = (name, query) => listRecords(getResource(name), query);
export const getResourceRecord = (name, id) => getRecord(getResource(name), id);

async function validateRelationships(name, values, id, db = pool) {
  if (name === 'students' || name === 'courses' || name === 'faculty') {
    const current = id
      ? await db.query(`SELECT * FROM ${resources[name].table} WHERE id = $1`, [id])
      : { rows: [] };
    if (id && !current.rowCount) throw new HttpError(404, 'Record not found.');
    const departmentId = Object.hasOwn(values, 'department_id') ? values.department_id : current.rows[0]?.department_id;
    const programId = Object.hasOwn(values, 'program_id') ? values.program_id : current.rows[0]?.program_id;
    if ((name === 'students' || name === 'courses') && programId != null) {
      const result = await db.query(
        'SELECT 1 FROM programs WHERE id = $1 AND department_id = $2',
        [programId, departmentId]
      );
      if (!result.rowCount) throw new HttpError(400, 'The selected program must belong to the selected department.');
    }
    if (name === 'students' || name === 'faculty') {
      const userId = Object.hasOwn(values, 'user_id') ? values.user_id : current.rows[0]?.user_id;
      const linkChanged = Object.hasOwn(values, 'user_id') ||
        (Object.hasOwn(values, 'email') && userId != null);
      if (linkChanged && userId != null) {
        const email = values.email ?? current.rows[0]?.email;
        const role = name === 'students' ? 'STUDENT' : 'FACULTY';
        const result = await db.query(
          `SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.id = $1 AND LOWER(u.email) = LOWER($2) AND u.is_active AND r.name = $3`,
          [userId, email, role]
        );
        if (!result.rowCount) {
          throw new HttpError(400, `Linked account must be an active ${role} user with the same email address.`);
        }
      }
    }
  }
  if (name === 'departments' && values.head_of_department != null) {
    if (!id) throw new HttpError(400, 'Assign the department head after creating the department.');
    const result = await db.query(
      'SELECT 1 FROM faculty WHERE id = $1 AND department_id = $2',
      [values.head_of_department, id]
    );
    if (!result.rowCount) throw new HttpError(400, 'Department head must be a faculty member in this department.');
  }
  if (name === 'students') {
    const currentResult = id
      ? await db.query('SELECT section_id, status FROM students WHERE id=$1', [id])
      : { rows: [] };
    const sectionId = Object.hasOwn(values, 'section_id')
      ? values.section_id
      : currentResult.rows[0]?.section_id;
    const status = Object.hasOwn(values, 'status')
      ? values.status
      : currentResult.rows[0]?.status;
    if (sectionId != null && status === 'ACTIVE') {
      const section = await db.query('SELECT capacity FROM sections WHERE id=$1 FOR UPDATE', [sectionId]);
      if (!section.rowCount) throw new HttpError(400, 'The selected academic section does not exist.');
      const count = await db.query(
        "SELECT COUNT(*)::int AS total FROM students WHERE section_id=$1 AND status='ACTIVE' AND ($2::integer IS NULL OR id<>$2)",
        [sectionId, id ?? null]
      );
      if (count.rows[0].total >= section.rows[0].capacity) {
        throw new HttpError(409, 'The selected academic section is at capacity.');
      }
      const scheduledRoom = await db.query(
        `SELECT r.capacity FROM timetable t
         JOIN course_assignments ca ON ca.id=t.course_assignment_id
         JOIN classrooms r ON r.id=t.classroom_id
         WHERE ca.section_id=$1 AND ca.status='ACTIVE' AND r.status='ACTIVE'
         ORDER BY r.capacity LIMIT 1`,
        [sectionId]
      );
      if (scheduledRoom.rowCount && count.rows[0].total + 1 > scheduledRoom.rows[0].capacity) {
        throw new HttpError(409, 'The selected academic section is at the scheduled classroom capacity.');
      }
    }
  }
}

export async function createResourceRecord(name, body, req) {
  const resource = getResource(name);
  ownFields(resource, body);
  const values = validateResourceBody(resource, body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (name === 'academic-sessions') {
      await client.query('SELECT pg_advisory_xact_lock(7351, 2)');
      await assertSessionDates(values, null, client);
      if (values.is_current) await client.query('UPDATE academic_sessions SET is_current = FALSE WHERE is_current');
    }
    await validateRelationships(name, values, undefined, client);
    const record = await createRecord(resource, values, client);
    await writeAudit(req, 'CREATE', resource.table, record.id, {}, client);
    await client.query('COMMIT');
    return record;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateResourceRecord(name, id, body, req) {
  const resource = getResource(name);
  ownFields(resource, body);
  const values = validateResourceBody(resource, body, true);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let current;
    if (name === 'academic-sessions') {
      await client.query('SELECT pg_advisory_xact_lock(7351, 2)');
      const currentResult = await client.query('SELECT * FROM academic_sessions WHERE id = $1 FOR UPDATE', [id]);
      if (!currentResult.rowCount) throw new HttpError(404, 'Record not found.');
      current = currentResult.rows[0];
      await assertSessionDates({ ...current, ...values }, id, client);
      if (values.is_current) {
        await client.query('UPDATE academic_sessions SET is_current = FALSE WHERE is_current AND id <> $1', [id]);
      }
    } else {
      current = await getRecord(resource, id, client);
    }
    await validateRelationships(name, values, id, client);
    const record = await updateRecord(resource, id, values, client);
    const action = values.status === 'ACTIVE' ? 'ACTIVATE'
      : values.status === 'INACTIVE' ? 'DEACTIVATE' : 'UPDATE';
    await writeAudit(req, action, resource.table, id, {}, client);
    await client.query('COMMIT');
    return record;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteResourceRecord(name, id, req) {
  const resource = getResource(name);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteRecord(resource, id, client);
    await writeAudit(req, 'DELETE', resource.table, id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

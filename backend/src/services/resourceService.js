import { pool } from '../config/database.js';
import { resources } from '../constants/resources.js';
import { HttpError } from '../utils/httpError.js';
import {
  createRecord, deleteRecord, getRecord, listRecords, updateRecord
} from '../repositories/resourceRepository.js';
import { validateResourceBody } from '../validators/resourceValidators.js';

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

async function validateRelationships(name, values, id) {
  if (name === 'students' || name === 'courses') {
    const current = id
      ? await pool.query(`SELECT department_id, program_id FROM ${resources[name].table} WHERE id = $1`, [id])
      : { rows: [] };
    if (id && !current.rowCount) throw new HttpError(404, 'Record not found.');
    const departmentId = values.department_id ?? current.rows[0]?.department_id;
    const programId = values.program_id ?? current.rows[0]?.program_id;
    if (programId != null) {
      const result = await pool.query(
        'SELECT 1 FROM programs WHERE id = $1 AND department_id = $2',
        [programId, departmentId]
      );
      if (!result.rowCount) throw new HttpError(400, 'The selected program must belong to the selected department.');
    }
  }
  if (name === 'departments' && values.head_of_department != null) {
    if (!id) throw new HttpError(400, 'Assign the department head after creating the department.');
    const result = await pool.query(
      'SELECT 1 FROM faculty WHERE id = $1 AND department_id = $2',
      [values.head_of_department, id]
    );
    if (!result.rowCount) throw new HttpError(400, 'Department head must be a faculty member in this department.');
  }
}

export async function createResourceRecord(name, body) {
  const resource = getResource(name);
  ownFields(resource, body);
  const values = validateResourceBody(resource, body);
  await validateRelationships(name, values);
  if (name !== 'academic-sessions') return createRecord(resource, values);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 2)');
    await assertSessionDates(values, null, client);
    if (values.is_current) await client.query('UPDATE academic_sessions SET is_current = FALSE WHERE is_current');
    const keys = Object.keys(values);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const result = await client.query(
      `INSERT INTO academic_sessions (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      keys.map((key) => values[key])
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateResourceRecord(name, id, body) {
  const resource = getResource(name);
  ownFields(resource, body);
  const values = validateResourceBody(resource, body, true);
  await validateRelationships(name, values, id);
  if (name !== 'academic-sessions') return updateRecord(resource, id, values);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351, 2)');
    const currentResult = await client.query('SELECT * FROM academic_sessions WHERE id = $1 FOR UPDATE', [id]);
    if (!currentResult.rowCount) throw new HttpError(404, 'Record not found.');
    const current = currentResult.rows[0];
    await assertSessionDates({ ...current, ...values }, id, client);
    if (values.is_current) {
      await client.query('UPDATE academic_sessions SET is_current = FALSE WHERE is_current AND id <> $1', [id]);
    }
    const keys = Object.keys(values);
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const result = await client.query(
      `UPDATE academic_sessions SET ${assignments}, updated_at = NOW()
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((key) => values[key]), id]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export const deleteResourceRecord = (name, id) => deleteRecord(getResource(name), id);

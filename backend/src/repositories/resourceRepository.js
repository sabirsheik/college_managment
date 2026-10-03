import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';

function buildWhere(resource, query) {
  const conditions = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  };

  if (query.q) {
    values.push(`%${query.q}%`);
    const placeholder = `$${values.length}`;
    conditions.push(`(${resource.searchFields.map((field) => `r.${field} ILIKE ${placeholder}`).join(' OR ')})`);
  }

  for (const field of resource.filterFields) {
    const value = query[field];
    if (value === undefined || value === '') continue;
    if (field.endsWith('_id') || field === 'semester') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) throw new HttpError(400, `Invalid ${field} filter.`);
      add(`r.${field} = ?`, parsed);
    } else if (field === 'is_current') {
      if (value !== 'true' && value !== 'false') throw new HttpError(400, 'Invalid is_current filter.');
      add(`r.${field} = ?`, value === 'true');
    } else {
      add(`r.${field} = ?`, value);
    }
  }
  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

export async function listRecords(resource, query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page and limit must be valid integers.');
  }
  const sort = resource.sortFields.includes(query.sort) ? query.sort : 'created_at';
  const order = query.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const { clause, values } = buildWhere(resource, query);
  const extra = resource.labels ? `, ${resource.labels}` : '';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${resource.table} r ${resource.joins} ${clause}`,
    values
  );
  const rows = await pool.query(
    `SELECT r.*${extra} FROM ${resource.table} r ${resource.joins} ${clause}
     ORDER BY r.${sort} ${order}, r.id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  const total = count.rows[0].total;
  return {
    data: rows.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
}

export async function getRecord(resource, id, db = pool) {
  const extra = resource.labels ? `, ${resource.labels}` : '';
  const result = await db.query(
    `SELECT r.*${extra} FROM ${resource.table} r ${resource.joins} WHERE r.id = $1`,
    [id]
  );
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
  return result.rows[0];
}

function mapValues(resource, input) {
  const values = { ...input };
  for (const [source, targets] of Object.entries(resource.writeMap)) {
    for (const target of targets) values[target] = values[source];
  }
  return values;
}

export async function createRecord(resource, input, db = pool) {
  const values = mapValues(resource, input);
  if (resource.table === 'students' || resource.table === 'faculty') {
    const sequence = resource.table;
    const { rows } = await db.query(
      `SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id`,
      [sequence]
    );
    values.id = rows[0].id;
    const identifier = `${resource.table === 'students' ? 'STU' : 'EMP'}-${String(values.id).padStart(6, '0')}`;
    if (resource.table === 'students') {
      values.student_id = identifier;
      values.student_number = values.student_number || identifier;
      values.enrollment_year = new Date().getUTCFullYear();
    } else {
      values.employee_id = identifier;
    }
  }
  const insertKeys = Object.keys(values);
  const placeholders = insertKeys.map((_, index) => `$${index + 1}`).join(', ');
  const result = await db.query(
    `INSERT INTO ${resource.table} (${insertKeys.join(', ')})
     VALUES (${placeholders}) RETURNING *`,
    insertKeys.map((key) => values[key])
  );
  return result.rows[0];
}

export async function updateRecord(resource, id, input, db = pool) {
  const values = mapValues(resource, input);
  const keys = Object.keys(values);
  const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const result = await db.query(
    `UPDATE ${resource.table} SET ${assignments}${resource.table === 'enrollments' ? '' : ', updated_at = NOW()'}
     WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((key) => values[key]), id]
  );
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
  return result.rows[0];
}

export async function deleteRecord(resource, id, db = pool) {
  const result = await db.query(
    `DELETE FROM ${resource.table} WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!result.rowCount) throw new HttpError(404, 'Record not found.');
}

import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

const userColumns = `u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
  u.last_login_at, u.created_at, u.updated_at, r.name AS role`;

function idParam(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(400, 'User ID must be a positive integer.');
  }
  return Number(value);
}

function pageParams(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 100.');
  }
  return { page, limit };
}

function validatePerson(body, partial = false) {
  const fields = ['email', 'first_name', 'last_name', 'phone', 'role', 'is_active'];
  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) throw new HttpError(400, `Unknown field: ${key}.`);
  }
  const output = {};
  for (const key of ['email', 'first_name', 'last_name']) {
    if (body[key] === undefined && partial) continue;
    if (typeof body[key] !== 'string' || !body[key].trim()) throw new HttpError(400, `${key} is required.`);
    const value = body[key].trim();
    const max = key === 'email' ? 254 : 80;
    if (value.length > max) throw new HttpError(400, `${key} is too long.`);
    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new HttpError(400, 'email must be a valid email address.');
    }
    output[key] = key === 'email' ? value.toLowerCase() : value;
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 30)) {
      throw new HttpError(400, 'phone must be at most 30 characters.');
    }
    output.phone = body.phone?.trim() || null;
  }
  if (body.role !== undefined || !partial) {
    if (typeof body.role !== 'string' || !/^[A-Z][A-Z0-9_]{1,39}$/.test(body.role)) {
      throw new HttpError(400, 'role must be a valid role name.');
    }
    output.role = body.role;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') throw new HttpError(400, 'is_active must be true or false.');
    output.is_active = body.is_active;
  }
  if (!Object.keys(output).length) throw new HttpError(400, 'Provide at least one field to update.');
  return output;
}

async function roleId(role, client = pool) {
  const result = await client.query('SELECT id FROM roles WHERE name = $1', [role]);
  if (!result.rowCount) throw new HttpError(400, 'Role is not configured.');
  return result.rows[0].id;
}

export async function listUsers(req, res) {
  const { page, limit } = pageParams(req.query);
  const values = [];
  const where = [];
  const bind = (value) => { values.push(value); return `$${values.length}`; };
  if (req.query.q) {
    const query = bind(`%${String(req.query.q).slice(0, 100)}%`);
    where.push(`(u.email ILIKE ${query} OR u.first_name ILIKE ${query} OR u.last_name ILIKE ${query})`);
  }
  if (req.query.role) {
    if (typeof req.query.role !== 'string' || !/^[A-Z][A-Z0-9_]{1,39}$/.test(req.query.role)) {
      throw new HttpError(400, 'Unknown role filter.');
    }
    where.push(`r.name = ${bind(req.query.role)}`);
  }
  if (req.query.active !== undefined) {
    if (req.query.active !== 'true' && req.query.active !== 'false') throw new HttpError(400, 'active must be true or false.');
    where.push(`u.is_active = ${bind(req.query.active === 'true')}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumns = {
    created_at: 'u.created_at',
    email: 'u.email',
    first_name: 'u.first_name',
    last_name: 'u.last_name',
    role: 'r.name',
    last_login_at: 'u.last_login_at'
  };
  const sort = sortColumns[req.query.sort] ? req.query.sort : 'created_at';
  const order = req.query.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users u JOIN roles r ON r.id = u.role_id ${clause}`,
    values
  );
  const result = await pool.query(
    `SELECT ${userColumns} FROM users u JOIN roles r ON r.id = u.role_id ${clause}
     ORDER BY ${sortColumns[sort]} ${order}, u.id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  const total = count.rows[0].total;
  res.json({
    success: true,
    message: 'Users fetched successfully.',
    data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

export async function getUser(req, res) {
  const result = await pool.query(
    `SELECT ${userColumns} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [idParam(req.params.id)]
  );
  if (!result.rowCount) throw new HttpError(404, 'User not found.');
  res.json({ success: true, message: 'User fetched successfully.', data: result.rows[0] });
}

export async function createUser(req, res) {
  const { password, ...personFields } = req.body || {};
  const fields = validatePerson(personFields);
  if (fields.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Only a SUPER_ADMIN can create another SUPER_ADMIN.');
  }
  if (typeof password !== 'string' || password.length < 12) {
    throw new HttpError(400, 'password must be at least 12 characters.');
  }
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, first_name, last_name, phone, is_active, created_at`,
      [fields.email, hash, fields.first_name, fields.last_name, fields.phone || null, await roleId(fields.role, client), fields.is_active ?? true]
    );
    await writeAudit(req, 'CREATE', 'USER', result.rows[0].id, { role: fields.role }, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json({
    success: true, message: 'User created successfully.',
    data: { ...result.rows[0], role: fields.role }
  });
}

export async function updateUser(req, res) {
  const id = idParam(req.params.id);
  const fields = validatePerson(req.body || {}, true);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT u.id, u.is_active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id]
    );
    if (!current.rowCount) throw new HttpError(404, 'User not found.');

    const losingAdmin = current.rows[0].role === 'SUPER_ADMIN' &&
      (fields.is_active === false || (fields.role && fields.role !== 'SUPER_ADMIN'));
    if (losingAdmin && req.user.role !== 'SUPER_ADMIN') {
      throw new HttpError(403, 'Only a SUPER_ADMIN can reassign or deactivate a SUPER_ADMIN.');
    }
    if (fields.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new HttpError(403, 'Only a SUPER_ADMIN can assign the SUPER_ADMIN role.');
    }
    if (losingAdmin) {
      await client.query('SELECT pg_advisory_xact_lock(7351, 1)');
      await assertNotLastSuperAdmin(id, client);
    }

    const assignments = [];
    const values = [];
    for (const key of ['email', 'first_name', 'last_name', 'phone', 'is_active']) {
      if (fields[key] !== undefined) {
        values.push(fields[key]);
        assignments.push(`${key} = $${values.length}`);
      }
    }
    if (fields.role) {
      values.push(await roleId(fields.role, client));
      assignments.push(`role_id = $${values.length}`);
    }
    values.push(id);
    const result = await client.query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, email, first_name, last_name, phone, is_active, created_at, updated_at`,
      values
    );
    await writeAudit(req, fields.is_active === false ? 'DEACTIVATE' : 'UPDATE', 'USER', id, {}, client);
    await client.query('COMMIT');
    res.json({
      success: true, message: 'User updated successfully.',
      data: { ...result.rows[0], role: fields.role || current.rows[0].role }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function assertNotLastSuperAdmin(id, client = pool) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'SUPER_ADMIN' AND u.is_active AND u.id <> $1`,
    [id]
  );
  if (result.rows[0].total === 0) throw new HttpError(409, 'The last active SUPER_ADMIN cannot be deactivated or reassigned.');
}

export async function deactivateUser(req, res) {
  const id = idParam(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
    `SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.is_active`,
    [id]
    );
    if (!current.rowCount) throw new HttpError(404, 'Active user not found.');
    if (current.rows[0].role === 'SUPER_ADMIN') {
      if (req.user.role !== 'SUPER_ADMIN') {
        throw new HttpError(403, 'Only a SUPER_ADMIN can deactivate another SUPER_ADMIN.');
      }
      await client.query('SELECT pg_advisory_xact_lock(7351, 1)');
      await assertNotLastSuperAdmin(id, client);
    }
    await client.query('UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
    await writeAudit(req, 'DEACTIVATE', 'USER', id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true, message: 'User deactivated successfully.', data: null });
}

export async function resetPassword(req, res) {
  const id = idParam(req.params.id);
  const target = await pool.query(
    `SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  if (!target.rowCount) throw new HttpError(404, 'User not found.');
  if (target.rows[0].role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Only a SUPER_ADMIN can reset a SUPER_ADMIN password.');
  }
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 12) {
    throw new HttpError(400, 'password must be at least 12 characters.');
  }
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hash, id]
    );
    if (!result.rowCount) throw new HttpError(404, 'User not found.');
    await writeAudit(req, 'UPDATE', 'USER_PASSWORD', id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true, message: 'Password reset successfully.', data: null });
}

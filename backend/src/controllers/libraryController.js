import { pool } from '../config/database.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

const DAILY_FINE_RATE = 0.5;
const LOAN_PERIOD_DAYS = 14;
const MAX_RENEWALS = 2;
const entityTables = {
  categories: { table: 'library_categories', type: 'LIBRARY_CATEGORY', columns: ['name', 'description'] },
  books: {
    table: 'library_books', type: 'LIBRARY_BOOK',
    columns: ['title', 'author', 'isbn', 'category_id', 'publisher', 'publication_year', 'description', 'is_active']
  },
  copies: { table: 'library_copies', type: 'LIBRARY_COPY', columns: ['book_id', 'barcode', 'status', 'shelf_location'] },
  members: {
    table: 'library_members', type: 'LIBRARY_MEMBER',
    columns: ['user_id', 'member_code', 'full_name', 'email', 'phone', 'max_active_loans', 'is_active']
  }
};

export function parseLibraryId(value, label = 'ID') {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  return Number(text);
}

export function parseLibraryPagination(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 100.');
  }
  return { page, limit, offset: (page - 1) * limit };
}

export function assertLibraryMemberCanBorrow({ isActive, activeLoanCount, maxActiveLoans }) {
  if (!isActive) throw new HttpError(409, 'This library member is inactive.');
  if (activeLoanCount >= maxActiveLoans) throw new HttpError(409, 'Member has reached the active loan limit.');
}

export function assertLibraryCopyCanBeIssued({ status, bookIsActive, hasActiveLoan }) {
  if (status !== 'AVAILABLE' || !bookIsActive) throw new HttpError(409, 'This copy is unavailable for issue.');
  if (hasActiveLoan) throw new HttpError(409, 'This copy already has an active loan.');
}

export function assertLibraryLoanCanRenew({ returnedAt, dueDate, renewalCount, today = new Date().toISOString().slice(0, 10) }) {
  if (returnedAt) throw new HttpError(409, 'Returned loans cannot be renewed.');
  if (dueDate < today) throw new HttpError(409, 'Overdue loans cannot be renewed.');
  if (renewalCount >= MAX_RENEWALS) throw new HttpError(409, 'Maximum renewals reached.');
}

export function calculateOverdueFine(dueDate, returnDate, dailyRate = DAILY_FINE_RATE) {
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      (returnDate !== undefined && (typeof returnDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)))) {
    throw new HttpError(400, 'Dates must use YYYY-MM-DD format.');
  }
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const returned = Date.parse(`${returnDate ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(returned) ||
      new Date(due).toISOString().slice(0, 10) !== dueDate ||
      (returnDate && new Date(returned).toISOString().slice(0, 10) !== returnDate)) {
    throw new HttpError(400, 'Dates must be valid calendar dates.');
  }
  if (!Number.isFinite(dailyRate) || dailyRate < 0 || Math.round(dailyRate * 100) !== dailyRate * 100) {
    throw new HttpError(500, 'Configured daily fine rate is invalid.');
  }
  const overdueDays = Math.max(0, Math.floor((returned - due) / 86400000));
  return { overdueDays, amount: Number((overdueDays * dailyRate).toFixed(2)) };
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new HttpError(400, `${field} must be at most ${maxLength} characters.`);
  return trimmed;
}

function optionalText(value, field, maxLength) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new HttpError(400, `${field} must be at most ${maxLength} characters.`);
  return trimmed || null;
}

function validateEntity(entity, input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'A JSON object is required.');
  const definition = entityTables[entity];
  for (const key of Object.keys(input)) {
    if (!definition.columns.includes(key)) throw new HttpError(400, `Unknown field: ${key}.`);
  }
  const output = {};
  const textFields = {
    categories: { name: 120, description: 4000 },
    books: { title: 240, author: 180, isbn: 32, publisher: 180, description: 4000 },
    copies: { barcode: 80, status: 20, shelf_location: 100 },
    members: { member_code: 40, full_name: 180, email: 254, phone: 30 }
  }[entity];
  const required = {
    categories: ['name'],
    books: ['title', 'author', 'category_id'],
    copies: ['book_id', 'barcode'],
    members: ['member_code', 'full_name', 'email']
  }[entity];
  for (const key of required) {
    if (!partial || input[key] !== undefined) {
      if (key.endsWith('_id')) output[key] = parseLibraryId(input[key], key);
      else output[key] = requiredText(input[key], key, textFields[key]);
    }
  }
  for (const [key, maxLength] of Object.entries(textFields)) {
    if (input[key] === undefined || required.includes(key)) continue;
    output[key] = optionalText(input[key], key, maxLength);
  }
  if (input.is_active !== undefined) {
    if (typeof input.is_active !== 'boolean') throw new HttpError(400, 'is_active must be true or false.');
    output.is_active = input.is_active;
  }
  if (input.status !== undefined) {
    if (!['AVAILABLE', 'MAINTENANCE', 'LOST', 'RETIRED'].includes(input.status)) {
      throw new HttpError(400, 'status must be AVAILABLE, MAINTENANCE, LOST, or RETIRED.');
    }
    output.status = input.status;
  }
  if (input.publication_year !== undefined) {
    const year = input.publication_year;
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 9999)) {
      throw new HttpError(400, 'publication_year must be a four-digit year or null.');
    }
    output.publication_year = year;
  }
  if (input.user_id !== undefined) output.user_id = input.user_id === null ? null : parseLibraryId(input.user_id, 'user_id');
  if (input.max_active_loans !== undefined) {
    if (!Number.isInteger(input.max_active_loans) || input.max_active_loans < 1 || input.max_active_loans > 50) {
      throw new HttpError(400, 'max_active_loans must be an integer between 1 and 50.');
    }
    output.max_active_loans = input.max_active_loans;
  }
  if (entity === 'members' && input.email !== undefined) {
    output.email = requiredText(input.email, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw new HttpError(400, 'email must be a valid email address.');
  }
  if (entity === 'books' && input.isbn !== undefined && output.isbn) {
    output.isbn = output.isbn.replace(/[-\s]/g, '').toUpperCase();
  }
  if (!Object.keys(output).length) throw new HttpError(400, 'Provide at least one field.');
  return output;
}

function normalizeDbError(error) {
  if (error?.code === '23505') return new HttpError(409, 'A record with the same unique value already exists.');
  if (error?.code === '23503' || error?.code === '23514') return new HttpError(409, 'The record cannot be changed because it is referenced or violates a constraint.');
  return error;
}

async function transaction(req, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw normalizeDbError(error);
  } finally {
    client.release();
  }
}

function sendList(res, message, rows, page, limit, total) {
  res.json({
    success: true, message, data: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

function listQuery(req, allowedFilters = {}) {
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [];
  const add = (value) => { values.push(value); return `$${values.length}`; };
  if (req.query.q !== undefined) {
    if (typeof req.query.q !== 'string' || req.query.q.length > 100) throw new HttpError(400, 'q must be at most 100 characters.');
    if (req.query.q.trim()) {
      const q = add(`%${req.query.q.trim()}%`);
      where.push(allowedFilters.search(q));
    }
  }
  for (const [param, filter] of Object.entries(allowedFilters.filters || {})) {
    if (req.query[param] === undefined) continue;
    const value = filter.parse ? filter.parse(req.query[param]) : req.query[param];
    where.push(filter.where(add(value)));
  }
  return { page, limit, offset, values, where: where.length ? `WHERE ${where.join(' AND ')}` : '' };
}

function safeCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new HttpError(400, 'Invalid page or limit.');
  return count;
}

export async function listEntity(entity, req, res) {
  const definition = entityTables[entity];
  let query;
  if (entity === 'categories') {
    query = listQuery(req, { search: (q) => `(name ILIKE ${q} OR description ILIKE ${q})` });
  } else if (entity === 'books') {
    query = listQuery(req, {
      search: (q) => `(b.title ILIKE ${q} OR b.author ILIKE ${q} OR b.isbn ILIKE ${q})`,
      filters: {
        category_id: { parse: (v) => parseLibraryId(v, 'category_id'), where: (p) => `b.category_id = ${p}` }
      }
    });
    if (req.query.available !== undefined) {
      if (req.query.available !== 'true' && req.query.available !== 'false') throw new HttpError(400, 'available must be true or false.');
      const availableClause = `EXISTS (SELECT 1 FROM library_copies ac WHERE ac.book_id = b.id AND ac.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM library_loans al WHERE al.copy_id = ac.id AND al.returned_at IS NULL))`;
      query.where = `${query.where ? `${query.where} AND ` : 'WHERE '}${req.query.available === 'true' ? availableClause : `NOT ${availableClause}`}`;
    }
  } else if (entity === 'copies') {
    query = listQuery(req, {
      search: (q) => `(c.barcode ILIKE ${q} OR b.title ILIKE ${q})`,
      filters: { book_id: { parse: (v) => parseLibraryId(v, 'book_id'), where: (p) => `c.book_id = ${p}` } }
    });
    if (req.query.status !== undefined) {
      if (!['AVAILABLE', 'MAINTENANCE', 'LOST', 'RETIRED'].includes(req.query.status)) throw new HttpError(400, 'Invalid copy status filter.');
      query.values.push(req.query.status);
      query.where = `${query.where ? `${query.where} AND ` : 'WHERE '}c.status = $${query.values.length}`;
    }
    if (req.query.available !== undefined) {
      if (req.query.available !== 'true' && req.query.available !== 'false') throw new HttpError(400, 'available must be true or false.');
      const availableClause = `c.status = 'AVAILABLE' AND b.is_active AND NOT EXISTS (
        SELECT 1 FROM library_loans al WHERE al.copy_id = c.id AND al.returned_at IS NULL)`;
      query.where = `${query.where ? `${query.where} AND ` : 'WHERE '}${req.query.available === 'true' ? availableClause : `NOT (${availableClause})`}`;
    }
  } else {
    query = listQuery(req, {
      search: (q) => `(m.member_code ILIKE ${q} OR m.full_name ILIKE ${q} OR m.email ILIKE ${q})`,
      filters: {}
    });
    if (req.query.active !== undefined) {
      if (req.query.active !== 'true' && req.query.active !== 'false') throw new HttpError(400, 'active must be true or false.');
      query.values.push(req.query.active === 'true');
      query.where = `${query.where ? `${query.where} AND ` : 'WHERE '}m.is_active = $${query.values.length}`;
    }
  }

  const from = entity === 'books'
    ? `FROM library_books b JOIN library_categories lc ON lc.id = b.category_id
       LEFT JOIN library_copies cp ON cp.book_id = b.id
       LEFT JOIN library_loans ll ON ll.copy_id = cp.id AND ll.returned_at IS NULL`
    : entity === 'copies'
      ? `FROM library_copies c JOIN library_books b ON b.id = c.book_id`
      : `FROM ${definition.table}${entity === 'members' ? ' m' : ''}`;
  const countSql = entity === 'books'
    ? `SELECT COUNT(DISTINCT b.id)::int AS total ${from} ${query.where}`
    : `SELECT COUNT(*)::int AS total ${from} ${query.where}`;
  const selectSql = {
    categories: `SELECT id, name, description, created_at, updated_at FROM ${definition.table} ${query.where} ORDER BY name, id`,
    books: `SELECT b.id, b.title, b.author, b.isbn, b.category_id, lc.name AS category_name, b.publisher,
      b.publication_year, b.description, b.is_active, b.created_at, b.updated_at,
      COUNT(DISTINCT cp.id)::int AS total_copies,
      COUNT(DISTINCT cp.id) FILTER (WHERE cp.status = 'AVAILABLE' AND ll.id IS NULL)::int AS available_copies
      ${from} ${query.where} GROUP BY b.id, lc.name ORDER BY b.title, b.id`,
    copies: `SELECT c.id, c.book_id, b.title AS book_title, c.barcode, c.status, c.shelf_location,
      c.created_at, c.updated_at FROM ${from} ${query.where} ORDER BY c.barcode, c.id`,
    members: `SELECT m.id, m.user_id, m.member_code, m.full_name, m.email, m.phone,
      m.max_active_loans, m.is_active, m.created_at, m.updated_at FROM ${from} ${query.where} ORDER BY m.full_name, m.id`
  }[entity];
  const count = await pool.query(countSql, query.values);
  const total = safeCount(count.rows[0].total);
  const rows = await pool.query(`${selectSql} LIMIT $${query.values.length + 1} OFFSET $${query.values.length + 2}`,
    [...query.values, query.limit, query.offset]);
  sendList(res, `${entity} fetched successfully.`, rows.rows, query.page, query.limit, total);
}

export async function getEntity(entity, req, res) {
  const id = parseLibraryId(req.params.id);
  const definition = entityTables[entity];
  const selections = {
    categories: `SELECT * FROM ${definition.table} WHERE id = $1`,
    books: `SELECT b.*, c.name AS category_name,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id) AS total_copies,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id AND cp.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM library_loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL)) AS available_copies
      FROM library_books b JOIN library_categories c ON c.id = b.category_id WHERE b.id = $1`,
    copies: `SELECT c.*, b.title AS book_title FROM library_copies c JOIN library_books b ON b.id = c.book_id WHERE c.id = $1`,
    members: `SELECT * FROM library_members WHERE id = $1`
  };
  const result = await pool.query(selections[entity], [id]);
  if (!result.rowCount) throw new HttpError(404, `${entity.slice(0, -1)} not found.`);
  res.json({ success: true, message: 'Record fetched successfully.', data: result.rows[0] });
}

export async function createEntity(entity, req, res) {
  const fields = validateEntity(entity, req.body);
  const definition = entityTables[entity];
  const record = await transaction(req, async (client) => {
    const columns = Object.keys(fields);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const result = await client.query(
      `INSERT INTO ${definition.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      columns.map((column) => fields[column])
    );
    await writeAudit(req, 'CREATE', definition.type, result.rows[0].id, fields, client);
    return result.rows[0];
  });
  res.status(201).json({ success: true, message: 'Record created successfully.', data: record });
}

export async function updateEntity(entity, req, res) {
  const id = parseLibraryId(req.params.id);
  const fields = validateEntity(entity, req.body, true);
  const definition = entityTables[entity];
  const record = await transaction(req, async (client) => {
    if (entity === 'copies' && fields.status && fields.status !== 'AVAILABLE') {
      const copy = await client.query('SELECT id FROM library_copies WHERE id = $1 FOR UPDATE', [id]);
      if (!copy.rowCount) throw new HttpError(404, 'copy not found.');
      const activeLoan = await client.query(
        'SELECT 1 FROM library_loans WHERE copy_id = $1 AND returned_at IS NULL FOR UPDATE',
        [id]
      );
      if (activeLoan.rowCount) throw new HttpError(409, 'A copy with an active loan cannot be made unavailable.');
    }
    if (entity === 'members' && fields.max_active_loans !== undefined) {
      const member = await client.query('SELECT id FROM library_members WHERE id = $1 FOR UPDATE', [id]);
      if (!member.rowCount) throw new HttpError(404, 'member not found.');
      const active = await client.query(
        'SELECT COUNT(*)::int AS total FROM library_loans WHERE member_id = $1 AND returned_at IS NULL',
        [id]
      );
      if (fields.max_active_loans < active.rows[0].total) {
        throw new HttpError(409, 'The active loan limit cannot be lower than the member’s current loans.');
      }
    }
    const columns = Object.keys(fields);
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    const result = await client.query(
      `UPDATE ${definition.table} SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${columns.length + 1} RETURNING *`,
      [...columns.map((column) => fields[column]), id]
    );
    if (!result.rowCount) throw new HttpError(404, `${entity.slice(0, -1)} not found.`);
    await writeAudit(req, 'UPDATE', definition.type, id, fields, client);
    return result.rows[0];
  });
  res.json({ success: true, message: 'Record updated successfully.', data: record });
}

export async function deleteEntity(entity, req, res) {
  const id = parseLibraryId(req.params.id);
  const definition = entityTables[entity];
  await transaction(req, async (client) => {
    const result = await client.query(`DELETE FROM ${definition.table} WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) throw new HttpError(404, `${entity.slice(0, -1)} not found.`);
    await writeAudit(req, 'DELETE', definition.type, id, {}, client);
  });
  res.json({ success: true, message: 'Record deleted successfully.', data: null });
}

export async function searchLibrary(req, res) {
  if (req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > 100)) {
    throw new HttpError(400, 'q must be at most 100 characters.');
  }
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [];
  if (req.query.q?.trim()) {
    values.push(`%${req.query.q.trim()}%`);
    where.push(`(b.title ILIKE $1 OR b.author ILIKE $1 OR b.isbn ILIKE $1 OR
      EXISTS (SELECT 1 FROM library_copies sc WHERE sc.book_id = b.id AND sc.barcode ILIKE $1))`);
  }
  if (req.query.category_id !== undefined) {
    values.push(parseLibraryId(req.query.category_id, 'category_id'));
    where.push(`b.category_id = $${values.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM library_books b JOIN library_categories c ON c.id = b.category_id ${clause}`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, values);
  const rows = await pool.query(
    `SELECT b.id, b.title, b.author, b.isbn, c.name AS category_name,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id) AS total_copies,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id AND cp.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM library_loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL)) AS available_copies
     ${base} ORDER BY b.title, b.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  sendList(res, 'Library search completed.', rows.rows, page, limit, safeCount(count.rows[0].total));
}

export async function getAvailability(req, res) {
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [`b.is_active = TRUE`];
  if (req.query.book_id !== undefined) {
    values.push(parseLibraryId(req.query.book_id, 'book_id'));
    where.push(`b.id = $${values.length}`);
  }
  if (req.query.q !== undefined) {
    if (typeof req.query.q !== 'string' || req.query.q.length > 100) throw new HttpError(400, 'q must be at most 100 characters.');
    if (req.query.q.trim()) {
      values.push(`%${req.query.q.trim()}%`);
      where.push(`(b.title ILIKE $${values.length} OR b.author ILIKE $${values.length} OR b.isbn ILIKE $${values.length})`);
    }
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const from = `FROM library_books b JOIN library_categories c ON c.id = b.category_id ${clause}`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total ${from}`, values);
  const rows = await pool.query(
    `SELECT b.id AS book_id, b.title, b.author, c.name AS category_name,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id) AS total_copies,
      (SELECT COUNT(*)::int FROM library_copies cp WHERE cp.book_id = b.id AND cp.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM library_loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL)) AS available_copies
     ${from} ORDER BY b.title, b.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  sendList(res, 'Availability fetched successfully.', rows.rows, page, limit, safeCount(count.rows[0].total));
}

function requestDate(value, field) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD format.`);
  calculateOverdueFine(value, value);
  if (value < new Date().toISOString().slice(0, 10)) throw new HttpError(400, `${field} cannot be in the past.`);
  return value;
}

export async function listLoans(req, res) {
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [];
  const add = (value) => { values.push(value); return `$${values.length}`; };
  if (req.query.member_id !== undefined) where.push(`l.member_id = ${add(parseLibraryId(req.query.member_id, 'member_id'))}`);
  if (req.query.copy_id !== undefined) where.push(`l.copy_id = ${add(parseLibraryId(req.query.copy_id, 'copy_id'))}`);
  if (req.query.status !== undefined) {
    if (!['ACTIVE', 'RETURNED', 'OVERDUE'].includes(req.query.status)) throw new HttpError(400, 'status must be ACTIVE, RETURNED, or OVERDUE.');
    where.push(req.query.status === 'ACTIVE' ? 'l.returned_at IS NULL AND l.due_date >= CURRENT_DATE'
      : req.query.status === 'OVERDUE' ? 'l.returned_at IS NULL AND l.due_date < CURRENT_DATE' : 'l.returned_at IS NOT NULL');
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM library_loans l JOIN library_members m ON m.id = l.member_id
    JOIN library_copies cp ON cp.id = l.copy_id JOIN library_books b ON b.id = cp.book_id`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total ${from} ${clause}`, values);
  const rows = await pool.query(
    `SELECT l.id, l.member_id, m.member_code, m.full_name, l.copy_id, cp.barcode, b.title AS book_title,
      l.issued_at, l.due_date, l.returned_at, l.renewal_count, l.fine_amount, l.daily_fine,
      CASE WHEN l.returned_at IS NOT NULL THEN 'RETURNED'
        WHEN l.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'ACTIVE' END AS status
     ${from} ${clause} ORDER BY l.issued_at DESC, l.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  sendList(res, 'Loans fetched successfully.', rows.rows, page, limit, safeCount(count.rows[0].total));
}

export async function issueLoan(req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required.');
  for (const key of Object.keys(body)) if (!['member_id', 'copy_id', 'due_date'].includes(key)) throw new HttpError(400, `Unknown field: ${key}.`);
  const memberId = parseLibraryId(body.member_id, 'member_id');
  const copyId = parseLibraryId(body.copy_id, 'copy_id');
  const dueDate = requestDate(body.due_date, 'due_date');
  const loan = await transaction(req, async (client) => {
    const member = await client.query('SELECT * FROM library_members WHERE id = $1 FOR UPDATE', [memberId]);
    if (!member.rowCount) throw new HttpError(404, 'Library member not found.');
    const active = await client.query('SELECT COUNT(*)::int AS total FROM library_loans WHERE member_id = $1 AND returned_at IS NULL', [memberId]);
    assertLibraryMemberCanBorrow({
      isActive: member.rows[0].is_active,
      activeLoanCount: active.rows[0].total,
      maxActiveLoans: member.rows[0].max_active_loans
    });
    const copy = await client.query(
      `SELECT cp.id, cp.status, b.is_active AS book_active
       FROM library_copies cp JOIN library_books b ON b.id = cp.book_id
       WHERE cp.id = $1 FOR UPDATE OF cp`, [copyId]
    );
    if (!copy.rowCount) throw new HttpError(404, 'Library copy not found.');
    const busy = await client.query('SELECT 1 FROM library_loans WHERE copy_id = $1 AND returned_at IS NULL', [copyId]);
    assertLibraryCopyCanBeIssued({
      status: copy.rows[0].status,
      bookIsActive: copy.rows[0].book_active,
      hasActiveLoan: Boolean(busy.rowCount)
    });
    const requestedDueDate = dueDate || null;
    const result = await client.query(
      `INSERT INTO library_loans (member_id, copy_id, issued_by, due_date, daily_fine)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE + $5::integer), $6) RETURNING *`,
      [memberId, copyId, req.user.id, requestedDueDate, LOAN_PERIOD_DAYS, DAILY_FINE_RATE]
    );
    await writeAudit(req, 'ISSUE', 'LIBRARY_LOAN', result.rows[0].id, { member_id: memberId, copy_id: copyId, due_date: result.rows[0].due_date }, client);
    return result.rows[0];
  });
  res.status(201).json({ success: true, message: 'Copy issued successfully.', data: loan });
}

export async function returnLoan(req, res) {
  const id = parseLibraryId(req.params.id, 'loan ID');
  if (req.body && Object.keys(req.body).length) throw new HttpError(400, 'Return does not accept a request body.');
  const loan = await transaction(req, async (client) => {
    const current = await client.query('SELECT * FROM library_loans WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw new HttpError(404, 'Loan not found.');
    if (current.rows[0].returned_at) throw new HttpError(409, 'This loan has already been returned.');
    const fine = await client.query(
      `SELECT GREATEST(0, CURRENT_DATE - due_date)::int AS overdue_days FROM library_loans WHERE id = $1`,
      [id]
    );
    const overdueDays = fine.rows[0].overdue_days;
    const amount = Number((overdueDays * Number(current.rows[0].daily_fine)).toFixed(2));
    const result = await client.query(
      `UPDATE library_loans SET returned_at = NOW(), returned_by = $2, overdue_days = $3, fine_amount = $4
       WHERE id = $1 RETURNING *`,
      [id, req.user.id, overdueDays, amount]
    );
    await writeAudit(req, 'RETURN', 'LIBRARY_LOAN', id, { overdue_days: overdueDays, fine_amount: amount }, client);
    return result.rows[0];
  });
  res.json({ success: true, message: 'Copy returned successfully.', data: loan });
}

export async function renewLoan(req, res) {
  const id = parseLibraryId(req.params.id, 'loan ID');
  if (req.body && Object.keys(req.body).length) throw new HttpError(400, 'Renewal does not accept a request body.');
  const loan = await transaction(req, async (client) => {
    const current = await client.query('SELECT * FROM library_loans WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw new HttpError(404, 'Loan not found.');
    assertLibraryLoanCanRenew({
      returnedAt: current.rows[0].returned_at,
      dueDate: current.rows[0].due_date,
      renewalCount: current.rows[0].renewal_count
    });
    const result = await client.query(
      `UPDATE library_loans SET due_date = due_date + $2::integer, renewal_count = renewal_count + 1
       WHERE id = $1 RETURNING *`, [id, LOAN_PERIOD_DAYS]
    );
    await writeAudit(req, 'RENEW', 'LIBRARY_LOAN', id, { renewal_count: result.rows[0].renewal_count, due_date: result.rows[0].due_date }, client);
    return result.rows[0];
  });
  res.json({ success: true, message: 'Loan renewed successfully.', data: loan });
}

export async function listOverdueFines(req, res) {
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [`l.returned_at IS NULL`, `l.due_date < CURRENT_DATE`];
  if (req.query.member_id !== undefined) {
    values.push(parseLibraryId(req.query.member_id, 'member_id'));
    where.push(`l.member_id = $${values.length}`);
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const from = `FROM library_loans l JOIN library_members m ON m.id = l.member_id
    JOIN library_copies cp ON cp.id = l.copy_id JOIN library_books b ON b.id = cp.book_id`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total ${from} ${clause}`, values);
  const rows = await pool.query(
    `SELECT l.id AS loan_id, l.member_id, m.member_code, m.full_name, cp.id AS copy_id,
      cp.barcode, b.title AS book_title, l.due_date,
      (CURRENT_DATE - l.due_date)::int AS overdue_days,
      ROUND(((CURRENT_DATE - l.due_date) * l.daily_fine)::numeric, 2) AS accrued_fine
     ${from} ${clause} ORDER BY l.due_date, l.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  sendList(res, 'Overdue fines fetched successfully.', rows.rows, page, limit, safeCount(count.rows[0].total));
}

export async function listFines(req, res) {
  const { page, limit, offset } = parseLibraryPagination(req.query);
  const values = [];
  const where = [`l.fine_amount > 0`];
  if (req.query.member_id !== undefined) {
    values.push(parseLibraryId(req.query.member_id, 'member_id'));
    where.push(`l.member_id = $${values.length}`);
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const from = `FROM library_loans l JOIN library_members m ON m.id = l.member_id
    JOIN library_copies cp ON cp.id = l.copy_id JOIN library_books b ON b.id = cp.book_id`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total ${from} ${clause}`, values);
  const rows = await pool.query(
    `SELECT l.id AS loan_id, l.member_id, m.member_code, m.full_name, cp.barcode, b.title AS book_title,
      l.due_date, l.returned_at, l.overdue_days, l.fine_amount, l.daily_fine
     ${from} ${clause} ORDER BY l.returned_at DESC, l.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  sendList(res, 'Fines fetched successfully.', rows.rows, page, limit, safeCount(count.rows[0].total));
}

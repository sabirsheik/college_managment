import { pool } from '../config/database.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

const fields = {
  college_name: { max: 180, required: true },
  logo_url: { max: 1000 },
  address: { max: 2000 },
  phone: { max: 30 },
  email: { max: 254, email: true },
  website: { max: 255 },
  academic_year: { max: 20 },
  timezone: { max: 80, required: true },
  currency: { max: 3, required: true },
  country: { max: 100 },
  state: { max: 100 },
  city: { max: 100 }
};

export async function getSettings(_req, res) {
  const result = await pool.query('SELECT * FROM college_settings WHERE id = 1');
  res.json({ success: true, message: 'College settings fetched successfully.', data: result.rows[0] });
}

export async function updateSettings(req, res) {
  const body = req.body || {};
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(fields, key)) throw new HttpError(400, `Unknown setting: ${key}.`);
  }
  const entries = Object.entries(body);
  if (!entries.length) throw new HttpError(400, 'Provide at least one setting to update.');
  for (const [key, rule] of entries) {
    const value = body[key];
    if (value === null && !rule.required) continue;
    if (typeof value !== 'string' || !value.trim() || value.length > rule.max) {
      throw new HttpError(400, `${key} must be a non-empty string of at most ${rule.max} characters.`);
    }
    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new HttpError(400, 'email must be a valid email address.');
    }
    if (key === 'website' || key === 'logo_url') {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL scheme.');
      } catch {
        throw new HttpError(400, `${key} must be a valid HTTP or HTTPS URL.`);
      }
    }
  }
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([key, rule]) =>
    body[key] == null ? null : rule.email ? body[key].trim().toLowerCase() : body[key].trim()
  );
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await client.query(
      `UPDATE college_settings SET ${assignments}, updated_at = NOW() WHERE id = 1 RETURNING *`,
      values
    );
    await writeAudit(req, 'UPDATE', 'COLLEGE_SETTINGS', '1', {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true, message: 'College settings updated successfully.', data: result.rows[0] });
}

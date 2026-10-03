import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { authCookieName, cookieOptions } from '../middleware/authenticate.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions
  };
}

export async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }
  const result = await pool.query(
    `SELECT u.*, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = $1`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const token = jwt.sign({ sub: String(user.id), ver: user.token_version }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  const expiresAt = jwt.decode(token).exp * 1000;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    await writeAudit(req, 'LOGIN', 'USER', user.id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.cookie(authCookieName, token, { ...cookieOptions, maxAge: Math.max(0, expiresAt - Date.now()) });
  res.json({ success: true, message: 'Signed in successfully.', data: { user: publicUser({ ...user, permissions: [] }) } });
}

export async function logout(req, res) {
  if (req.user) await writeAudit(req, 'LOGOUT', 'USER', req.user.id);
  res.clearCookie(authCookieName, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Signed out successfully.', data: null });
}

export async function me(req, res) {
  res.json({ success: true, message: 'Current session.', data: { user: publicUser(req.user) } });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 12) {
    throw new HttpError(400, 'Current password and a new password of at least 12 characters are required.');
  }
  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  const client = await pool.connect();
  let update;
  try {
    await client.query('BEGIN');
    update = await client.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1,
         updated_at = NOW() WHERE id = $2 RETURNING token_version`,
      [hash, req.user.id]
    );
    await writeAudit(req, 'UPDATE', 'USER_PASSWORD', req.user.id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const token = jwt.sign(
    { sub: String(req.user.id), ver: update.rows[0].token_version },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
  const expiresAt = jwt.decode(token).exp * 1000;
  res.cookie(authCookieName, token, { ...cookieOptions, maxAge: Math.max(0, expiresAt - Date.now()) });
  res.json({ success: true, message: 'Password changed successfully.', data: null });
}

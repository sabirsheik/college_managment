import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { authCookieName, cookieOptions } from '../middleware/authenticate.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';
import { deliverEmail } from '../services/emailDelivery.js';
import { logger } from '../utils/logger.js';

const dummyPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

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
  if (!email || email.length > 254 || typeof password !== 'string' ||
      !password || Buffer.byteLength(password, 'utf8') > 1024) {
    throw new HttpError(400, 'Email and password are required.');
  }
  const result = await pool.query(
    `SELECT u.*, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = $1`,
    [email]
  );
  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? dummyPasswordHash);
  if (!user || !user.is_active || !passwordMatches) {
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
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new HttpError(400, 'Current password is required.');
  }
  assertStrongPassword(newPassword, 'newPassword');
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

export async function requestPasswordReset(req, res) {
  const startedAt = Date.now();
  const email = typeof req.body?.email === 'string' && req.body.email.length <= 254
    ? req.body.email.trim().toLowerCase()
    : '';
  if (email) {
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE LOWER(email)=$1 AND is_active',
      [email]
    );
    const user = userResult.rows[0];
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'DELETE FROM password_reset_tokens WHERE user_id=$1 AND (used_at IS NOT NULL OR expires_at <= NOW())',
          [user.id]
        );
        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
          [user.id, tokenHash]
        );
        await writeAudit(req, 'PASSWORD_RESET_REQUEST', 'USER', user.id, {}, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      const link = new URL('/reset-password', env.frontendUrl);
      link.searchParams.set('token', token);
      const delivery = await deliverEmail({
        to: user.email,
        subject: 'Reset your college management password',
        text: `Use the following link to reset your password. It expires in 30 minutes: ${link.toString()}`
      });
      if (!delivery.delivered) {
        logger.warn(
          { requestId: req.id, reason: delivery.reason },
          'Password reset email was not delivered.'
        );
        await pool.query(
          'UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL',
          [tokenHash]
        );
      }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 250 - (Date.now() - startedAt))));
  res.json({
    success: true,
    message: 'If an active account matches that email, password reset instructions will be sent.',
    data: null
  });
}

export async function completePasswordReset(req, res) {
  const token = req.body?.token;
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) {
    throw new HttpError(400, 'A valid password reset token is required.');
  }
  assertStrongPassword(req.body?.newPassword, 'newPassword');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      `SELECT t.id, t.user_id FROM password_reset_tokens t
       JOIN users u ON u.id=t.user_id
       WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at > NOW() AND u.is_active
       FOR UPDATE OF t, u`,
      [tokenHash]
    );
    const reset = tokenResult.rows[0];
    if (!reset) throw new HttpError(400, 'Password reset link is invalid or expired.');
    const updated = await client.query(
      `UPDATE users SET password_hash=$1, token_version=token_version+1, updated_at=NOW()
       WHERE id=$2 RETURNING id`,
      [passwordHash, reset.user_id]
    );
    if (!updated.rowCount) throw new HttpError(400, 'Password reset link is invalid or expired.');
    await client.query(
      'UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
      [reset.user_id]
    );
    await writeAudit(req, 'PASSWORD_RESET_COMPLETE', 'USER', reset.user_id, {}, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true, message: 'Password reset successfully. Sign in with your new password.', data: null });
}

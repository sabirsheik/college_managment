import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const authCookieName = 'college_session';

export const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000
};

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[authCookieName];
    if (!token) throw new HttpError(401, 'Authentication required.');
    let claims;
    try {
      claims = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session is invalid or expired. Please sign in again.');
    }

    export function authenticateOptional(req, res, next) {
      return authenticate(req, res, (error) => {
        if (error) return next();
        next();
      });
    }
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, r.name AS role,
        COALESCE(array_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1
       GROUP BY u.id, r.name`,
      [claims.sub]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) throw new HttpError(401, 'Account is unavailable.');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

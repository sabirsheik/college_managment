import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const trustedOrigin = new URL(env.frontendUrl).origin;

export function verifyOrigin(req, _res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== trustedOrigin) {
    return next(new HttpError(403, 'Request origin is not allowed.'));
  }
  next();
}

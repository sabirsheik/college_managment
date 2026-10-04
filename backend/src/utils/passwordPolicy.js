import { HttpError } from './httpError.js';

export function assertStrongPassword(password, field = 'password') {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, `${field} must be at least 12 characters and no more than 72 UTF-8 bytes.`);
  }
  const categories = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  if (categories < 3) {
    throw new HttpError(400, `${field} must include at least three of lowercase, uppercase, numeric, and symbol characters.`);
  }
}

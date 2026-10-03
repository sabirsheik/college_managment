import { HttpError } from '../utils/httpError.js';

export function validateResourceBody(resource, body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }

  const values = {};
  for (const [key, value] of Object.entries(body)) {
    const rule = resource.fields[key];
    if (!rule) {
      throw new HttpError(400, `Unknown field: ${key}.`);
    }

    if (value === null && rule.nullable) {
      values[key] = null;
      continue;
    }

    if (rule.type === 'string' || rule.type === 'email' || rule.type === 'url') {
      if (typeof value !== 'string' || !value.trim()) {
        throw new HttpError(400, `${key} must be a non-empty string.`);
      }
      const clean = value.trim();
      if (clean.length > rule.max) {
        throw new HttpError(400, `${key} must be at most ${rule.max} characters.`);
      }
      if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        throw new HttpError(400, `${key} must be a valid email address.`);
      }
      if (rule.type === 'url') {
        try {
          const url = new URL(clean);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL scheme.');
        } catch {
          throw new HttpError(400, `${key} must be a valid HTTP or HTTPS URL.`);
        }
      }
      values[key] = rule.type === 'email' ? clean.toLowerCase() : clean;
      continue;
    }

    if (rule.type === 'integer') {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 ||
          (rule.min !== undefined && number < rule.min) ||
          (rule.max !== undefined && number > rule.max)) {
        throw new HttpError(400, `${key} must be a valid integer.`);
      }
      values[key] = number;
      continue;
    }

    if (rule.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) ||
          (rule.min !== undefined && number < rule.min) ||
          (rule.max !== undefined && number > rule.max)) {
        throw new HttpError(400, `${key} must be a valid number.`);
      }
      values[key] = number;
      continue;
    }

    if (rule.type === 'date') {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
          new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
        throw new HttpError(400, `${key} must be a valid date (YYYY-MM-DD).`);
      }
      values[key] = value;
      continue;
    }

    if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') throw new HttpError(400, `${key} must be true or false.`);
      values[key] = value;
      continue;
    }

    if (rule.type === 'enum') {
      if (!rule.values.includes(value)) {
        throw new HttpError(400, `${key} must be one of: ${rule.values.join(', ')}.`);
      }
      values[key] = value;
    }
  }

  if (!partial) {
    for (const [key, rule] of Object.entries(resource.fields)) {
      if (rule.required && !(key in values)) {
        throw new HttpError(400, `${key} is required.`);
      }
    }
  }
  if (partial && Object.keys(values).length === 0) {
    throw new HttpError(400, 'Provide at least one field to update.');
  }

  return values;
}

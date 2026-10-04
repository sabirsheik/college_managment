import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = dirname(fileURLToPath(import.meta.url));
config({
  path: [
    resolve(configDirectory, '../../.env'),
    resolve(configDirectory, '../../../.env')
  ]
});

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 5000);
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const cookieSecureValue = process.env.COOKIE_SECURE;
const databaseSslValue = process.env.DATABASE_SSL || 'false';
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
const databasePoolMax = Number(process.env.DATABASE_POOL_MAX || 10);

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production.');
}
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
}
if (!Number.isSafeInteger(databasePoolMax) || databasePoolMax < 1 || databasePoolMax > 100) {
  throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 100.');
}
let frontendUrl;
try {
  frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
} catch {
  throw new Error('FRONTEND_URL must be a valid absolute URL.');
}
let emailApiUrl;
try {
  emailApiUrl = process.env.EMAIL_API_URL ? new URL(process.env.EMAIL_API_URL).toString() : undefined;
} catch {
  throw new Error('EMAIL_API_URL must be a valid absolute URL.');
}

export const env = {
  nodeEnv,
  port,
  databaseUrl,
  databaseSsl: databaseSslValue === 'true',
  databaseSslCa: process.env.DATABASE_SSL_CA || undefined,
  databasePoolMax,
  frontendUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  cookieSecure: cookieSecureValue === 'true',
  trustProxyHops,
  emailApiUrl,
  emailApiKey: process.env.EMAIL_API_KEY
};

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Copy backend/.env.example to backend/.env and set DATABASE_URL to your PostgreSQL connection string.'
  );
}
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}
if (cookieSecureValue !== undefined && !['true', 'false'].includes(cookieSecureValue)) {
  throw new Error('COOKIE_SECURE must be true or false.');
}
if (!['true', 'false'].includes(databaseSslValue)) {
  throw new Error('DATABASE_SSL must be true or false.');
}
if (process.env.DATABASE_SSL_CA && databaseSslValue !== 'true') {
  throw new Error('DATABASE_SSL_CA requires DATABASE_SSL=true.');
}
if (Boolean(env.emailApiUrl) !== Boolean(env.emailApiKey)) {
  throw new Error('EMAIL_API_URL and EMAIL_API_KEY must be configured together.');
}
if (nodeEnv === 'production') {
  if (!env.cookieSecure) throw new Error('COOKIE_SECURE=true is required in production.');
  if (new URL(frontendUrl).protocol !== 'https:') throw new Error('FRONTEND_URL must use HTTPS in production.');
  if (!env.databaseSsl) throw new Error('DATABASE_SSL=true is required in production.');
  if (env.emailApiUrl && new URL(env.emailApiUrl).protocol !== 'https:') {
    throw new Error('EMAIL_API_URL must use HTTPS in production.');
  }
}

import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  cookieSecure: process.env.COOKIE_SECURE === 'true'
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy backend/.env.example to backend/.env and configure it.');
}
if (!env.jwtSecret || env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}

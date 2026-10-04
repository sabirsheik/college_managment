import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ...(env.databaseSsl ? {
    ssl: {
      rejectUnauthorized: true,
      ...(env.databaseSslCa ? { ca: env.databaseSslCa } : {})
    }
  } : {}),
  max: env.databasePoolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  query_timeout: 20000
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected PostgreSQL client error.');
});

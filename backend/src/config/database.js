import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected PostgreSQL client error.');
});

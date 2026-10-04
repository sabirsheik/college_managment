import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, environment: env.nodeEnv }, 'College management API listening.');
});

server.requestTimeout = 30000;
server.headersTimeout = 35000;
server.keepAliveTimeout = 5000;

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down API server.');
  const timeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 10000);
  timeout.unref();
  server.close(async (error) => {
    if (error) logger.error({ err: error }, 'HTTP server shutdown failed.');
    try {
      await pool.end();
      clearTimeout(timeout);
      process.exit(error ? 1 : 0);
    } catch (poolError) {
      logger.error({ err: poolError }, 'Database pool shutdown failed.');
      process.exit(1);
    }
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

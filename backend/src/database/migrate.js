import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../config/database.js';

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [73021026]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('COMMIT');
    const directory = resolve(process.cwd(), '../database/migrations');
    const files = (await readdir(directory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const sql = await readFile(resolve(directory, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [73021026]);
        const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
        if (existing.rowCount) {
          await client.query('COMMIT');
          continue;
        }
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration ${file}.`);
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preserve the migration error */ }
        throw error;
      }
    }
  } finally {
    client.release();
  }
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

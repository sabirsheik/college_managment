import { pool } from '../config/database.js';

export async function getHealth(req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Service is healthy.', data: { status: 'ok', database: 'ok' } });
  } catch (error) {
    req.log?.error({ err: error }, 'Health check could not reach PostgreSQL.');
    res.status(503).json({
      success: false,
      message: 'Service is unavailable.',
      errors: [],
      data: { status: 'unavailable', database: 'unavailable' }
    });
  }
}

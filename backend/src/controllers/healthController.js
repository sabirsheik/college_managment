import { pool } from '../config/database.js';

export async function getHealth(req, res) {
  const data = {
    status: 'ok',
    database: 'ok',
    environment: req.app.get('env'),
    timestamp: new Date().toISOString()
  };
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Service is healthy.', data });
  } catch (error) {
    req.log?.error({ err: error }, 'Health check could not reach PostgreSQL.');
    data.status = 'unavailable';
    data.database = 'unavailable';
    res.status(503).json({
      success: false,
      message: 'Service is unavailable.',
      errors: [],
      data
    });
  }
}

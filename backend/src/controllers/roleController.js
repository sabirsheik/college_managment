import { pool } from '../config/database.js';

export async function listRoles(_req, res) {
  const result = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
  res.json({ success: true, message: 'Roles fetched successfully.', data: result.rows });
}

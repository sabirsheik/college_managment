import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';

export async function listAuditLogs(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 100.');
  }
  const result = await pool.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata,
       a.ip_address, a.user_agent, a.created_at, u.email AS actor_email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit]
  );
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM audit_logs');
  const total = count.rows[0].total;
  res.json({
    success: true, message: 'Audit logs fetched successfully.', data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

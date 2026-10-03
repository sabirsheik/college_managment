import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';

function idParam(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Notification ID must be a positive integer.');
  return Number(value);
}

export async function listNotifications(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 100.');
  }
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1', [req.user.id]);
  const result = await pool.query(
    `SELECT id, title, message, type, is_read, created_at FROM notifications
     WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [req.user.id, limit, (page - 1) * limit]
  );
  const total = count.rows[0].total;
  res.json({
    success: true, message: 'Notifications fetched successfully.', data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

export async function markRead(req, res) {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2
     RETURNING id, title, message, type, is_read, created_at`,
    [idParam(req.params.id), req.user.id]
  );
  if (!result.rowCount) throw new HttpError(404, 'Notification not found.');
  res.json({ success: true, message: 'Notification marked as read.', data: result.rows[0] });
}

export async function markAllRead(req, res) {
  const result = await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read',
    [req.user.id]
  );
  res.json({ success: true, message: 'Notifications marked as read.', data: { updated: result.rowCount } });
}

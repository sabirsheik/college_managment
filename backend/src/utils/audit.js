import { pool } from '../config/database.js';

export async function writeAudit(req, action, entityType, entityId = null, metadata = {}) {
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user?.id ?? null,
      action,
      entityType,
      entityId == null ? null : String(entityId),
      JSON.stringify(metadata),
      req.ip,
      req.get('user-agent') || null
    ]
  );
}

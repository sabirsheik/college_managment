import { pool } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';
import { writeAudit } from '../utils/audit.js';

export const phaseThreePermissions = Object.freeze([
  'announcements.create',
  'announcements.publish',
  'announcements.read',
  'announcements.manage',
  'search.read',
  'activity.read'
]);

const announcementTargetTypes = new Set([
  'ALL_STUDENTS', 'ALL_FACULTY', 'DEPARTMENT', 'PROGRAM', 'SECTION', 'ROLE'
]);

function validId(value, label = 'ID') {
  if (!/^[1-9]\d*$/.test(String(value))) throw new HttpError(400, `${label} must be a positive integer.`);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new HttpError(400, `${label} is invalid.`);
  return id;
}

function pagination(query, maxLimit = 100) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new HttpError(400, `Page must be positive and limit must be between 1 and ${maxLimit}.`);
  }
  return { page, limit, offset: (page - 1) * limit };
}

function isAnnouncementManager(user) {
  return user.role === 'SUPER_ADMIN' || user.permissions.includes('announcements.manage');
}

function validateAnnouncementBody(body = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const targetType = body.targetType;
  if (!title || title.length > 180 || !message || message.length > 5000) {
    throw new HttpError(400, 'Title (1–180 characters) and message (1–5000 characters) are required.');
  }
  if (!announcementTargetTypes.has(targetType)) {
    throw new HttpError(400, 'A supported announcement targetType is required.');
  }

  let targetId = null;
  let targetRole = null;
  if (['DEPARTMENT', 'PROGRAM', 'SECTION'].includes(targetType)) {
    targetId = validId(body.targetId, 'Target ID');
  } else if (targetType === 'ROLE') {
    if (typeof body.targetRole !== 'string' || !/^[A-Z][A-Z0-9_]{1,39}$/.test(body.targetRole)) {
      throw new HttpError(400, 'targetRole must be a valid role name.');
    }
    targetRole = body.targetRole;
  }
  return { title, message, targetType, targetId, targetRole };
}

async function targetExists(client, target) {
  if (target.targetType === 'ROLE') {
    const result = await client.query('SELECT 1 FROM roles WHERE name = $1', [target.targetRole]);
    return result.rowCount > 0;
  }
  const tables = { DEPARTMENT: 'departments', PROGRAM: 'programs', SECTION: 'sections' };
  if (!tables[target.targetType]) return true;
  const result = await client.query(`SELECT 1 FROM ${tables[target.targetType]} WHERE id = $1`, [target.targetId]);
  return result.rowCount > 0;
}

export async function createAnnouncement(req, res) {
  const target = validateAnnouncementBody(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!await targetExists(client, target)) throw new HttpError(400, 'Announcement target does not exist.');
    const result = await client.query(
      `INSERT INTO announcements (title, message, target_type, target_id, target_role, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, message, target_type, target_id, target_role, status, created_at`,
      [target.title, target.message, target.targetType, target.targetId, target.targetRole, req.user.id]
    );
    await writeAudit(req, 'CREATE', 'ANNOUNCEMENT', result.rows[0].id, {
      targetType: target.targetType
    }, client);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Announcement draft created.', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const audienceSelect = `
  SELECT DISTINCT u.id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN students s ON s.user_id = u.id
  LEFT JOIN faculty f ON f.user_id = u.id
  WHERE u.is_active = TRUE AND (
    ($2 = 'ALL_STUDENTS' AND r.name = 'STUDENT' AND s.status = 'ACTIVE')
    OR ($2 = 'ALL_FACULTY' AND r.name = 'FACULTY' AND f.employment_status = 'ACTIVE')
    OR ($2 = 'DEPARTMENT' AND
      ((r.name = 'STUDENT' AND s.department_id = $3 AND s.status = 'ACTIVE')
       OR (r.name = 'FACULTY' AND f.department_id = $3 AND f.employment_status = 'ACTIVE')))
    OR ($2 = 'PROGRAM' AND (
      (r.name = 'STUDENT' AND s.program_id = $3 AND s.status = 'ACTIVE')
      OR (r.name = 'FACULTY' AND EXISTS (
        SELECT 1 FROM course_assignments ca JOIN sections sec ON sec.id = ca.section_id
        WHERE ca.faculty_id = f.id AND sec.program_id = $3 AND ca.status = 'ACTIVE'
          AND f.employment_status = 'ACTIVE'
      ))
    ))
    OR ($2 = 'SECTION' AND (
      (r.name = 'STUDENT' AND s.section_id = $3 AND s.status = 'ACTIVE')
      OR (r.name = 'FACULTY' AND EXISTS (
        SELECT 1 FROM course_assignments ca
        WHERE ca.faculty_id = f.id AND ca.section_id = $3 AND ca.status = 'ACTIVE'
          AND f.employment_status = 'ACTIVE'
      ))
    ))
    OR ($2 = 'ROLE' AND r.name = $4)
  )`;

export async function publishAnnouncement(req, res) {
  const announcementId = validId(req.params.id, 'Announcement ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, title, message, target_type, target_id, target_role, created_by, status
       FROM announcements WHERE id = $1 FOR UPDATE`,
      [announcementId]
    );
    const announcement = existing.rows[0];
    if (!announcement) throw new HttpError(404, 'Announcement not found.');
    if (announcement.created_by !== req.user.id && !isAnnouncementManager(req.user)) {
      throw new HttpError(403, 'You may only publish announcements you created.');
    }
    if (announcement.status !== 'DRAFT') throw new HttpError(409, 'Announcement has already been published.');

    const audience = await client.query(audienceSelect, [
      announcement.id, announcement.target_type, announcement.target_id, announcement.target_role
    ]);
    if (!audience.rowCount) throw new HttpError(400, 'The announcement target has no active recipients.');
    await client.query(
      `INSERT INTO announcement_recipients (announcement_id, user_id)
       SELECT $1, audience.id FROM (${audienceSelect}) AS audience
       ON CONFLICT (announcement_id, user_id) DO NOTHING`,
      [announcement.id, announcement.target_type, announcement.target_id, announcement.target_role]
    );
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type, announcement_id)
       SELECT ar.user_id, $2, $3, 'ANNOUNCEMENT', ar.announcement_id
       FROM announcement_recipients ar
       WHERE ar.announcement_id = $1 AND ar.notification_id IS NULL`,
      [announcement.id, announcement.title, announcement.message]
    );
    await client.query(
      `UPDATE announcement_recipients ar
       SET notification_id = n.id
       FROM notifications n
       WHERE ar.announcement_id = $1 AND ar.user_id = n.user_id
         AND n.announcement_id = ar.announcement_id AND ar.notification_id IS NULL`,
      [announcement.id]
    );
    const published = await client.query(
      `UPDATE announcements SET status = 'PUBLISHED', published_at = NOW()
       WHERE id = $1
       RETURNING id, title, message, target_type, target_id, target_role, status, published_at`,
      [announcement.id]
    );
    await writeAudit(req, 'PUBLISH', 'ANNOUNCEMENT', announcement.id, {
      recipientCount: audience.rowCount
    }, client);
    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Announcement published.',
      data: { ...published.rows[0], recipientCount: audience.rowCount }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listAnnouncements(req, res) {
  const { page, limit, offset } = pagination(req.query);
  const manager = isAnnouncementManager(req.user);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM announcements a
     WHERE $2::boolean OR a.created_by = $1 OR EXISTS (
       SELECT 1 FROM announcement_recipients ar
       WHERE ar.announcement_id = a.id AND ar.user_id = $1 AND a.status = 'PUBLISHED'
     )`,
    [req.user.id, manager]
  );
  const result = await pool.query(
    `SELECT a.id, a.title, a.message, a.target_type, a.status, a.published_at, a.created_at,
       (a.created_by = $1) AS is_author
     FROM announcements a
     WHERE $2::boolean OR a.created_by = $1 OR EXISTS (
       SELECT 1 FROM announcement_recipients ar
       WHERE ar.announcement_id = a.id AND ar.user_id = $1 AND a.status = 'PUBLISHED'
     )
     ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.id DESC
     LIMIT $3 OFFSET $4`,
    [req.user.id, manager, limit, offset]
  );
  const total = count.rows[0].total;
  res.json({
    success: true, message: 'Announcements fetched.', data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

export async function getAnnouncement(req, res) {
  const announcementId = validId(req.params.id, 'Announcement ID');
  const result = await pool.query(
    `SELECT a.id, a.title, a.message, a.target_type, a.status, a.published_at, a.created_at,
       (a.created_by = $1) AS is_author,
       EXISTS (SELECT 1 FROM announcement_recipients ar
               WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS is_recipient
     FROM announcements a
     WHERE a.id = $2 AND (
       $3::boolean OR a.created_by = $1 OR EXISTS (
         SELECT 1 FROM announcement_recipients ar
         WHERE ar.announcement_id = a.id AND ar.user_id = $1 AND a.status = 'PUBLISHED'
       )
     )`,
    [req.user.id, announcementId, isAnnouncementManager(req.user)]
  );
  if (!result.rowCount) throw new HttpError(404, 'Announcement not found.');
  res.json({ success: true, message: 'Announcement fetched.', data: result.rows[0] });
}

function escapeLike(value) {
  return value.replace(/[!%_]/g, '!$&');
}

function permitted(user, permission) {
  return user.role === 'SUPER_ADMIN' || user.permissions.includes(permission);
}

const searchEntities = [
  {
    permission: 'students.read',
    sql: `SELECT 'student' AS entity_type, s.id, s.first_name || ' ' || s.last_name AS title,
             COALESCE(s.registration_number, s.student_number) AS subtitle
          FROM students s JOIN users u ON u.id = s.user_id
          WHERE s.status = 'ACTIVE'
            AND (s.first_name ILIKE $1 ESCAPE '!' OR s.last_name ILIKE $1 ESCAPE '!'
              OR s.student_id ILIKE $1 ESCAPE '!' OR s.registration_number ILIKE $1 ESCAPE '!'
              OR s.student_number ILIKE $1 ESCAPE '!')
            AND ($3 <> 'STUDENT' OR s.user_id = $4)
            AND ($3 <> 'FACULTY' OR EXISTS (
              SELECT 1 FROM faculty f JOIN course_assignments ca ON ca.faculty_id = f.id
              WHERE f.user_id = $4 AND ca.section_id = s.section_id AND ca.status = 'ACTIVE'
            ))
          ORDER BY s.last_name, s.first_name LIMIT $2`
  },
  {
    permission: 'faculty.read',
    sql: `SELECT 'faculty' AS entity_type, f.id, f.first_name || ' ' || f.last_name AS title,
             COALESCE(f.designation, d.name) AS subtitle
          FROM faculty f JOIN departments d ON d.id = f.department_id
          WHERE f.employment_status = 'ACTIVE'
            AND (f.first_name ILIKE $1 ESCAPE '!' OR f.last_name ILIKE $1 ESCAPE '!'
              OR f.employee_id ILIKE $1 ESCAPE '!' OR f.designation ILIKE $1 ESCAPE '!')
            AND ($3 <> 'FACULTY' OR f.user_id = $4)
          ORDER BY f.last_name, f.first_name LIMIT $2`
  },
  {
    permission: 'courses.read',
    sql: `SELECT 'course' AS entity_type, c.id, COALESCE(c.name, c.title) AS title,
             COALESCE(c.course_code, c.code) AS subtitle
          FROM courses c
          WHERE c.status = 'ACTIVE'
            AND (c.name ILIKE $1 ESCAPE '!' OR c.title ILIKE $1 ESCAPE '!'
              OR c.course_code ILIKE $1 ESCAPE '!' OR c.code ILIKE $1 ESCAPE '!')
            AND ($3 NOT IN ('STUDENT', 'FACULTY') OR EXISTS (
              SELECT 1 FROM course_assignments ca
              WHERE ca.course_id = c.id AND ca.status = 'ACTIVE'
                AND (($3 = 'FACULTY' AND ca.faculty_id = (
                  SELECT f.id FROM faculty f WHERE f.user_id = $4
                )) OR ($3 = 'STUDENT' AND ca.section_id = (
                  SELECT s.section_id FROM students s WHERE s.user_id = $4 AND s.status = 'ACTIVE'
                )))
            ))
          ORDER BY COALESCE(c.name, c.title) LIMIT $2`
  },
  {
    permission: 'departments.read',
    sql: `SELECT 'department' AS entity_type, d.id, d.name AS title, d.code AS subtitle
          FROM departments d
          WHERE d.status = 'ACTIVE'
            AND (d.name ILIKE $1 ESCAPE '!' OR d.code ILIKE $1 ESCAPE '!')
            AND ($3 NOT IN ('STUDENT', 'FACULTY') OR EXISTS (
              SELECT 1 FROM students s WHERE $3 = 'STUDENT' AND s.user_id = $4
                AND s.department_id = d.id AND s.status = 'ACTIVE'
              UNION ALL
              SELECT 1 FROM faculty f WHERE $3 = 'FACULTY' AND f.user_id = $4
                AND f.department_id = d.id AND f.employment_status = 'ACTIVE'
            ))
          ORDER BY d.name LIMIT $2`
  },
  {
    permission: 'programs.read',
    sql: `SELECT 'program' AS entity_type, p.id, p.name AS title, p.code AS subtitle
          FROM programs p
          WHERE p.status = 'ACTIVE' AND (p.name ILIKE $1 ESCAPE '!' OR p.code ILIKE $1 ESCAPE '!')
            AND ($3 NOT IN ('STUDENT', 'FACULTY') OR EXISTS (
              SELECT 1 FROM students s WHERE $3 = 'STUDENT' AND s.user_id = $4
                AND s.program_id = p.id AND s.status = 'ACTIVE'
              UNION ALL
              SELECT 1 FROM faculty f WHERE $3 = 'FACULTY' AND f.user_id = $4
                AND f.department_id = p.department_id AND f.employment_status = 'ACTIVE'
            ))
          ORDER BY p.name LIMIT $2`
  },
  {
    permission: 'library.books.read',
    sql: `SELECT 'book' AS entity_type, b.id, b.title, b.author AS subtitle
          FROM library_books b
          WHERE b.is_active
            AND (b.title ILIKE $1 ESCAPE '!' OR b.author ILIKE $1 ESCAPE '!'
              OR b.isbn ILIKE $1 ESCAPE '!' OR b.publisher ILIKE $1 ESCAPE '!')
          ORDER BY b.title LIMIT $2`
  }
];

export async function globalSearch(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 100) {
    throw new HttpError(400, 'Search query must contain 2–100 characters.');
  }
  const limit = Number(req.query.limit || 20);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new HttpError(400, 'Limit must be between 1 and 50.');
  }
  const pattern = `%${escapeLike(query)}%`;
  const searchable = searchEntities.filter((entity) => {
    if (permitted(req.user, entity.permission)) return true;
    if (req.user.role === 'STUDENT' && entity.permission === 'students.read') return true;
    if (req.user.role === 'FACULTY' && entity.permission === 'faculty.read') return true;
    if (['STUDENT', 'FACULTY'].includes(req.user.role)
        && entity.permission === 'courses.read'
        && permitted(req.user, 'course-assignments.read')) return true;
    if (req.user.role === 'STUDENT'
        && ['departments.read', 'programs.read'].includes(entity.permission)) return true;
    return false;
  });
  const results = await Promise.all(searchable.map(({ sql }) =>
    pool.query(sql, [pattern, limit, req.user.role, req.user.id])
  ));
  const data = results.flatMap((result) => result.rows).slice(0, limit);
  res.json({ success: true, message: 'Search completed.', data, meta: { query, limit } });
}

const activityEntities = {
  students: { table: 'students', permission: 'students.read' },
  faculty: { table: 'faculty', permission: 'faculty.read' },
  courses: { table: 'courses', permission: 'courses.read' },
  departments: { table: 'departments', permission: 'departments.read' },
  programs: { table: 'programs', permission: 'programs.read' },
  sections: { table: 'sections', permission: 'sections.read' },
  books: { table: 'library_books', permission: 'library.books.read', auditType: 'LIBRARY_BOOK' }
};

async function canViewActivityEntity(req, entity, id) {
  const { role, id: userId } = req.user;
  const hasPermission = permitted(req.user, entity.permission);
  const table = entity.table;
  if (role === 'STUDENT' && table === 'students') {
    const result = await pool.query(
      'SELECT 1 FROM students WHERE id = $1 AND user_id = $2 AND status = $3',
      [id, userId, 'ACTIVE']
    );
    return result.rowCount > 0;
  }
  if (role === 'FACULTY' && table === 'faculty') {
    const result = await pool.query(
      'SELECT 1 FROM faculty WHERE id = $1 AND user_id = $2 AND employment_status = $3',
      [id, userId, 'ACTIVE']
    );
    return result.rowCount > 0;
  }
  if (role === 'FACULTY' && table === 'students') {
    const result = await pool.query(
      `SELECT 1 FROM students s
       WHERE s.id = $1 AND EXISTS (
         SELECT 1 FROM faculty f JOIN course_assignments ca ON ca.faculty_id = f.id
         WHERE f.user_id = $2 AND ca.section_id = s.section_id AND ca.status = 'ACTIVE'
       )`,
      [id, userId]
    );
    return result.rowCount > 0;
  }
  if (role === 'STUDENT' && table === 'sections') {
    const result = await pool.query(
      'SELECT 1 FROM students WHERE section_id = $1 AND user_id = $2 AND status = $3',
      [id, userId, 'ACTIVE']
    );
    return result.rowCount > 0;
  }
  if (role === 'FACULTY' && table === 'sections') {
    const result = await pool.query(
      `SELECT 1 FROM course_assignments ca JOIN faculty f ON f.id = ca.faculty_id
       WHERE ca.section_id = $1 AND f.user_id = $2 AND ca.status = 'ACTIVE' LIMIT 1`,
      [id, userId]
    );
    return result.rowCount > 0;
  }
  if (['STUDENT', 'FACULTY'].includes(role) && ['departments', 'programs'].includes(table)) {
    let result;
    if (role === 'STUDENT') {
      const profileScope = table === 'departments' ? 'department_id' : 'program_id';
      result = await pool.query(
        `SELECT 1 FROM students s
         WHERE s.user_id = $1 AND s.${profileScope} = $2 AND s.status = 'ACTIVE'`,
        [userId, id]
      );
    } else if (table === 'departments') {
      result = await pool.query(
        `SELECT 1 FROM faculty f
         WHERE f.user_id = $1 AND f.department_id = $2 AND f.employment_status = 'ACTIVE'`,
        [userId, id]
      );
    } else {
      result = await pool.query(
        `SELECT 1 FROM faculty f JOIN programs p ON p.department_id = f.department_id
         WHERE f.user_id = $1 AND p.id = $2 AND f.employment_status = 'ACTIVE'`,
        [userId, id]
      );
    }
    return result.rowCount > 0;
  }
  if (['STUDENT', 'FACULTY'].includes(role) && table === 'courses') {
    if (!hasPermission && !permitted(req.user, 'course-assignments.read')) return false;
    if (role === 'STUDENT') {
      const result = await pool.query(
        `SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id
         WHERE e.course_id = $1 AND s.user_id = $2 AND s.status = 'ACTIVE' LIMIT 1`,
        [id, userId]
      );
      return result.rowCount > 0;
    }
    const result = await pool.query(
      `SELECT 1 FROM course_assignments ca JOIN faculty f ON f.id = ca.faculty_id
       WHERE ca.course_id = $1 AND f.user_id = $2 AND ca.status = 'ACTIVE' LIMIT 1`,
      [id, userId]
    );
    return result.rowCount > 0;
  }
  if (!hasPermission) return false;
  const result = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

export async function entityActivity(req, res) {
  const entityType = String(req.params.entityType || '').toLowerCase();
  const entity = activityEntities[entityType];
  if (!entity) throw new HttpError(404, 'Activity entity type not found.');
  const entityId = validId(req.params.entityId, 'Entity ID');
  if (!await canViewActivityEntity(req, entity, entityId)) {
    throw new HttpError(404, 'Activity entity not found.');
  }
  const { page, limit, offset } = pagination(req.query, 50);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM audit_logs
     WHERE LOWER(entity_type) = $1 AND entity_id = $2`,
    [(entity.auditType || entityType).toLowerCase(), String(entityId)]
  );
  const result = await pool.query(
    `SELECT action, created_at FROM audit_logs
     WHERE LOWER(entity_type) = $1 AND entity_id = $2
     ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [(entity.auditType || entityType).toLowerCase(), String(entityId), limit, offset]
  );
  const total = count.rows[0].total;
  res.json({
    success: true, message: 'Entity activity fetched.', data: result.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

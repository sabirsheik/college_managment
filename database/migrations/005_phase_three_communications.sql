CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  target_type VARCHAR(20) NOT NULL
    CHECK (target_type IN ('ALL_STUDENTS', 'ALL_FACULTY', 'DEPARTMENT', 'PROGRAM', 'SECTION', 'ROLE')),
  target_id INTEGER,
  target_role VARCHAR(40),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (target_type IN ('ALL_STUDENTS', 'ALL_FACULTY') AND target_id IS NULL AND target_role IS NULL)
    OR (target_type IN ('DEPARTMENT', 'PROGRAM', 'SECTION') AND target_id IS NOT NULL AND target_role IS NULL)
    OR (target_type = 'ROLE' AND target_id IS NULL AND target_role IS NOT NULL)
  ),
  CHECK ((status = 'DRAFT' AND published_at IS NULL) OR (status = 'PUBLISHED' AND published_at IS NOT NULL))
);
CREATE INDEX announcements_creator_created_idx ON announcements (created_by, created_at DESC);
CREATE INDEX announcements_status_published_idx ON announcements (status, published_at DESC);

CREATE TABLE announcement_recipients (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id INTEGER UNIQUE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX announcement_recipients_user_idx
  ON announcement_recipients (user_id, delivered_at DESC);

ALTER TABLE notifications
  ADD COLUMN announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE;
ALTER TABLE announcement_recipients
  ADD CONSTRAINT announcement_recipients_notification_fk
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL;
CREATE INDEX notifications_announcement_idx
  ON notifications (announcement_id, user_id) WHERE announcement_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('SUPER_ADMIN'), ('ADMIN'), ('FACULTY'), ('STUDENT'), ('ACCOUNTANT'), ('LIBRARIAN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) VALUES
  ('announcements.create', 'Create targeted announcement drafts.'),
  ('announcements.publish', 'Publish targeted announcements to recipients.'),
  ('announcements.read', 'Read announcements available to the current user.'),
  ('announcements.manage', 'Read and publish announcements created by other users.'),
  ('search.read', 'Search authorized college records.'),
  ('activity.read', 'Read activity history for authorized records.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE (r.name IN ('SUPER_ADMIN', 'ADMIN')
       AND p.name IN ('announcements.create', 'announcements.publish', 'announcements.manage'))
   OR (p.name IN ('announcements.read', 'search.read', 'activity.read')
       AND r.name IN ('SUPER_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN'))
ON CONFLICT DO NOTHING;

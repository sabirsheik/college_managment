CREATE TABLE library_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT library_categories_name_nonempty CHECK (LENGTH(BTRIM(name)) > 0)
);
CREATE UNIQUE INDEX library_categories_name_lower_unique ON library_categories (LOWER(name));

CREATE TABLE library_books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  author VARCHAR(180) NOT NULL,
  isbn VARCHAR(32),
  category_id INTEGER NOT NULL REFERENCES library_categories(id) ON DELETE RESTRICT,
  publisher VARCHAR(180),
  publication_year INTEGER CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 9999),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT library_books_title_nonempty CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT library_books_author_nonempty CHECK (LENGTH(BTRIM(author)) > 0)
);
CREATE UNIQUE INDEX library_books_isbn_unique ON library_books (UPPER(isbn)) WHERE isbn IS NOT NULL;
CREATE INDEX library_books_category_title_idx ON library_books (category_id, title);
CREATE INDEX library_books_active_idx ON library_books (is_active, title);

CREATE TABLE library_copies (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
  barcode VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'MAINTENANCE', 'LOST', 'RETIRED')),
  shelf_location VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT library_copies_barcode_nonempty CHECK (LENGTH(BTRIM(barcode)) > 0)
);
CREATE UNIQUE INDEX library_copies_barcode_lower_unique ON library_copies (LOWER(barcode));
CREATE INDEX library_copies_book_status_idx ON library_copies (book_id, status);

CREATE TABLE library_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  member_code VARCHAR(40) NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(30),
  max_active_loans INTEGER NOT NULL DEFAULT 5 CHECK (max_active_loans BETWEEN 1 AND 50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT library_members_code_nonempty CHECK (LENGTH(BTRIM(member_code)) > 0),
  CONSTRAINT library_members_name_nonempty CHECK (LENGTH(BTRIM(full_name)) > 0)
);
CREATE UNIQUE INDEX library_members_code_lower_unique ON library_members (LOWER(member_code));
CREATE UNIQUE INDEX library_members_email_lower_unique ON library_members (LOWER(email));
CREATE INDEX library_members_active_name_idx ON library_members (is_active, full_name);

CREATE TABLE library_loans (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES library_members(id) ON DELETE RESTRICT,
  copy_id INTEGER NOT NULL REFERENCES library_copies(id) ON DELETE RESTRICT,
  issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  returned_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  renewal_count INTEGER NOT NULL DEFAULT 0 CHECK (renewal_count BETWEEN 0 AND 2),
  daily_fine NUMERIC(8,2) NOT NULL DEFAULT 0.50 CHECK (daily_fine >= 0),
  overdue_days INTEGER NOT NULL DEFAULT 0 CHECK (overdue_days >= 0),
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
  CHECK (returned_at IS NULL OR returned_at >= issued_at)
);
CREATE UNIQUE INDEX library_loans_one_active_copy_idx
  ON library_loans (copy_id) WHERE returned_at IS NULL;
CREATE INDEX library_loans_member_active_idx ON library_loans (member_id, returned_at, due_date);
CREATE INDEX library_loans_overdue_idx ON library_loans (due_date) WHERE returned_at IS NULL;
CREATE INDEX library_loans_history_idx ON library_loans (issued_at DESC, id DESC);

INSERT INTO permissions (name, description) VALUES
  ('library.categories.read', 'View library categories'),
  ('library.categories.create', 'Create library categories'),
  ('library.categories.update', 'Update library categories'),
  ('library.categories.delete', 'Delete library categories'),
  ('library.books.read', 'View and search library books and availability'),
  ('library.books.create', 'Create library books'),
  ('library.books.update', 'Update library books'),
  ('library.books.delete', 'Delete library books'),
  ('library.copies.read', 'View library copies'),
  ('library.copies.create', 'Create library copies'),
  ('library.copies.update', 'Update library copies'),
  ('library.copies.delete', 'Delete library copies'),
  ('library.members.read', 'View library members'),
  ('library.members.create', 'Create library members'),
  ('library.members.update', 'Update library members'),
  ('library.members.delete', 'Delete library members'),
  ('library.loans.read', 'View library loans'),
  ('library.loans.create', 'Issue library copies'),
  ('library.loans.update', 'Return and renew library loans'),
  ('library.fines.read', 'View overdue and assessed library fines')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('LIBRARIAN', 'ADMIN') AND p.name LIKE 'library.%'
ON CONFLICT DO NOTHING;

CREATE FUNCTION assign_library_permissions_to_staff_role() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name IN ('LIBRARIAN', 'ADMIN') THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT NEW.id, p.id FROM permissions p WHERE p.name LIKE 'library.%'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roles_library_permissions_after_insert
AFTER INSERT ON roles
FOR EACH ROW EXECUTE FUNCTION assign_library_permissions_to_staff_role();

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30),
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));
CREATE INDEX users_role_active_idx ON users (role_id, is_active);

CREATE TABLE college_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  college_name VARCHAR(180) NOT NULL DEFAULT 'College',
  logo_url TEXT,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(254),
  website VARCHAR(255),
  academic_year VARCHAR(20),
  timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  country VARCHAR(100),
  state VARCHAR(100),
  city VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO college_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE academic_sessions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'COMPLETED'))
);
CREATE UNIQUE INDEX academic_sessions_one_current_idx
  ON academic_sessions (is_current) WHERE is_current = TRUE;
CREATE INDEX academic_sessions_status_dates_idx ON academic_sessions (status, start_date, end_date);

CREATE TABLE programs (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  degree_level VARCHAR(40) NOT NULL,
  duration_years INTEGER NOT NULL CHECK (duration_years BETWEEN 1 AND 12),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, name),
  CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE INDEX programs_status_department_idx ON programs (status, department_id);

ALTER TABLE departments
  ADD COLUMN description TEXT,
  ADD COLUMN head_of_department INTEGER,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT departments_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE departments
  ADD CONSTRAINT departments_head_fk
  FOREIGN KEY (head_of_department) REFERENCES faculty(id) ON DELETE SET NULL;
CREATE INDEX departments_status_name_idx ON departments (status, name);

ALTER TABLE students
  ADD COLUMN student_id VARCHAR(30) UNIQUE,
  ADD COLUMN registration_number VARCHAR(40) UNIQUE,
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN gender VARCHAR(30),
  ADD COLUMN phone VARCHAR(30),
  ADD COLUMN address TEXT,
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN state VARCHAR(100),
  ADD COLUMN country VARCHAR(100),
  ADD COLUMN guardian_name VARCHAR(160),
  ADD COLUMN guardian_phone VARCHAR(30),
  ADD COLUMN emergency_contact VARCHAR(30),
  ADD COLUMN user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
  ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  ADD COLUMN admission_date DATE,
  ADD COLUMN semester INTEGER,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN profile_image TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT students_semester_check CHECK (semester IS NULL OR semester BETWEEN 1 AND 20),
  ADD CONSTRAINT students_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN'));
ALTER TABLE students ALTER COLUMN enrollment_year SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;
CREATE INDEX students_program_session_status_idx ON students (program_id, academic_session_id, status);
CREATE UNIQUE INDEX students_email_lower_unique ON students (LOWER(email));

ALTER TABLE faculty
  ADD COLUMN employee_id VARCHAR(30) UNIQUE,
  ADD COLUMN user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN phone VARCHAR(30),
  ADD COLUMN designation VARCHAR(120),
  ADD COLUMN qualification VARCHAR(160),
  ADD COLUMN joining_date DATE,
  ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN specialization VARCHAR(160),
  ADD COLUMN profile_image TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT faculty_employment_status_check
    CHECK (employment_status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED'));
CREATE INDEX faculty_department_status_idx ON faculty (department_id, employment_status);
CREATE UNIQUE INDEX faculty_email_lower_unique ON faculty (LOWER(email));

ALTER TABLE courses
  ADD COLUMN course_code VARCHAR(20),
  ADD COLUMN name VARCHAR(160),
  ADD COLUMN description TEXT,
  ADD COLUMN credit_hours NUMERIC(4,1),
  ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE RESTRICT,
  ADD COLUMN semester INTEGER,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD CONSTRAINT courses_program_semester_check
    CHECK (semester IS NULL OR semester BETWEEN 1 AND 20),
  ADD CONSTRAINT courses_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));
UPDATE courses SET course_code = code WHERE course_code IS NULL;
UPDATE courses SET name = title WHERE name IS NULL;
UPDATE courses SET credit_hours = credits WHERE credit_hours IS NULL;
ALTER TABLE courses ADD CONSTRAINT courses_course_code_unique UNIQUE (course_code);
ALTER TABLE courses ALTER COLUMN course_code SET NOT NULL;
ALTER TABLE courses ALTER COLUMN name SET NOT NULL;
ALTER TABLE courses ALTER COLUMN credit_hours SET NOT NULL;
ALTER TABLE courses ALTER COLUMN code DROP NOT NULL;
ALTER TABLE courses ALTER COLUMN title DROP NOT NULL;
ALTER TABLE courses ALTER COLUMN credits DROP NOT NULL;
CREATE INDEX courses_program_status_idx ON courses (program_id, status);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_entity_created_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_user_created_idx ON audit_logs (user_id, created_at DESC);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'INFO',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_user_unread_created_idx
  ON notifications (user_id, is_read, created_at DESC);

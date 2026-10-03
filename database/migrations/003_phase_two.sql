CREATE TABLE classrooms (
  id SERIAL PRIMARY KEY,
  building VARCHAR(120) NOT NULL,
  room_number VARCHAR(40) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  room_type VARCHAR(30) NOT NULL CHECK (room_type IN ('LECTURE_HALL', 'LAB', 'CLASSROOM', 'SEMINAR_ROOM')),
  facilities TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX classrooms_building_room_lower_unique ON classrooms (LOWER(building), LOWER(room_number));
CREATE INDEX classrooms_status_type_idx ON classrooms (status, room_type);

CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 20),
  name VARCHAR(40) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, academic_session_id, semester, name),
  UNIQUE (id, program_id, academic_session_id, semester)
);
CREATE INDEX sections_session_program_idx ON sections (academic_session_id, program_id, semester, status);

ALTER TABLE students
  ADD COLUMN section_id INTEGER,
  ADD CONSTRAINT students_section_fields_check
    CHECK (section_id IS NULL OR (program_id IS NOT NULL AND academic_session_id IS NOT NULL AND semester IS NOT NULL)),
  ADD CONSTRAINT students_section_match_fk
    FOREIGN KEY (section_id, program_id, academic_session_id, semester)
    REFERENCES sections(id, program_id, academic_session_id, semester) ON DELETE RESTRICT;
CREATE INDEX students_section_status_idx ON students (section_id, status);

CREATE TABLE course_assignments (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 20),
  classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, section_id, academic_session_id, semester)
);
ALTER TABLE courses ADD CONSTRAINT courses_id_program_unique UNIQUE (id, program_id);
ALTER TABLE course_assignments
  ADD CONSTRAINT course_assignments_section_match_fk
    FOREIGN KEY (section_id, program_id, academic_session_id, semester)
    REFERENCES sections(id, program_id, academic_session_id, semester) ON DELETE RESTRICT,
  ADD CONSTRAINT course_assignments_course_program_fk
    FOREIGN KEY (course_id, program_id) REFERENCES courses(id, program_id) ON DELETE RESTRICT;
CREATE INDEX course_assignments_faculty_session_idx ON course_assignments (faculty_id, academic_session_id, status);
CREATE INDEX course_assignments_section_idx ON course_assignments (section_id, academic_session_id);

ALTER TABLE enrollments
  ADD COLUMN academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  ADD COLUMN semester_number INTEGER CHECK (semester_number BETWEEN 1 AND 20),
  ADD COLUMN enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_student_id_course_id_semester_key;
CREATE UNIQUE INDEX enrollments_student_course_session_semester_unique
  ON enrollments (student_id, course_id, academic_session_id, semester_number)
  WHERE academic_session_id IS NOT NULL AND semester_number IS NOT NULL;
CREATE INDEX enrollments_session_course_idx ON enrollments (academic_session_id, course_id, status);

CREATE FUNCTION validate_phase_two_enrollment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  student_record RECORD;
BEGIN
  IF NEW.academic_session_id IS NULL OR NEW.semester_number IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT section_id, academic_session_id, semester, status
    INTO student_record FROM students WHERE id=NEW.student_id;
  IF student_record.status <> 'ACTIVE' OR student_record.section_id IS NULL
     OR student_record.academic_session_id <> NEW.academic_session_id
     OR student_record.semester <> NEW.semester_number THEN
    RAISE EXCEPTION 'student enrollment does not match the active student section' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM course_assignments
    WHERE course_id=NEW.course_id AND section_id=student_record.section_id
      AND academic_session_id=NEW.academic_session_id AND semester=NEW.semester_number
      AND status='ACTIVE'
  ) THEN
    RAISE EXCEPTION 'course is not assigned to the student section' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enrollments_phase_two_validate_trigger
  BEFORE INSERT OR UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION validate_phase_two_enrollment();

CREATE TABLE timetable (
  id SERIAL PRIMARY KEY,
  course_assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX timetable_classroom_day_time_idx ON timetable (classroom_id, day_of_week, start_time, end_time);
CREATE INDEX timetable_assignment_day_time_idx ON timetable (course_assignment_id, day_of_week, start_time, end_time);

CREATE FUNCTION validate_timetable_conflict() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  assigned_faculty INTEGER;
  assigned_section INTEGER;
  assigned_session INTEGER;
  assigned_classroom INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(7351, 3);
  SELECT faculty_id, section_id, academic_session_id, classroom_id
    INTO assigned_faculty, assigned_section, assigned_session, assigned_classroom
  FROM course_assignments WHERE id=NEW.course_assignment_id;
  IF assigned_classroom IS NOT NULL AND assigned_classroom <> NEW.classroom_id THEN
    RAISE EXCEPTION 'timetable classroom differs from the assigned classroom' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM timetable t JOIN course_assignments ca ON ca.id=t.course_assignment_id
      JOIN academic_sessions old_session ON old_session.id=ca.academic_session_id
      JOIN academic_sessions new_session ON new_session.id=assigned_session
    WHERE t.id <> COALESCE(NEW.id, -1) AND t.day_of_week=NEW.day_of_week
      AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time
      AND (t.classroom_id=NEW.classroom_id OR ca.faculty_id=assigned_faculty OR ca.section_id=assigned_section)
      AND ca.status='ACTIVE'
      AND new_session.start_date <= old_session.end_date
      AND old_session.start_date <= new_session.end_date
  ) THEN
    RAISE EXCEPTION 'room, faculty, or section timetable conflict' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER timetable_conflict_validate_trigger
  BEFORE INSERT OR UPDATE ON timetable
  FOR EACH ROW EXECUTE FUNCTION validate_timetable_conflict();

CREATE FUNCTION protect_scheduled_assignment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(7351, 3);
  IF (OLD.faculty_id, OLD.course_id, OLD.section_id, OLD.academic_session_id,
      OLD.semester, OLD.classroom_id, OLD.status)
     IS DISTINCT FROM
     (NEW.faculty_id, NEW.course_id, NEW.section_id, NEW.academic_session_id,
      NEW.semester, NEW.classroom_id, NEW.status)
     AND EXISTS (SELECT 1 FROM timetable WHERE course_assignment_id=OLD.id) THEN
    RAISE EXCEPTION 'delete timetable entries before changing a scheduled assignment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER course_assignments_schedule_protect_trigger
  BEFORE UPDATE ON course_assignments
  FOR EACH ROW EXECUTE FUNCTION protect_scheduled_assignment();

CREATE TABLE attendance_sessions (
  id SERIAL PRIMARY KEY,
  course_assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  topic VARCHAR(200),
  marked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_assignment_id, attendance_date)
);
CREATE INDEX attendance_sessions_date_assignment_idx ON attendance_sessions (attendance_date, course_assignment_id);

CREATE TABLE attendance_records (
  id SERIAL PRIMARY KEY,
  attendance_session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attendance_session_id, student_id)
);
CREATE INDEX attendance_records_student_idx ON attendance_records (student_id, status, attendance_session_id);

CREATE FUNCTION validate_attendance_section_student() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  expected_section INTEGER;
  student_section INTEGER;
  student_status VARCHAR(20);
BEGIN
  SELECT ca.section_id INTO expected_section
  FROM attendance_sessions a JOIN course_assignments ca ON ca.id=a.course_assignment_id
  WHERE a.id=NEW.attendance_session_id;
  SELECT section_id, status INTO student_section, student_status FROM students WHERE id=NEW.student_id;
  IF student_status <> 'ACTIVE' OR student_section IS DISTINCT FROM expected_section THEN
    RAISE EXCEPTION 'attendance student is not active in the assigned section' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_records_section_validate_trigger
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION validate_attendance_section_student();

CREATE TABLE exams (
  id SERIAL PRIMARY KEY,
  course_assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('QUIZ', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ASSIGNMENT')),
  exam_date DATE NOT NULL,
  maximum_marks NUMERIC(8,2) NOT NULL CHECK (maximum_marks > 0),
  passing_marks NUMERIC(8,2) NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= maximum_marks),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_assignment_id, name, exam_date)
);
CREATE INDEX exams_assignment_date_idx ON exams (course_assignment_id, exam_date, exam_type);
CREATE UNIQUE INDEX exams_one_final_per_assignment_unique
  ON exams (course_assignment_id) WHERE exam_type = 'FINAL';

CREATE TABLE grade_scales (
  id SERIAL PRIMARY KEY,
  letter_grade VARCHAR(5) NOT NULL UNIQUE,
  minimum_percentage NUMERIC(5,2) NOT NULL CHECK (minimum_percentage BETWEEN 0 AND 100),
  maximum_percentage NUMERIC(5,2) NOT NULL CHECK (maximum_percentage BETWEEN 0 AND 100),
  grade_point NUMERIC(4,2) NOT NULL CHECK (grade_point BETWEEN 0 AND 4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (maximum_percentage >= minimum_percentage)
);
CREATE INDEX grade_scales_active_minimum_idx ON grade_scales (is_active, minimum_percentage DESC);
INSERT INTO grade_scales (letter_grade, minimum_percentage, maximum_percentage, grade_point) VALUES
  ('A+', 95, 100, 4.00), ('A', 90, 94.99, 4.00),
  ('B+', 85, 89.99, 3.50), ('B', 80, 84.99, 3.00),
  ('C+', 75, 79.99, 2.50), ('C', 70, 74.99, 2.00),
  ('D', 60, 69.99, 1.00), ('F', 0, 59.99, 0.00)
ON CONFLICT (letter_grade) DO NOTHING;

CREATE TABLE exam_results (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  marks_obtained NUMERIC(8,2) NOT NULL CHECK (marks_obtained >= 0),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  letter_grade VARCHAR(5) NOT NULL REFERENCES grade_scales(letter_grade) ON DELETE RESTRICT,
  grade_point NUMERIC(4,2) NOT NULL CHECK (grade_point BETWEEN 0 AND 4),
  graded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);
CREATE INDEX exam_results_student_exam_idx ON exam_results (student_id, exam_id);

CREATE FUNCTION validate_exam_result() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  max_marks NUMERIC(8,2);
  expected_percentage NUMERIC(5,2);
  expected_grade VARCHAR(5);
  expected_point NUMERIC(4,2);
BEGIN
  SELECT maximum_marks INTO max_marks FROM exams WHERE id = NEW.exam_id;
  IF max_marks IS NULL OR NEW.marks_obtained > max_marks THEN
    RAISE EXCEPTION 'marks_obtained exceeds the exam maximum' USING ERRCODE = '23514';
  END IF;
  expected_percentage := ROUND(NEW.marks_obtained * 100 / max_marks, 2);
  IF NEW.percentage <> expected_percentage THEN
    RAISE EXCEPTION 'percentage must match marks_obtained' USING ERRCODE = '23514';
  END IF;
  SELECT letter_grade, grade_point INTO expected_grade, expected_point
  FROM grade_scales
  WHERE is_active AND expected_percentage BETWEEN minimum_percentage AND maximum_percentage
  ORDER BY minimum_percentage DESC LIMIT 1;
  IF expected_grade IS NULL OR NEW.letter_grade <> expected_grade OR NEW.grade_point <> expected_point THEN
    RAISE EXCEPTION 'grade values must match the active grade scale' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER exam_results_validate_trigger
  BEFORE INSERT OR UPDATE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION validate_exam_result();

CREATE TABLE fee_structures (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 20),
  academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('TUITION', 'ADMISSION', 'EXAM', 'LIBRARY', 'LAB', 'OTHER')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description VARCHAR(500),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, semester, academic_session_id, fee_type)
);
CREATE INDEX fee_structures_session_program_idx ON fee_structures (academic_session_id, program_id, semester, status);

CREATE TABLE student_fees (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE RESTRICT,
  academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 20),
  fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('TUITION', 'ADMISSION', 'EXAM', 'LIBRARY', 'LAB', 'OTHER')),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  scholarship NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (scholarship >= 0),
  late_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (discount + scholarship <= total_amount),
  CHECK (paid_amount + remaining_amount = total_amount - discount - scholarship + late_fee)
);
CREATE INDEX student_fees_student_status_due_idx ON student_fees (student_id, status, due_date);
CREATE INDEX student_fees_session_status_idx ON student_fees (academic_session_id, status, due_date);
CREATE UNIQUE INDEX student_fees_structure_student_unique
  ON student_fees (student_id, fee_structure_id) WHERE fee_structure_id IS NOT NULL;

CREATE SEQUENCE receipt_number_seq;
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  receipt_number VARCHAR(40) NOT NULL UNIQUE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  fee_id INTEGER NOT NULL REFERENCES student_fees(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE')),
  transaction_reference VARCHAR(120),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (payment_method = 'CASH' OR (transaction_reference IS NOT NULL AND BTRIM(transaction_reference) <> ''))
);
CREATE UNIQUE INDEX payments_transaction_reference_unique
  ON payments (transaction_reference)
  WHERE transaction_reference IS NOT NULL AND transaction_reference <> '';
CREATE INDEX payments_student_date_idx ON payments (student_id, payment_date DESC);
CREATE INDEX payments_fee_idx ON payments (fee_id, payment_date);

CREATE FUNCTION validate_payment_balance() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  outstanding NUMERIC(12,2);
  fee_student INTEGER;
BEGIN
  SELECT remaining_amount, student_id INTO outstanding, fee_student
  FROM student_fees WHERE id=NEW.fee_id FOR UPDATE;
  IF outstanding IS NULL OR NEW.student_id <> fee_student OR NEW.amount > outstanding THEN
    RAISE EXCEPTION 'payment does not match the fee or exceeds its outstanding balance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_balance_validate_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION validate_payment_balance();

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  student_fee_id INTEGER NOT NULL UNIQUE REFERENCES student_fees(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'VOID')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE SEQUENCE invoice_number_seq;

CREATE TABLE student_documents (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_provider VARCHAR(30) NOT NULL CHECK (storage_provider IN ('LOCAL', 'S3', 'CLOUDINARY', 'FIREBASE')),
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX student_documents_student_type_idx ON student_documents (student_id, document_type, created_at DESC);

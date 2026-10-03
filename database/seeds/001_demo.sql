INSERT INTO departments (name, code) VALUES
  ('Computer Science', 'CS'),
  ('Business Administration', 'BUS'),
  ('Applied Sciences', 'SCI')
ON CONFLICT (code) DO NOTHING;

INSERT INTO faculty (first_name, last_name, email, department_id)
SELECT 'Avery', 'Morgan', 'avery.morgan@example.edu', id
FROM departments WHERE code = 'CS'
ON CONFLICT (email) DO NOTHING;

INSERT INTO students
  (student_number, first_name, last_name, email, department_id, enrollment_year)
SELECT 'STU-1001', 'Jordan', 'Lee', 'jordan.lee@example.edu', id, 2025
FROM departments WHERE code = 'CS'
ON CONFLICT (student_number) DO NOTHING;

INSERT INTO courses (code, title, credits, department_id, faculty_id)
SELECT 'CS-101', 'Introduction to Computing', 3, d.id, f.id
FROM departments d CROSS JOIN faculty f
WHERE d.code = 'CS' AND f.email = 'avery.morgan@example.edu'
ON CONFLICT (code) DO NOTHING;

INSERT INTO enrollments (student_id, course_id, semester)
SELECT s.id, c.id, 'Fall 2025'
FROM students s CROSS JOIN courses c
WHERE s.student_number = 'STU-1001' AND c.code = 'CS-101'
ON CONFLICT (student_id, course_id, semester) DO NOTHING;

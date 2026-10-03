export const resourceConfig = {
  users: {
    label: 'Users',
    singular: 'user',
    icon: 'US',
    permission: 'users',
    detailPath: (row) => `/users/${row.id}`,
    columns: [
      { key: 'name', label: 'Name', render: (row) => `${row.first_name} ${row.last_name}` },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', badge: true },
      { key: 'is_active', label: 'Account', render: (row) => row.is_active ? 'Active' : 'Inactive', badge: true },
      { key: 'last_login_at', label: 'Last sign in', date: true }
    ],
    fields: [
      { key: 'first_name', label: 'First name', required: true },
      { key: 'last_name', label: 'Last name', required: true },
      { key: 'email', label: 'Email address', type: 'email', required: true },
      { key: 'user_id', label: 'Campus user account', option: 'users', optionLabel: 'email', nullable: true },
      { key: 'phone', label: 'Phone number' },
      { key: 'role', label: 'Role', option: 'roles', optionLabel: 'name', required: true },
      { key: 'is_active', label: 'Account status', options: [['true', 'Active'], ['false', 'Inactive']], type: 'boolean', editOnly: true },
      { key: 'password', label: 'Temporary password', type: 'password', minLength: 12, createOnly: true, required: true }
    ],
    filters: [
      { key: 'role', label: 'All roles', optionsSource: 'roles', optionValue: 'name', optionLabel: 'name' },
      { key: 'active', label: 'All account states', options: [['true', 'Active'], ['false', 'Inactive']] }
    ],
    sortFields: ['created_at', 'email', 'first_name', 'last_name', 'role', 'last_login_at']
  },
  students: {
    label: 'Students',
    singular: 'student',
    icon: 'ST',
    permission: 'students',
    detailPath: (row) => `/students/${row.id}`,
    columns: [
      { key: 'student_id', label: 'Student ID' },
      { key: 'registration_number', label: 'Registration no.' },
      { key: 'name', label: 'Student', render: (row) => `${row.first_name} ${row.last_name}` },
      { key: 'program_name', label: 'Program' },
      { key: 'department_name', label: 'Department' },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'registration_number', label: 'Registration number', required: true },
      { key: 'first_name', label: 'First name', required: true },
      { key: 'last_name', label: 'Last name', required: true },
      { key: 'email', label: 'Email address', type: 'email', required: true },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
      { key: 'profile_image', label: 'Profile image URL', type: 'url' },
      { key: 'gender', label: 'Gender' },
      { key: 'phone', label: 'Phone' },
      { key: 'department_id', label: 'Department', option: 'departments', required: true },
      { key: 'program_id', label: 'Program', option: 'programs' },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions' },
      { key: 'admission_date', label: 'Admission date', type: 'date' },
      { key: 'semester', label: 'Semester', type: 'number', min: 1, max: 20 },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State / province' },
      { key: 'country', label: 'Country' },
      { key: 'guardian_name', label: 'Guardian name' },
      { key: 'guardian_phone', label: 'Guardian phone' },
      { key: 'emergency_contact', label: 'Emergency contact' },
      { key: 'status', label: 'Status', options: [
        ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['GRADUATED', 'Graduated'],
        ['SUSPENDED', 'Suspended'], ['WITHDRAWN', 'Withdrawn']
      ], required: true }
    ],
    filters: [
      { key: 'status', label: 'All statuses', options: [
        ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['GRADUATED', 'Graduated'],
        ['SUSPENDED', 'Suspended'], ['WITHDRAWN', 'Withdrawn']
      ] },
      { key: 'department_id', label: 'All departments', optionsSource: 'departments', optionValue: 'id', optionLabel: 'name' },
      { key: 'program_id', label: 'All programs', optionsSource: 'programs', optionValue: 'id', optionLabel: 'name' },
      { key: 'academic_session_id', label: 'All sessions', optionsSource: 'academic-sessions', optionValue: 'id', optionLabel: 'name' }
    ],
    sortFields: ['student_id', 'registration_number', 'first_name', 'last_name', 'admission_date', 'status', 'created_at']
  },
  faculty: {
    label: 'Faculty',
    singular: 'faculty member',
    icon: 'FC',
    permission: 'faculty',
    detailPath: (row) => `/faculty/${row.id}`,
    columns: [
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'name', label: 'Faculty member', render: (row) => `${row.first_name} ${row.last_name}` },
      { key: 'designation', label: 'Designation' },
      { key: 'department_name', label: 'Department' },
      { key: 'employment_status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'first_name', label: 'First name', required: true },
      { key: 'last_name', label: 'Last name', required: true },
      { key: 'email', label: 'Email address', type: 'email', required: true },
      { key: 'phone', label: 'Phone' },
      { key: 'user_id', label: 'Campus user account', option: 'users', optionLabel: 'email', nullable: true },
      { key: 'department_id', label: 'Department', option: 'departments', required: true },
      { key: 'designation', label: 'Designation' },
      { key: 'qualification', label: 'Qualification' },
      { key: 'specialization', label: 'Specialization' },
      { key: 'profile_image', label: 'Profile image URL', type: 'url' },
      { key: 'joining_date', label: 'Joining date', type: 'date' },
      { key: 'employment_status', label: 'Employment status', options: [
        ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['ON_LEAVE', 'On leave'], ['RESIGNED', 'Resigned']
      ], required: true }
    ],
    filters: [
      { key: 'employment_status', label: 'All statuses', options: [
        ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['ON_LEAVE', 'On leave'], ['RESIGNED', 'Resigned']
      ] },
      { key: 'department_id', label: 'All departments', optionsSource: 'departments', optionValue: 'id', optionLabel: 'name' }
    ],
    sortFields: ['employee_id', 'first_name', 'last_name', 'designation', 'joining_date', 'employment_status', 'created_at']
  },
  departments: {
    label: 'Departments',
    singular: 'department',
    icon: 'DP',
    permission: 'departments',
    columns: [
      { key: 'name', label: 'Department' },
      { key: 'code', label: 'Code' },
      { key: 'head_name', label: 'Department head' },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'name', label: 'Department name', required: true },
      { key: 'code', label: 'Department code', required: true },
      { key: 'description', label: 'Description' },
      { key: 'head_of_department', label: 'Department head', option: 'faculty', nullable: true, editOnly: true },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [
      { key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] }
    ],
    sortFields: ['name', 'code', 'status', 'created_at']
  },
  'academic-sessions': {
    label: 'Academic sessions',
    singular: 'academic session',
    icon: 'AS',
    permission: 'academic-sessions',
    columns: [
      { key: 'name', label: 'Session' },
      { key: 'start_date', label: 'Start date', date: true },
      { key: 'end_date', label: 'End date', date: true },
      { key: 'is_current', label: 'Current', render: (row) => row.is_current ? 'Current' : '—' },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'name', label: 'Session name', required: true },
      { key: 'start_date', label: 'Start date', type: 'date', required: true },
      { key: 'end_date', label: 'End date', type: 'date', required: true },
      { key: 'is_current', label: 'Current session', options: [['true', 'Yes'], ['false', 'No']], type: 'boolean', required: true },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['COMPLETED', 'Completed']], required: true }
    ],
    filters: [
      { key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['COMPLETED', 'Completed']] },
      { key: 'is_current', label: 'Current / past', options: [['true', 'Current'], ['false', 'Not current']] }
    ],
    sortFields: ['name', 'start_date', 'end_date', 'status', 'created_at']
  },
  programs: {
    label: 'Programs',
    singular: 'program',
    icon: 'PG',
    permission: 'programs',
    columns: [
      { key: 'code', label: 'Program code' },
      { key: 'name', label: 'Program' },
      { key: 'degree_level', label: 'Degree level' },
      { key: 'department_name', label: 'Department' },
      { key: 'duration_years', label: 'Duration' },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'name', label: 'Program name', required: true },
      { key: 'code', label: 'Program code', required: true },
      { key: 'degree_level', label: 'Degree level', required: true },
      { key: 'duration_years', label: 'Duration (years)', type: 'number', min: 1, max: 12, required: true },
      { key: 'department_id', label: 'Department', option: 'departments', required: true },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [
      { key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] },
      { key: 'department_id', label: 'All departments', optionsSource: 'departments', optionValue: 'id', optionLabel: 'name' }
    ],
    sortFields: ['name', 'code', 'degree_level', 'duration_years', 'status', 'created_at']
  },
  courses: {
    label: 'Courses',
    singular: 'course',
    icon: 'CR',
    permission: 'courses',
    columns: [
      { key: 'course_code', label: 'Course code' },
      { key: 'name', label: 'Course' },
      { key: 'program_name', label: 'Program' },
      { key: 'department_name', label: 'Department' },
      { key: 'faculty_name', label: 'Instructor' },
      { key: 'credit_hours', label: 'Credit hours' },
      { key: 'semester', label: 'Semester' }
    ],
    fields: [
      { key: 'course_code', label: 'Course code', required: true },
      { key: 'name', label: 'Course name', required: true },
      { key: 'credit_hours', label: 'Credit hours', type: 'number', min: 0.5, max: 30, step: 0.5, required: true },
      { key: 'department_id', label: 'Department', option: 'departments', required: true },
      { key: 'program_id', label: 'Program', option: 'programs', required: true },
      { key: 'faculty_id', label: 'Instructor', option: 'faculty', nullable: true },
      { key: 'semester', label: 'Semester', type: 'number', min: 1, max: 20, required: true },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [
      { key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] },
      { key: 'department_id', label: 'All departments', optionsSource: 'departments', optionValue: 'id', optionLabel: 'name' },
      { key: 'program_id', label: 'All programs', optionsSource: 'programs', optionValue: 'id', optionLabel: 'name' },
      { key: 'semester', label: 'All semesters', options: Array.from({ length: 20 }, (_, index) => [String(index + 1), `Semester ${index + 1}`]) }
    ],
    sortFields: ['course_code', 'name', 'credit_hours', 'semester', 'status', 'created_at']
  },
  enrollments: {
    label: 'Enrollments',
    singular: 'enrollment',
    icon: 'EN',
    permission: 'enrollments',
    actionPermissions: { create: 'enrollments.create', update: 'enrollments.manage' },
    noDelete: true,
    columns: [
      { key: 'student_name', label: 'Student' },
      { key: 'course_name', label: 'Course' },
      { key: 'semester_number', label: 'Semester' },
      { key: 'status', label: 'Status', badge: true },
      { key: 'enrollment_date', label: 'Enrolled', date: true }
    ],
    fields: [
      { key: 'student_id', label: 'Student', option: 'students', optionLabel: 'student_id', required: true, createOnly: true },
      { key: 'course_id', label: 'Course', option: 'courses', optionLabel: 'name', required: true, createOnly: true },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions', required: true, createOnly: true },
      { key: 'semester', label: 'Semester number', type: 'number', min: 1, max: 20, required: true, createOnly: true },
      { key: 'status', label: 'Status', options: [['enrolled', 'Enrolled'], ['completed', 'Completed'], ['withdrawn', 'Withdrawn']], required: true, updateOnly: true }
    ],
    filters: [{ key: 'status', label: 'All statuses', options: [['enrolled', 'Enrolled'], ['completed', 'Completed'], ['withdrawn', 'Withdrawn']] }],
    sortFields: ['semester_number', 'status', 'enrollment_date']
  },
  classrooms: {
    label: 'Classrooms',
    singular: 'classroom',
    icon: 'CR',
    permission: 'classrooms',
    navigationPermission: 'classrooms.read',
    actionPermissions: { create: 'classrooms.manage', update: 'classrooms.manage' },
    noDelete: true,
    columns: [
      { key: 'building', label: 'Building' }, { key: 'room_number', label: 'Room number' },
      { key: 'room_type', label: 'Room type' }, { key: 'capacity', label: 'Capacity' },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'building', label: 'Building', required: true },
      { key: 'room_number', label: 'Room number', required: true },
      { key: 'capacity', label: 'Capacity', type: 'number', min: 1, required: true },
      { key: 'room_type', label: 'Room type', options: [['LECTURE_HALL', 'Lecture hall'], ['LAB', 'Lab'], ['CLASSROOM', 'Classroom'], ['SEMINAR_ROOM', 'Seminar room']], required: true },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [{ key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] }],
    sortFields: ['building', 'room_number', 'capacity', 'created_at']
  },
  sections: {
    label: 'Sections',
    singular: 'section',
    icon: 'SC',
    permission: 'sections',
    navigationPermission: 'sections.read',
    actionPermissions: { create: 'sections.manage', update: 'sections.manage' },
    noDelete: true,
    columns: [
      { key: 'name', label: 'Section' },
      { key: 'program_name', label: 'Program' }, { key: 'academic_session_name', label: 'Session' },
      { key: 'semester', label: 'Semester' }, { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'name', label: 'Section name', required: true },
      { key: 'program_id', label: 'Program', option: 'programs', required: true },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions', required: true },
      { key: 'semester', label: 'Semester', type: 'number', min: 1, max: 20, required: true },
      { key: 'capacity', label: 'Capacity', type: 'number', min: 1, required: true },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [{ key: 'program_id', label: 'All programs', optionsSource: 'programs', optionValue: 'id', optionLabel: 'name' }],
    sortFields: ['name', 'semester', 'created_at']
  },
  'course-assignments': {
    label: 'Course assignments',
    singular: 'course assignment',
    icon: 'CA',
    permission: 'course-assignments',
    navigationPermission: 'course-assignments.read',
    actionPermissions: { create: 'course-assignments.manage', update: 'course-assignments.manage' },
    noDelete: true,
    columns: [
      { key: 'course_code', label: 'Course code' }, { key: 'course_name', label: 'Course' },
      { key: 'faculty_name', label: 'Faculty' }, { key: 'section_name', label: 'Section' },
      { key: 'academic_session_name', label: 'Session' }, { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'course_id', label: 'Course', option: 'courses', required: true },
      { key: 'faculty_id', label: 'Faculty member', option: 'faculty', required: true },
      { key: 'section_id', label: 'Section', option: 'sections', required: true },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions', required: true },
      { key: 'semester', label: 'Semester number', type: 'number', min: 1, max: 20, required: true },
      { key: 'classroom_id', label: 'Classroom', option: 'classrooms', optionLabel: 'room_number', nullable: true },
      { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']], required: true }
    ],
    filters: [{ key: 'academic_session_id', label: 'All sessions', optionsSource: 'academic-sessions', optionValue: 'id', optionLabel: 'name' }],
    sortFields: ['course_code', 'course_name', 'faculty_name', 'created_at']
  },
  timetable: {
    label: 'Timetable',
    singular: 'timetable slot',
    icon: 'TT',
    permission: 'timetable',
    navigationPermission: 'timetable.read',
    actionPermissions: { create: 'timetable.manage', update: 'timetable.manage', delete: 'timetable.manage' },
    columns: [
      { key: 'day_of_week', label: 'Day', render: (row) => ['—', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][Number(row.day_of_week)] || row.day_of_week }, { key: 'start_time', label: 'Start' },
      { key: 'end_time', label: 'End' }, { key: 'course_name', label: 'Course' },
      { key: 'section_name', label: 'Section' }, { key: 'room_number', label: 'Classroom' }
    ],
    fields: [
      { key: 'course_assignment_id', label: 'Course assignment', option: 'course-assignments', optionLabel: 'course_name', required: true },
      { key: 'day_of_week', label: 'Day', options: [['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday'], ['7', 'Sunday']], required: true },
      { key: 'start_time', label: 'Start time', type: 'time', required: true },
      { key: 'end_time', label: 'End time', type: 'time', required: true },
      { key: 'classroom_id', label: 'Classroom', option: 'classrooms', optionLabel: 'room_number', required: true }
    ],
    filters: [{ key: 'day_of_week', label: 'All days', options: [['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday'], ['7', 'Sunday']] }],
    sortFields: ['day_of_week', 'start_time', 'end_time', 'created_at']
  },
  exams: {
    label: 'Examinations',
    singular: 'exam',
    icon: 'EX',
    permission: 'exams',
    navigationPermissions: ['exams.view'],
    actionPermissions: { create: 'exams.create' },
    noUpdate: true,
    noDelete: true,
    columns: [
      { key: 'name', label: 'Examination' }, { key: 'course_name', label: 'Course' },
      { key: 'exam_type', label: 'Type' }, { key: 'exam_date', label: 'Date', date: true },
      { key: 'maximum_marks', label: 'Maximum marks' }, { key: 'passing_marks', label: 'Passing marks' },
      { key: 'is_published', label: 'Published', render: (row) => row.is_published ? 'Published' : 'Draft' }
    ],
    fields: [
      { key: 'name', label: 'Examination name', required: true },
      { key: 'course_assignment_id', label: 'Course assignment', option: 'course-assignments', optionLabel: 'course_name', required: true },
      { key: 'exam_type', label: 'Examination type', options: [['QUIZ', 'Quiz'], ['MIDTERM', 'Midterm'], ['FINAL', 'Final'], ['PRACTICAL', 'Practical'], ['ASSIGNMENT', 'Assignment']], required: true },
      { key: 'exam_date', label: 'Examination date', type: 'date', required: true },
      { key: 'maximum_marks', label: 'Maximum marks', type: 'number', min: 0.01, step: 0.01, required: true },
      { key: 'passing_marks', label: 'Passing marks', type: 'number', min: 0, step: 0.01, required: true }
    ],
    filters: [{ key: 'course_assignment_id', label: 'All course assignments', optionsSource: 'course-assignments', optionValue: 'id', optionLabel: 'course_name' }],
    sortFields: ['exam_date', 'name', 'exam_type', 'created_at']
  },
  grades: {
    label: 'Grades & GPA',
    singular: 'grade',
    icon: 'GP',
    permission: 'grades',
    navigationPermission: 'grades.view',
    apiPath: 'grades',
    readOnly: true,
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'course_name', label: 'Course' },
      { key: 'exam_name', label: 'Examination' }, { key: 'marks_obtained', label: 'Marks' },
      { key: 'letter_grade', label: 'Grade', badge: true }, { key: 'grade_points', label: 'Grade points' },
      { key: 'gpa', label: 'GPA' }
    ],
    fields: [],
    filters: [{ key: 'exam_id', label: 'All examinations', optionsSource: 'exams', optionValue: 'id', optionLabel: 'name' }],
    sortFields: ['student_name', 'course_name', 'letter_grade', 'created_at']
  },
  fees: {
    label: 'Fees',
    singular: 'fee',
    icon: 'FE',
    permission: 'fees',
    navigationPermission: 'fees.view',
    noUpdate: true,
    noDelete: true,
    actionPermissions: { create: 'fees.manage' },
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'fee_type', label: 'Fee type' },
      { key: 'total_amount', label: 'Total amount', currency: true }, { key: 'due_date', label: 'Due date', date: true },
      { key: 'remaining_amount', label: 'Balance', currency: true }, { key: 'status', label: 'Status', badge: true }
    ],
    fields: [
      { key: 'student_id', label: 'Student', option: 'students', optionLabel: 'student_id', required: true },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions', required: true },
      { key: 'semester', label: 'Semester number', type: 'number', min: 1, max: 20, required: true },
      { key: 'fee_type', label: 'Fee type', options: [['TUITION', 'Tuition'], ['ADMISSION', 'Admission'], ['EXAM', 'Exam'], ['LIBRARY', 'Library'], ['LAB', 'Lab'], ['OTHER', 'Other']], required: true },
      { key: 'total_amount', label: 'Total amount', type: 'number', min: 0, step: 0.01, required: true },
      { key: 'due_date', label: 'Due date', type: 'date', required: true },
      { key: 'discount', label: 'Discount', type: 'number', min: 0, step: 0.01 },
      { key: 'scholarship', label: 'Scholarship', type: 'number', min: 0, step: 0.01 },
      { key: 'late_fee', label: 'Late fee', type: 'number', min: 0, step: 0.01 }
    ],
    filters: [{ key: 'status', label: 'All statuses', options: [['PENDING', 'Pending'], ['PARTIAL', 'Partial'], ['PAID', 'Paid'], ['WAIVED', 'Waived'], ['OVERDUE', 'Overdue']] }],
    sortFields: ['due_date', 'fee_type', 'total_amount', 'created_at']
  },
  'fee-structures': {
    label: 'Fee structures',
    singular: 'fee structure',
    icon: 'FS',
    permission: 'fees',
    navigationPermission: 'fees.view',
    apiPath: 'fees/structures',
    actionPermissions: { create: 'fees.manage' },
    noUpdate: true,
    noDelete: true,
    columns: [
      { key: 'program_name', label: 'Program' }, { key: 'academic_session_name', label: 'Session' },
      { key: 'semester', label: 'Semester' }, { key: 'fee_type', label: 'Fee type' },
      { key: 'amount', label: 'Amount', currency: true }, { key: 'due_date', label: 'Due date', date: true }
    ],
    fields: [
      { key: 'program_id', label: 'Program', option: 'programs', required: true },
      { key: 'semester', label: 'Semester number', type: 'number', min: 1, max: 20, required: true },
      { key: 'academic_session_id', label: 'Academic session', option: 'academic-sessions', required: true },
      { key: 'fee_type', label: 'Fee type', options: [['TUITION', 'Tuition'], ['ADMISSION', 'Admission'], ['EXAM', 'Exam'], ['LIBRARY', 'Library'], ['LAB', 'Lab'], ['OTHER', 'Other']], required: true },
      { key: 'amount', label: 'Amount', type: 'number', min: 0, step: 0.01, required: true },
      { key: 'description', label: 'Description' }, { key: 'due_date', label: 'Due date', type: 'date', required: true }
    ],
    filters: [{ key: 'academic_session_id', label: 'All sessions', optionsSource: 'academic-sessions', optionValue: 'id', optionLabel: 'name' }],
    sortFields: ['academic_session_name', 'semester', 'fee_type', 'created_at']
  },
  payments: {
    label: 'Payments',
    singular: 'payment',
    icon: 'PY',
    permission: 'payments',
    navigationPermission: 'payments.view',
    actionPermissions: { create: 'payments.create' },
    noUpdate: true,
    noDelete: true,
    columns: [
      { key: 'receipt_number', label: 'Receipt' }, { key: 'student_name', label: 'Student' },
      { key: 'amount', label: 'Amount', currency: true }, { key: 'payment_method', label: 'Method' },
      { key: 'payment_date', label: 'Paid on', date: true }, { key: 'transaction_reference', label: 'Reference' }
    ],
    fields: [
      { key: 'fee_id', label: 'Fee item', option: 'fees', optionLabel: 'fee_type', required: true },
      { key: 'amount', label: 'Payment amount', type: 'number', min: 0.01, step: 0.01, required: true },
      { key: 'payment_method', label: 'Payment method', options: [['CASH', 'Cash'], ['BANK_TRANSFER', 'Bank transfer'], ['CARD', 'Card'], ['ONLINE', 'Online']], required: true },
      { key: 'transaction_reference', label: 'Transaction reference' }
    ],
    filters: [],
    sortFields: ['payment_date', 'receipt_number', 'amount', 'created_at'],
    detailPath: (row) => `/receipts/${row.id}`,
    detailLabel: 'Receipt'
  },
  'student-documents': {
    label: 'Student documents',
    singular: 'student document',
    icon: 'SD',
    permission: 'documents',
    navigationPermission: 'documents.view',
    apiPath: 'documents',
    actionPermissions: { create: 'documents.manage' },
    noUpdate: true,
    noDelete: true,
    columns: [
      { key: 'registration_number', label: 'Student registration' }, { key: 'document_type', label: 'Document type' },
      { key: 'original_name', label: 'Original file name' }, { key: 'storage_provider', label: 'Storage' },
      { key: 'mime_type', label: 'MIME type' }, { key: 'size_bytes', label: 'Size (bytes)' },
      { key: 'created_at', label: 'Uploaded', date: true }
    ],
    fields: [
      { key: 'student_id', label: 'Student', option: 'students', optionLabel: 'student_id', required: true },
      { key: 'document_type', label: 'Document type', options: [['ADMISSION_LETTER', 'Admission letter'], ['STUDENT_ID_CARD', 'Student ID card'], ['FEE_RECEIPT', 'Fee receipt'], ['TRANSCRIPT', 'Transcript'], ['CERTIFICATE', 'Certificate'], ['OTHER', 'Other']], required: true },
      { key: 'original_name', label: 'Original file name', required: true },
      { key: 'storage_provider', label: 'Storage provider', options: [['LOCAL', 'Local'], ['S3', 'S3'], ['CLOUDINARY', 'Cloudinary'], ['FIREBASE', 'Firebase']], required: true },
      { key: 'storage_key', label: 'Storage key', required: true },
      { key: 'mime_type', label: 'MIME type', required: true },
      { key: 'size_bytes', label: 'File size in bytes', type: 'number', min: 1, max: 26214400, required: true }
    ],
    filters: [{ key: 'document_type', label: 'All document types', options: [['ADMISSION_LETTER', 'Admission letter'], ['STUDENT_ID_CARD', 'Student ID card'], ['FEE_RECEIPT', 'Fee receipt'], ['TRANSCRIPT', 'Transcript'], ['CERTIFICATE', 'Certificate'], ['OTHER', 'Other']] }],
    sortFields: ['created_at', 'document_type', 'original_name']
  },
  'faculty-workload': {
    label: 'Faculty workload',
    singular: 'faculty workload record',
    icon: 'FW',
    permission: 'faculty-workload',
    navigationPermission: 'workload.view',
    apiPath: 'faculty-workload',
    columns: [
      { key: 'faculty_name', label: 'Faculty member' }, { key: 'department_name', label: 'Department' },
      { key: 'assigned_courses', label: 'Courses' }, { key: 'sections', label: 'Sections' },
      { key: 'weekly_classes', label: 'Weekly classes' }, { key: 'teaching_hours', label: 'Teaching hours' }
    ],
    fields: [],
    filters: [{ key: 'academic_session_id', label: 'All sessions', optionsSource: 'academic-sessions', optionValue: 'id', optionLabel: 'name' }],
    sortFields: ['faculty_name', 'teaching_hours', 'assigned_courses']
  },
  'academic-reports': {
    label: 'Academic reports',
    singular: 'academic report',
    icon: 'AR',
    permission: 'reports',
    navigationPermission: 'reports.view',
    readOnly: true,
    columns: [
      { key: 'title', label: 'Report' }, { key: 'report_type', label: 'Type' },
      { key: 'academic_session_name', label: 'Session' }, { key: 'generated_at', label: 'Generated', date: true },
      { key: 'status', label: 'Status', badge: true }
    ],
    fields: [],
    filters: [{ key: 'report_type', label: 'All report types', options: [['ENROLLMENT', 'Enrollment'], ['ATTENDANCE', 'Attendance'], ['PERFORMANCE', 'Performance'], ['FINANCE', 'Finance']] }],
    sortFields: ['generated_at', 'title', 'report_type']
  },
  attendance: {
    label: 'Attendance',
    singular: 'attendance record',
    icon: 'AT',
    permission: 'attendance',
    navigationPermission: 'attendance.view',
    actionPermissions: { create: 'attendance.manage', update: 'attendance.manage', delete: 'attendance.manage' },
    columns: [
      { key: 'attendance_date', label: 'Date', date: true }, { key: 'student_name', label: 'Student' },
      { key: 'course_name', label: 'Course' }, { key: 'section_name', label: 'Section' },
      { key: 'status', label: 'Status', badge: true }, { key: 'remarks', label: 'Notes' }
    ],
    readOnly: true,
    fields: [],
    filters: [],
    sortFields: ['attendance_date', 'student_name', 'status', 'created_at']
  },
  invoices: {
    label: 'Invoices',
    singular: 'invoice',
    icon: 'IN',
    permission: 'invoices',
    navigationPermission: 'invoices.view',
    apiPath: 'invoices',
    readOnly: true,
    detailPath: (row) => `/invoices/${row.id}`,
    detailLabel: 'Print',
    columns: [
      { key: 'invoice_number', label: 'Invoice' }, { key: 'student_name', label: 'Student' },
      { key: 'issued_at', label: 'Issued', date: true }, { key: 'due_date', label: 'Due', date: true },
      { key: 'total_amount', label: 'Total' }, { key: 'remaining_amount', label: 'Balance' }, { key: 'status', label: 'Status', badge: true }
    ],
    fields: [],
    filters: [{ key: 'status', label: 'All statuses', options: [['DUE', 'Due'], ['PARTIAL', 'Partial'], ['PAID', 'Paid']] }],
    sortFields: ['issue_date', 'due_date', 'invoice_number', 'created_at']
  }
};

export const permissionFor = (resource, action) =>
  resourceConfig[resource]?.actionPermissions?.[action] ||
  `${resourceConfig[resource]?.permission || resource}.${action}`;

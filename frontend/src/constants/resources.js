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
    columns: [
      { key: 'student_name', label: 'Student' },
      { key: 'course_title', label: 'Course' },
      { key: 'semester', label: 'Semester' },
      { key: 'status', label: 'Status', badge: true },
      { key: 'enrolled_at', label: 'Enrolled', date: true }
    ],
    fields: [
      { key: 'student_id', label: 'Student', option: 'students', optionLabel: 'student_id', required: true },
      { key: 'course_id', label: 'Course', option: 'courses', optionLabel: 'name', required: true },
      { key: 'semester', label: 'Semester', required: true },
      { key: 'status', label: 'Status', options: [['enrolled', 'Enrolled'], ['completed', 'Completed'], ['withdrawn', 'Withdrawn']], required: true }
    ],
    filters: [{ key: 'status', label: 'All statuses', options: [['enrolled', 'Enrolled'], ['completed', 'Completed'], ['withdrawn', 'Withdrawn']] }],
    sortFields: ['semester', 'status', 'enrolled_at']
  }
};

export const permissionFor = (resource, action) =>
  `${resourceConfig[resource]?.permission || resource}.${action}`;

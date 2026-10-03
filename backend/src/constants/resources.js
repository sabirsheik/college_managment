const personFields = {
  first_name: { type: 'string', required: true, max: 80 },
  last_name: { type: 'string', required: true, max: 80 },
  email: { type: 'email', required: true, max: 254 }
};

export const resources = {
  departments: {
    table: 'departments',
    singular: 'department',
    fields: {
      name: { type: 'string', required: true, max: 120 },
      code: { type: 'string', required: true, max: 20 },
      description: { type: 'string', nullable: true, max: 2000 },
      head_of_department: { type: 'integer', nullable: true },
      status: { type: 'enum', required: true, values: ['ACTIVE', 'INACTIVE'] }
    },
    writeMap: {},
    joins: 'LEFT JOIN faculty f ON f.id = r.head_of_department',
    labels: "f.first_name || ' ' || f.last_name AS head_name",
    searchFields: ['name', 'code'],
    filterFields: ['status'],
    sortFields: ['name', 'code', 'status', 'created_at'],
    permission: 'departments'
  },
  'academic-sessions': {
    table: 'academic_sessions',
    singular: 'academic session',
    fields: {
      name: { type: 'string', required: true, max: 30 },
      start_date: { type: 'date', required: true },
      end_date: { type: 'date', required: true },
      is_current: { type: 'boolean', required: true },
      status: { type: 'enum', required: true, values: ['ACTIVE', 'INACTIVE', 'COMPLETED'] }
    },
    writeMap: {},
    joins: '',
    labels: '',
    searchFields: ['name'],
    filterFields: ['status', 'is_current'],
    sortFields: ['name', 'start_date', 'end_date', 'status', 'created_at'],
    permission: 'academic-sessions'
  },
  programs: {
    table: 'programs',
    singular: 'program',
    fields: {
      department_id: { type: 'integer', required: true },
      name: { type: 'string', required: true, max: 160 },
      code: { type: 'string', required: true, max: 30 },
      degree_level: { type: 'string', required: true, max: 40 },
      duration_years: { type: 'integer', required: true, min: 1, max: 12 },
      description: { type: 'string', nullable: true, max: 2000 },
      status: { type: 'enum', required: true, values: ['ACTIVE', 'INACTIVE'] }
    },
    writeMap: {},
    joins: 'JOIN departments d ON d.id = r.department_id',
    labels: 'd.name AS department_name',
    searchFields: ['name', 'code', 'degree_level'],
    filterFields: ['status', 'department_id'],
    sortFields: ['name', 'code', 'degree_level', 'duration_years', 'status', 'created_at'],
    permission: 'programs'
  },
  students: {
    table: 'students',
    singular: 'student',
    fields: {
      registration_number: { type: 'string', required: true, max: 40 },
      first_name: { type: 'string', required: true, max: 80 },
      last_name: { type: 'string', required: true, max: 80 },
      email: { type: 'email', required: true, max: 254 },
      date_of_birth: { type: 'date', nullable: true },
      profile_image: { type: 'url', nullable: true, max: 1000 },
      gender: { type: 'string', nullable: true, max: 30 },
      phone: { type: 'string', nullable: true, max: 30 },
      address: { type: 'string', nullable: true, max: 1000 },
      city: { type: 'string', nullable: true, max: 100 },
      state: { type: 'string', nullable: true, max: 100 },
      country: { type: 'string', nullable: true, max: 100 },
      guardian_name: { type: 'string', nullable: true, max: 160 },
      guardian_phone: { type: 'string', nullable: true, max: 30 },
      emergency_contact: { type: 'string', nullable: true, max: 30 },
      department_id: { type: 'integer', required: true },
      program_id: { type: 'integer', nullable: true },
      academic_session_id: { type: 'integer', nullable: true },
      admission_date: { type: 'date', nullable: true },
      semester: { type: 'integer', nullable: true, min: 1, max: 20 },
      status: {
        type: 'enum',
        required: true,
        values: ['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN']
      },
      profile_image: { type: 'url', nullable: true, max: 1000 }
    },
    writeMap: { registration_number: ['student_number'] },
    joins: `
      JOIN departments d ON d.id = r.department_id
      LEFT JOIN programs p ON p.id = r.program_id
      LEFT JOIN academic_sessions a ON a.id = r.academic_session_id
    `,
    labels: 'd.name AS department_name, p.name AS program_name, a.name AS academic_session_name',
    searchFields: ['student_id', 'registration_number', 'first_name', 'last_name', 'email'],
    filterFields: ['status', 'department_id', 'program_id', 'academic_session_id', 'semester'],
    sortFields: ['student_id', 'registration_number', 'first_name', 'last_name', 'email', 'admission_date', 'status', 'created_at'],
    permission: 'students'
  },
  faculty: {
    table: 'faculty',
    singular: 'faculty member',
    fields: {
      ...personFields,
      phone: { type: 'string', nullable: true, max: 30 },
      department_id: { type: 'integer', required: true },
      designation: { type: 'string', nullable: true, max: 120 },
      qualification: { type: 'string', nullable: true, max: 160 },
      joining_date: { type: 'date', nullable: true },
      employment_status: {
        type: 'enum',
        required: true,
        values: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED']
      },
      specialization: { type: 'string', nullable: true, max: 160 },
      profile_image: { type: 'url', nullable: true, max: 1000 }
    },
    writeMap: {},
    joins: 'JOIN departments d ON d.id = r.department_id',
    labels: 'd.name AS department_name',
    searchFields: ['employee_id', 'first_name', 'last_name', 'email', 'designation'],
    filterFields: ['employment_status', 'department_id'],
    sortFields: ['employee_id', 'first_name', 'last_name', 'email', 'designation', 'joining_date', 'employment_status', 'created_at'],
    permission: 'faculty'
  },
  courses: {
    table: 'courses',
    singular: 'course',
    fields: {
      course_code: { type: 'string', required: true, max: 20 },
      name: { type: 'string', required: true, max: 160 },
      description: { type: 'string', nullable: true, max: 2000 },
      credit_hours: { type: 'number', required: true, min: 0.5, max: 30 },
      department_id: { type: 'integer', required: true },
      program_id: { type: 'integer', required: true },
      faculty_id: { type: 'integer', nullable: true },
      semester: { type: 'integer', required: true, min: 1, max: 20 },
      status: { type: 'enum', required: true, values: ['ACTIVE', 'INACTIVE'] }
    },
    writeMap: { course_code: ['code'], name: ['title'] },
    joins: `
      JOIN departments d ON d.id = r.department_id
      JOIN programs p ON p.id = r.program_id
      LEFT JOIN faculty f ON f.id = r.faculty_id
    `,
    labels: "d.name AS department_name, p.name AS program_name, f.first_name || ' ' || f.last_name AS faculty_name",
    searchFields: ['course_code', 'name', 'description'],
    filterFields: ['status', 'department_id', 'program_id', 'semester'],
    sortFields: ['course_code', 'name', 'credit_hours', 'semester', 'status', 'created_at'],
    permission: 'courses'
  },
  enrollments: {
    table: 'enrollments',
    singular: 'enrollment',
    fields: {
      student_id: { type: 'integer', required: true },
      course_id: { type: 'integer', required: true },
      semester: { type: 'string', required: true, max: 30 },
      status: { type: 'enum', required: true, values: ['enrolled', 'completed', 'withdrawn'] }
    },
    writeMap: {},
    joins: `
      JOIN students s ON s.id = r.student_id
      JOIN courses c ON c.id = r.course_id
    `,
    labels: "s.first_name || ' ' || s.last_name AS student_name, c.name AS course_title",
    searchFields: ['semester', 'status'],
    filterFields: ['status', 'student_id', 'course_id'],
    sortFields: ['semester', 'status', 'enrolled_at'],
    permission: 'enrollments'
  }
};

export const permissionActions = ['read', 'create', 'update', 'delete'];

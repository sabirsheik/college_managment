export const permissions = {
  dashboardRead: 'dashboard.read',
  collegeSettingsRead: 'college-settings.read',
  collegeSettingsUpdate: 'college-settings.update',
  notificationsRead: 'notifications.read',
  auditLogsRead: 'audit-logs.read',
  usersRead: 'users.read',
  studentsRead: 'students.read',
  facultyRead: 'faculty.read',
  departmentsRead: 'departments.read',
  academicSessionsRead: 'academic-sessions.read',
  programsRead: 'programs.read',
  coursesRead: 'courses.read',
  enrollmentsRead: 'enrollments.read'
};

export function resourcePermission(resource, action) {
  return `${resource}.${action}`;
}

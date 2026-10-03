import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import AuditLogPage from '../pages/AuditLogPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import FacultyProfilePage from '../pages/FacultyProfilePage.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import ResourcePage from '../pages/ResourcePage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import StudentProfilePage from '../pages/StudentProfilePage.jsx';
import { permissions } from '../constants/permissions.js';
import UserProfilePage from '../pages/UserProfilePage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedRoute permission={permissions.dashboardRead} />}>
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.usersRead} />}>
            <Route path="users" element={<ResourcePage />} />
            <Route path="users/:id" element={<UserProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.studentsRead} />}>
            <Route path="students" element={<ResourcePage />} />
            <Route path="students/:id" element={<StudentProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.facultyRead} />}>
            <Route path="faculty" element={<ResourcePage />} />
            <Route path="faculty/:id" element={<FacultyProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.departmentsRead} />}>
            <Route path="departments" element={<ResourcePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.academicSessionsRead} />}>
            <Route path="academic-sessions" element={<ResourcePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.programsRead} />}>
            <Route path="programs" element={<ResourcePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.coursesRead} />}>
            <Route path="courses" element={<ResourcePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.enrollmentsRead} />}>
            <Route path="enrollments" element={<ResourcePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.collegeSettingsRead} />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.notificationsRead} />}>
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.auditLogsRead} />}>
            <Route path="audit-logs" element={<AuditLogPage />} />
          </Route>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import AuditLogPage from '../pages/AuditLogPage.jsx';
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
import AttendanceMarkPage from '../pages/AttendanceMarkPage.jsx';
import PrintableDocumentPage from '../pages/PrintableDocumentPage.jsx';
import AttendancePage from '../pages/AttendancePage.jsx';
import ExamsPage from '../pages/ExamsPage.jsx';
import GradesPage from '../pages/GradesPage.jsx';
import AcademicReportsPage from '../pages/AcademicReportsPage.jsx';
import PortalHome from '../pages/phase3/PortalHome.jsx';
import LibrarianDashboard from '../pages/phase3/LibrarianDashboard.jsx';
import AnnouncementsPage from '../pages/phase3/AnnouncementsPage.jsx';
import GlobalSearchPage from '../pages/phase3/GlobalSearchPage.jsx';
import DataExchangePage from '../pages/phase3/DataExchangePage.jsx';
import PasswordResetPage from '../pages/PasswordResetPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedRoute permission={permissions.dashboardRead} />}>
            <Route path="dashboard" element={<PortalHome />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.usersRead} />}>
            <Route path="users" element={<ResourcePage resource="users" />} />
            <Route path="users/:id" element={<UserProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.studentsRead} />}>
            <Route path="students" element={<ResourcePage resource="students" />} />
            <Route path="students/:id" element={<StudentProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.facultyRead} />}>
            <Route path="faculty" element={<ResourcePage resource="faculty" />} />
            <Route path="faculty/:id" element={<FacultyProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.departmentsRead} />}>
            <Route path="departments" element={<ResourcePage resource="departments" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.academicSessionsRead} />}>
            <Route path="academic-sessions" element={<ResourcePage resource="academic-sessions" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.programsRead} />}>
            <Route path="programs" element={<ResourcePage resource="programs" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.coursesRead} />}>
            <Route path="courses" element={<ResourcePage resource="courses" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.enrollmentsRead} />}>
            <Route path="enrollments" element={<ResourcePage resource="enrollments" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.classroomsRead} />}>
            <Route path="classrooms" element={<ResourcePage resource="classrooms" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.sectionsRead} />}>
            <Route path="sections" element={<ResourcePage resource="sections" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.courseAssignmentsRead} />}>
            <Route path="course-assignments" element={<ResourcePage resource="course-assignments" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.timetableRead} />}>
            <Route path="timetable" element={<ResourcePage resource="timetable" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.attendanceView} />}>
            <Route path="attendance" element={<AttendancePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.attendanceManage} />}>
            <Route path="attendance/mark" element={<AttendanceMarkPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.examsView} />}>
            <Route path="exams" element={<ExamsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.gradesView} />}>
            <Route path="grades" element={<GradesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.feesView} />}>
            <Route path="fees" element={<ResourcePage resource="fees" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.feesView} />}>
            <Route path="fee-structures" element={<ResourcePage resource="fee-structures" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.invoicesView} />}>
            <Route path="invoices" element={<ResourcePage resource="invoices" />} />
            <Route path="invoices/:id" element={<PrintableDocumentPage type="invoice" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.paymentsView} />}>
            <Route path="payments" element={<ResourcePage resource="payments" />} />
            <Route path="receipts/:id" element={<PrintableDocumentPage type="receipt" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.documentsView} />}>
            <Route path="student-documents" element={<ResourcePage resource="student-documents" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.facultyWorkloadView} />}>
            <Route path="faculty-workload" element={<ResourcePage resource="faculty-workload" />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.reportsView} />}>
            <Route path="academic-reports" element={<AcademicReportsPage />} />
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
          <Route element={<ProtectedRoute permission={permissions.libraryBooksRead} />}>
            <Route path="library" element={<LibrarianDashboard user={null} />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.announcementsRead} />}>
            <Route path="announcements" element={<AnnouncementsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.searchRead} />}>
            <Route path="search" element={<GlobalSearchPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={permissions.exportsRun} />}>
            <Route path="data-exchange" element={<DataExchangePage />} />
          </Route>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

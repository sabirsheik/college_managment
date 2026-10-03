import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { authRouter } from './authRoutes.js';
import { resourceRouter } from './resourceRoutes.js';
import { getDashboard } from '../controllers/dashboardController.js';
import { listAuditLogs } from '../controllers/auditController.js';
import { getHealth } from '../controllers/healthController.js';
import { listRoles } from '../controllers/roleController.js';
import { listNotifications, markAllRead, markRead } from '../controllers/notificationController.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { listUsers, createUser, getUser, updateUser, resetPassword, deactivateUser } from '../controllers/userController.js';
import {
  createClassroom, createCourseAssignment, createEnrollment, createSection,
  createTimetableSlot, deleteTimetableSlot, listClassrooms, listCourseAssignments, listEnrollments,
  getEnrollment, listSections, listTimetable, updateClassroom, updateCourseAssignment,
  updateEnrollment, updateSection, updateTimetableSlot, withdrawEnrollment
} from '../controllers/phaseTwoController.js';
import {
  academicReport, attendanceReport, createDocument, createExam, createFeeStructure,
  createGradeScale, createPayment, createStudentFee, facultyWorkload, getAttendanceMine,
  getAttendanceRoster, getExamRoster, getGpa, getInvoice, getReceipt, listAttendanceSessions, listDocuments, listExams, listFeeStructures,
  listGradeScale, listGrades, listInvoices, listPayments, listStudentFees, markAttendance,
  publishExam, saveExamResults, updateGradeScale
} from '../controllers/phaseTwoAcademicController.js';

export const apiRouter = Router();

apiRouter.get('/health', asyncHandler(getHealth));
apiRouter.use('/auth', authRouter);
apiRouter.use(authenticate);
apiRouter.get('/dashboard', requirePermission('dashboard.read'), asyncHandler(getDashboard));
apiRouter.get('/audit-logs', requirePermission('audit-logs.read'), asyncHandler(listAuditLogs));
apiRouter.get('/college-settings', requirePermission('college-settings.read'), asyncHandler(getSettings));
apiRouter.patch('/college-settings', requirePermission('college-settings.update'), asyncHandler(updateSettings));
apiRouter.get('/users', requirePermission('users.read'), asyncHandler(listUsers));
apiRouter.get('/roles', requirePermission('roles.read'), asyncHandler(listRoles));
apiRouter.post('/users', requirePermission('users.create'), asyncHandler(createUser));
apiRouter.get('/users/:id', requirePermission('users.read'), asyncHandler(getUser));
apiRouter.patch('/users/:id', requirePermission('users.update'), asyncHandler(updateUser));
apiRouter.post('/users/:id/reset-password', requirePermission('users.reset-password'), asyncHandler(resetPassword));
apiRouter.delete('/users/:id', requirePermission('users.delete'), asyncHandler(deactivateUser));
apiRouter.get('/notifications', requirePermission('notifications.read'), asyncHandler(listNotifications));
apiRouter.patch('/notifications/read-all', requirePermission('notifications.read'), asyncHandler(markAllRead));
apiRouter.patch('/notifications/:id/read', requirePermission('notifications.read'), asyncHandler(markRead));
apiRouter.get('/classrooms', requirePermission('classrooms.read'), asyncHandler(listClassrooms));
apiRouter.post('/classrooms', requirePermission('classrooms.manage'), asyncHandler(createClassroom));
apiRouter.patch('/classrooms/:id', requirePermission('classrooms.manage'), asyncHandler(updateClassroom));
apiRouter.get('/sections', requirePermission('sections.read'), asyncHandler(listSections));
apiRouter.post('/sections', requirePermission('sections.manage'), asyncHandler(createSection));
apiRouter.patch('/sections/:id', requirePermission('sections.manage'), asyncHandler(updateSection));
apiRouter.get('/course-assignments', requirePermission('course-assignments.read'), asyncHandler(listCourseAssignments));
apiRouter.post('/course-assignments', requirePermission('course-assignments.manage'), asyncHandler(createCourseAssignment));
apiRouter.patch('/course-assignments/:id', requirePermission('course-assignments.manage'), asyncHandler(updateCourseAssignment));
apiRouter.get('/enrollments', requirePermission('enrollments.read'), asyncHandler(listEnrollments));
apiRouter.get('/enrollments/:id', requirePermission('enrollments.read'), asyncHandler(getEnrollment));
apiRouter.post('/enrollments', requirePermission('enrollments.create'), asyncHandler(createEnrollment));
apiRouter.patch('/enrollments/:id', requirePermission('enrollments.manage'), asyncHandler(updateEnrollment));
apiRouter.delete('/enrollments/:id', requirePermission('enrollments.manage'), asyncHandler(withdrawEnrollment));
apiRouter.get('/timetable', requirePermission('timetable.read'), asyncHandler(listTimetable));
apiRouter.post('/timetable', requirePermission('timetable.manage'), asyncHandler(createTimetableSlot));
apiRouter.patch('/timetable/:id', requirePermission('timetable.manage'), asyncHandler(updateTimetableSlot));
apiRouter.delete('/timetable/:id', requirePermission('timetable.manage'), asyncHandler(deleteTimetableSlot));
apiRouter.get('/attendance/mine', requirePermission('attendance.view'), asyncHandler(getAttendanceMine));
apiRouter.get('/attendance/roster', requirePermission('attendance.manage'), asyncHandler(getAttendanceRoster));
apiRouter.get('/attendance/report', requirePermission('attendance.view'), asyncHandler(attendanceReport));
apiRouter.get('/attendance', requirePermission('attendance.view'), asyncHandler(listAttendanceSessions));
apiRouter.post('/attendance/sessions', requirePermission('attendance.manage'), asyncHandler(markAttendance));
apiRouter.get('/exams/:id/roster', requirePermission('grades.manage'), asyncHandler(getExamRoster));
apiRouter.get('/exams', requirePermission('exams.view'), asyncHandler(listExams));
apiRouter.post('/exams', requirePermission('exams.create'), asyncHandler(createExam));
apiRouter.put('/exams/:id/results', requirePermission('grades.manage'), asyncHandler(saveExamResults));
apiRouter.post('/exams/:id/publish', requirePermission('exams.manage'), asyncHandler(publishExam));
apiRouter.get('/grades/scale', requirePermission('grades.view'), asyncHandler(listGradeScale));
apiRouter.post('/grades/scale', requirePermission('grades.manage'), asyncHandler(createGradeScale));
apiRouter.patch('/grades/scale/:id', requirePermission('grades.manage'), asyncHandler(updateGradeScale));
apiRouter.get('/grades', requirePermission('grades.view'), asyncHandler(listGrades));
apiRouter.get('/gpa/me', requirePermission('grades.view'), asyncHandler(getGpa));
apiRouter.get('/gpa/:studentId', requirePermission('grades.view'), asyncHandler(getGpa));
apiRouter.get('/fees/structures', requirePermission('fees.view'), asyncHandler(listFeeStructures));
apiRouter.post('/fees/structures', requirePermission('fees.manage'), asyncHandler(createFeeStructure));
apiRouter.get('/fees', requirePermission('fees.view'), asyncHandler(listStudentFees));
apiRouter.post('/fees', requirePermission('fees.manage'), asyncHandler(createStudentFee));
apiRouter.get('/payments', requirePermission('payments.view'), asyncHandler(listPayments));
apiRouter.post('/payments', requirePermission('payments.create'), asyncHandler(createPayment));
apiRouter.get('/receipts/:id', requirePermission('payments.view'), asyncHandler(getReceipt));
apiRouter.get('/invoices', requirePermission('invoices.view'), asyncHandler(listInvoices));
apiRouter.get('/invoices/:id', requirePermission('invoices.view'), asyncHandler(getInvoice));
apiRouter.get('/documents', requirePermission('documents.view'), asyncHandler(listDocuments));
apiRouter.post('/documents', requirePermission('documents.manage'), asyncHandler(createDocument));
apiRouter.get('/faculty-workload', requirePermission('workload.view'), asyncHandler(facultyWorkload));
apiRouter.get('/reports/:type', requirePermission('reports.view'), asyncHandler(academicReport));
apiRouter.use('/', resourceRouter);

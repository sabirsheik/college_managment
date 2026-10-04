import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { DashboardHeading, DataPanel, displayValue, Metric, RecordTable, rowsOf, shortDate } from './DashboardWidgets.jsx';
import './phase3.css';

const loadAssignments = () => api.list('course-assignments', { limit: 8 });
const loadTimetable = () => api.list('timetable', { limit: 8 });
const loadAttendance = () => api.list('attendance', { limit: 8 });
const loadExams = () => api.list('exams', { limit: 8 });
const loadGrades = () => api.list('grades', { limit: 8 });
const loadDashboard = () => api.dashboard();

export default function FacultyDashboard({ user }) {
  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Your assigned teaching, assessment, and class activity." />
      <DataPanel title="Teaching summary" eyebrow="WEEKLY WORKLOAD" load={loadDashboard}>
        {(data) => (
          <div className="p3-metric-row">
            <Metric label="Assigned courses" value={data?.totals?.assignedCourses ?? '—'} />
            <Metric label="Sections" value={data?.totals?.sections ?? '—'} />
            <Metric label="Weekly classes" value={data?.totals?.weeklyClasses ?? '—'} />
            <Metric label="Teaching hours" value={data?.totals?.totalTeachingHours ?? '—'} hint="Scheduled hours per week" />
          </div>
        )}
      </DataPanel>
      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Assigned courses & sections" eyebrow="TEACHING LOAD" load={loadAssignments}>
          {(data) => (
            <RecordTable
              title="Courses and sections assigned to you"
              rows={rowsOf(data)}
              emptyMessage="No course assignments are currently linked to your faculty account."
              columns={[
                { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                { label: 'Section', render: (row) => row.section_name || '—' },
                { label: 'Program', render: (row) => row.program_name || '—' },
                { label: 'Term', render: (row) => row.academic_session_name || `Semester ${row.semester ?? '—'}` }
              ]}
            />
          )}
        </DataPanel>
        <DataPanel title="Teaching timetable" eyebrow="CLASS SCHEDULE" load={loadTimetable}>
          {(data) => (
            <RecordTable
              title="Your teaching timetable"
              rows={rowsOf(data)}
              emptyMessage="No timetable entries are available for your assigned courses."
              columns={[
                { label: 'Day', render: (row) => displayValue(row.day_of_week) },
                { label: 'Course / section', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.section_name}</span></> },
                { label: 'Time', render: (row) => `${row.start_time || '—'} – ${row.end_time || '—'}` },
                { label: 'Room', render: (row) => [row.building, row.room_number].filter(Boolean).join(' · ') || '—' }
              ]}
            />
          )}
        </DataPanel>
      </div>

      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Attendance sessions" eyebrow="CLASS ACTIVITY" load={loadAttendance}>
          {(data) => (
            <>
              <RecordTable
                title="Attendance sessions for your assigned courses"
                rows={rowsOf(data)}
                emptyMessage="No attendance sessions have been recorded for your assigned courses."
                columns={[
                  { label: 'Date', render: (row) => shortDate(row.attendance_date) },
                  { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                  { label: 'Section', render: (row) => row.section_name || '—' },
                  { label: 'Topic', render: (row) => row.topic || '—' }
                ]}
              />
              <div className="p3-panel-footer"><Link className="p3-action-link" to="/attendance">Manage attendance <span aria-hidden="true">→</span></Link></div>
            </>
          )}
        </DataPanel>
        <DataPanel title="Exams" eyebrow="ASSESSMENTS" load={loadExams}>
          {(data) => (
            <>
              <RecordTable
                title="Exams for your assigned courses"
                rows={rowsOf(data)}
                emptyMessage="No exams have been scheduled for your assigned courses."
                columns={[
                  { label: 'Exam', render: (row) => displayValue(row.exam_type) },
                  { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                  { label: 'Date', render: (row) => shortDate(row.exam_date) },
                  { label: 'Status', render: (row) => <span className="p3-tag">{row.is_published ? 'Published' : 'Draft'}</span> }
                ]}
              />
              <div className="p3-panel-footer"><Link className="p3-action-link" to="/exams">Open exams <span aria-hidden="true">→</span></Link></div>
            </>
          )}
        </DataPanel>
      </div>

      <div className="p3-grid">
        <DataPanel title="Recent grades" eyebrow="GRADEBOOK" load={loadGrades}>
          {(data) => (
            <>
              <RecordTable
                title="Grades for your assigned courses"
                rows={rowsOf(data)}
                emptyMessage="No grade records are available for your assigned courses."
                columns={[
                  { label: 'Student', render: (row) => row.student_name || row.registration_number || '—' },
                  { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                  { label: 'Exam', render: (row) => displayValue(row.exam_type) },
                  { label: 'Grade', render: (row) => row.letter_grade || row.grade_point || '—' }
                ]}
              />
              <div className="p3-panel-footer"><Link className="p3-action-link" to="/grades">Open gradebook <span aria-hidden="true">→</span></Link></div>
            </>
          )}
        </DataPanel>
      </div>
      <footer className="dashboard-footer">Faculty portal · Course and student records are limited to your assignments.</footer>
    </div>
  );
}

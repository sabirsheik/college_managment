import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import {
  DashboardHeading, DataPanel, displayValue, EmptyState, Metric, money, RecordTable, rowsOf, shortDate
} from './DashboardWidgets.jsx';
import './phase3.css';

const loadEnrollments = () => api.list('enrollments', { limit: 8 });
const loadTimetable = () => api.list('timetable', { limit: 8 });
const loadAttendance = () => api.list('attendance/mine');
const loadGpa = () => api.gpa();
const loadFees = () => api.list('fees', { limit: 8 });
const loadPayments = () => api.list('payments', { limit: 5 });
const loadNotifications = () => api.list('notifications', { limit: 5 });

export default function StudentDashboard({ user }) {
  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Your studies, schedule, and account in one place." />
      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Academic progress" eyebrow="YOUR GPA" load={loadGpa}>
          {(data) => (
            <div className="p3-metric-row">
              <Metric label="Cumulative GPA" value={data?.cgpa ?? 'Not published'} hint="Based on published final grades" />
              <Metric label="Completed credits" value={data?.completed_credit_hours ?? '—'} />
              <Link className="p3-action-link" to="/grades">View grades <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </DataPanel>
        <DataPanel title="Attendance by course" eyebrow="ATTENDANCE" load={loadAttendance}>
          {(data) => (
            <RecordTable
              title="Your attendance record by course"
              rows={data?.courses}
              emptyMessage="No attendance records have been posted for your courses."
              columns={[
                { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                { label: 'Attended', render: (row) => `${row.attended_classes ?? '—'} / ${row.total_classes ?? '—'}` },
                { label: 'Attendance', render: (row) => row.attendance_percentage == null ? '—' : `${row.attendance_percentage}%` }
              ]}
            />
          )}
        </DataPanel>
      </div>

      <div className="p3-grid p3-grid-wide">
        <DataPanel title="My enrollments" eyebrow="COURSEWORK" load={loadEnrollments}>
          {(data) => (
            <RecordTable
              title="Your course enrollments"
              rows={rowsOf(data)}
              emptyMessage="You do not have any enrollment records yet."
              columns={[
                { label: 'Course', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                { label: 'Term', render: (row) => row.academic_session_name || `Semester ${row.semester_number ?? '—'}` },
                { label: 'Status', render: (row) => <span className="p3-tag">{displayValue(row.status)}</span> }
              ]}
            />
          )}
        </DataPanel>
        <DataPanel title="Timetable" eyebrow="UP NEXT" load={loadTimetable}>
          {(data) => (
            <RecordTable
              title="Your timetable"
              rows={rowsOf(data)}
              emptyMessage="No timetable entries are available for your section."
              columns={[
                { label: 'Day', render: (row) => displayValue(row.day_of_week) },
                { label: 'Class', render: (row) => <><strong>{row.course_code}</strong><span className="p3-cell-sub">{row.course_name}</span></> },
                { label: 'Time', render: (row) => `${row.start_time || '—'} – ${row.end_time || '—'}` },
                { label: 'Room', render: (row) => [row.building, row.room_number].filter(Boolean).join(' · ') || '—' }
              ]}
            />
          )}
        </DataPanel>
      </div>

      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Fees & balance" eyebrow="STUDENT ACCOUNT" load={loadFees}>
          {(data) => {
            const fees = rowsOf(data);
            if (!fees.length) return <EmptyState>No fee records are available for your account.</EmptyState>;
            const balance = fees.reduce((sum, fee) => sum + (Number(fee.remaining_amount) || 0), 0);
            return (
              <>
                <div className="p3-inline-summary"><Metric label="Outstanding in loaded records" value={money(balance)} hint="Balance shown for the returned fee records" /></div>
                <RecordTable
                  title="Your fee records"
                  rows={fees}
                  columns={[
                    { label: 'Fee', render: (row) => displayValue(row.fee_type) },
                    { label: 'Due date', render: (row) => shortDate(row.due_date) },
                    { label: 'Balance', render: (row) => money(row.remaining_amount) },
                    { label: 'Status', render: (row) => <span className="p3-tag">{displayValue(row.status)}</span> }
                  ]}
                />
              </>
            );
          }}
        </DataPanel>
        <DataPanel title="Recent payments" eyebrow="PAYMENT HISTORY" load={loadPayments}>
          {(data) => (
            <>
              <RecordTable
                title="Your recent payments"
                rows={rowsOf(data)}
                emptyMessage="No payments have been recorded for your account."
                columns={[
                  { label: 'Receipt', render: (row) => row.receipt_number || '—' },
                  { label: 'Date', render: (row) => shortDate(row.payment_date) },
                  { label: 'Amount', render: (row) => money(row.amount) },
                  { label: 'Method', render: (row) => displayValue(row.payment_method) }
                ]}
              />
              <div className="p3-panel-footer"><Link className="p3-action-link" to="/payments">Open payments <span aria-hidden="true">→</span></Link></div>
            </>
          )}
        </DataPanel>
      </div>

      <div className="p3-grid">
        <DataPanel title="Notifications" eyebrow="YOUR INBOX" load={loadNotifications}>
          {(data) => {
            const notifications = rowsOf(data);
            if (!notifications.length) return <EmptyState>You’re all caught up. There are no notifications to show.</EmptyState>;
            return (
              <ul className="p3-notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <span className="p3-notice-dot" aria-hidden="true" />
                    <div><strong>{notification.title}</strong><p>{notification.message}</p></div>
                    <time dateTime={notification.created_at}>{shortDate(notification.created_at)}</time>
                  </li>
                ))}
              </ul>
            );
          }}
        </DataPanel>
      </div>
      <footer className="dashboard-footer">Student portal · Your records are protected and scoped to your account.</footer>
    </div>
  );
}

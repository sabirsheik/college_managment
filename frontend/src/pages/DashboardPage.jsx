import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { permissions, resourcePermission } from '../constants/permissions.js';
import { api } from '../services/api.js';

const cards = [
  { key: 'students', label: 'Active students', icon: 'ST', color: 'blue', link: '/students' },
  { key: 'faculty', label: 'Faculty members', icon: 'FC', color: 'violet', link: '/faculty' },
  { key: 'departments', label: 'Departments', icon: 'DP', color: 'amber', link: '/departments' },
  { key: 'programs', label: 'Academic programs', icon: 'PG', color: 'green', link: '/programs' },
  { key: 'courses', label: 'Courses offered', icon: 'CR', color: 'blue', link: '/courses' }
];

function date(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return value ? new Intl.DateTimeFormat('en', options).format(new Date(value)) : '—';
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const visibleCards = cards.filter((card) => can(resourcePermission(card.key, 'read')));

  useEffect(() => {
    api.dashboard()
      .then((response) => setData(response.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-content">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">INSTITUTION OVERVIEW</span>
          <h2>Welcome back, {user?.first_name}</h2>
          <p>A live view of your college’s academic operations.</p>
        </div>
        {can(resourcePermission('students', 'create')) && <Link className="button button-primary" to="/students">＋ Add a student</Link>}
      </div>
      {error && <div className="notice-error" role="alert">{error}</div>}
      <div className="stat-grid">
        {visibleCards.map((card) => (
          <Link key={card.key} className="stat-card" to={card.link}>
            <div className={`stat-icon ${card.color}`}>{card.icon}</div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{loading ? '—' : data?.totals[card.key]?.toLocaleString() ?? '0'}</div>
            <span className="stat-link">View records <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </div>
      <section className="session-banner">
        <span className="session-mark">AY</span>
        <div><span className="eyebrow">CURRENT ACADEMIC SESSION</span><strong>{data?.currentAcademicSession?.name || (loading ? 'Loading…' : 'Not set')}</strong></div>
        {data?.currentAcademicSession && <span className="session-dates">{date(data.currentAcademicSession.start_date)} — {date(data.currentAcademicSession.end_date)}</span>}
        {can(permissions.academicSessionsRead) && <Link to="/academic-sessions">Manage sessions <span aria-hidden="true">→</span></Link>}
      </section>
      <div className="dashboard-columns">
        <section className="panel dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow">RECENTLY ADMITTED</span><h3>Recent students</h3></div>{can('students.read') && <Link className="subtle-link" to="/students">View all →</Link>}</div>
          {data?.recentStudents.length ? <div className="activity-list">
            {data.recentStudents.map((student) => (
              <Link className="activity-row" key={student.id} to={`/students/${student.id}`}>
                <span className="activity-avatar">{student.first_name[0]}{student.last_name[0]}</span>
                <div className="activity-main"><strong>{student.first_name} {student.last_name}</strong><span>{student.registration_number} · {student.student_id}</span></div>
                <span className="activity-date">{date(student.created_at, { month: 'short', day: 'numeric' })}</span>
              </Link>
            ))}
          </div> : <div className="empty-activity">{loading ? 'Loading student records…' : 'No student records yet.'}</div>}
        </section>
        <section className="panel dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow">COLLEGE TEAM</span><h3>Recent faculty</h3></div>{can('faculty.read') && <Link className="subtle-link" to="/faculty">View all →</Link>}</div>
          {data?.recentFaculty.length ? <div className="activity-list">
            {data.recentFaculty.map((member) => (
              <Link className="activity-row" key={member.id} to={`/faculty/${member.id}`}>
                <span className="activity-avatar faculty-avatar">{member.first_name[0]}{member.last_name[0]}</span>
                <div className="activity-main"><strong>{member.first_name} {member.last_name}</strong><span>{member.employee_id} · {member.designation || 'Faculty'}</span></div>
                <span className="activity-date">{date(member.created_at, { month: 'short', day: 'numeric' })}</span>
              </Link>
            ))}
          </div> : <div className="empty-activity">{loading ? 'Loading faculty records…' : 'No faculty records yet.'}</div>}
        </section>
      </div>
      <div className="dashboard-columns bottom-panels">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">ADMINISTRATION</span><h3>Recent activity</h3></div>{can(permissions.auditLogsRead) && <Link className="subtle-link" to="/audit-logs">Audit log →</Link>}</div>
          {data?.recentActivity.length ? <div className="activity-list compact-list">
            {data.recentActivity.map((activity) => (
              <div className="activity-row" key={activity.id}>
                <span className="activity-dot" />
                <div className="activity-main"><strong>{activity.action.replaceAll('_', ' ')} · {activity.entity_type.replaceAll('_', ' ')}</strong><span>{activity.entity_id ? `Record ${activity.entity_id}` : 'System event'}</span></div>
                <span className="activity-date">{date(activity.created_at, { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div> : <div className="empty-activity">{loading ? 'Loading activity…' : 'No recent activity available.'}</div>}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">YOUR INBOX</span><h3>Notifications</h3></div>{can(permissions.notificationsRead) && <Link className="subtle-link" to="/notifications">View all →</Link>}</div>
          {data?.notifications.length ? <div className="activity-list compact-list">
            {data.notifications.map((notice) => (
              <div className="activity-row" key={notice.id}>
                <span className={`notification-mark notification-${notice.type.toLowerCase()}`}>•</span>
                <div className="activity-main"><strong>{notice.title}</strong><span>{notice.message}</span></div>
                <span className="activity-date">{date(notice.created_at, { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div> : <div className="empty-activity">{loading ? 'Loading notifications…' : 'You’re all caught up.'}</div>}
        </section>
      </div>
      <div className="dashboard-footer">Campus management · secure academic operations</div>
    </div>
  );
}

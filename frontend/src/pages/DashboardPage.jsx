import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { permissions, resourcePermission } from '../constants/permissions.js';
import { api } from '../services/api.js';
import Icon from '../components/Icon.jsx';

const cards = [
  { key: 'students', label: 'Active students', icon: 'graduation', color: 'blue', link: '/students' },
  { key: 'faculty', label: 'Faculty members', icon: 'briefcase', color: 'violet', link: '/faculty' },
  { key: 'departments', label: 'Departments', icon: 'building', color: 'amber', link: '/departments' },
  { key: 'programs', label: 'Academic programs', icon: 'bookOpen', color: 'green', link: '/programs' },
  { key: 'courses', label: 'Courses offered', icon: 'book', color: 'blue', link: '/courses' }
];

function date(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return value ? new Intl.DateTimeFormat('en', options).format(new Date(value)) : '—';
}

function TrendPanel({ title, rows, valueKey, formatter = (value) => value }) {
  const values = rows || [];
  const maximum = Math.max(1, ...values.map((row) => Number(row[valueKey]) || 0));
  return (
    <section className="panel phase3-chart">
      <div className="panel-heading"><div><span className="eyebrow">LAST SIX MONTHS</span><h3>{title}</h3></div></div>
      <div className="phase3-chart-bars" role="img" aria-label={`${title} trend`}>
        {values.map((row) => {
          const value = Number(row[valueKey]) || 0;
          return (
            <div className="phase3-chart-column" key={row.month}>
              <span>{formatter(value)}</span>
              <div className="phase3-chart-track"><i style={{ height: `${Math.max(4, (value / maximum) * 100)}%` }} /></div>
              <small>{date(row.month, { month: 'short' })}</small>
            </div>
          );
        })}
        {!values.length && <p className="empty-activity">No monthly activity recorded yet.</p>}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const visibleCards = cards.filter((card) => can(resourcePermission(card.key, 'read')));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.dashboard();
      setData(response.data);
      setLastUpdated(new Date());
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="page-content dashboard-page" aria-busy={loading || refreshing}>
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">INSTITUTION OVERVIEW</span>
          <h2>Welcome back, {user?.first_name || 'there'}</h2>
          <p>Here’s what’s happening across your campus today.</p>
          <span className="dashboard-today">{date(new Date(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="dashboard-hero-actions">
          <span className="dashboard-refresh-info" role="status">
            <span className={`dashboard-live-dot${refreshing ? ' is-refreshing' : ''}`} />
            {lastUpdated ? `Last updated ${date(lastUpdated, { hour: 'numeric', minute: '2-digit' })}` : 'Connecting to live data'}
          </span>
          <div className="heading-actions">
            <button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
            {can(resourcePermission('students', 'create')) && <Link className="button button-primary" to="/students">Add a student</Link>}
          </div>
        </div>
      </div>
      {error && (
        <div className="notice-error" role="alert">
          {lastUpdated
            ? `Could not refresh dashboard data. Showing the last successful update. ${error}`
            : `Dashboard data could not be loaded. Check the API connection and try again. ${error}`}
        </div>
      )}
      <section className="dashboard-section" aria-labelledby="dashboard-records-title">
        <div className="dashboard-section-heading">
          <div><span className="eyebrow">AT A GLANCE</span><h3 id="dashboard-records-title">Institutional overview</h3></div>
          <span className="dashboard-section-note">Live record totals</span>
        </div>
        <div className="stat-grid">
          {visibleCards.map((card) => {
            const total = data?.totals?.[card.key];
            return (
              <Link key={card.key} className="stat-card" to={card.link}>
                <div className={`stat-icon ${card.color}`}><Icon name={card.icon} size={21} /></div>
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">
                  {loading || (error && !data) || total == null ? '—' : total.toLocaleString()}
                </div>
                <span className="stat-link">View records <span aria-hidden="true">↗</span></span>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="session-banner" aria-label="Current academic session">
        <span className="session-mark"><Icon name="calendar" size={21} /></span>
        <div className="session-copy"><span className="eyebrow">CURRENT ACADEMIC SESSION</span><strong>{data?.currentAcademicSession?.name || (loading ? 'Loading…' : 'No active session')}</strong></div>
        {data?.currentAcademicSession && <span className="session-dates">{date(data.currentAcademicSession.start_date)} — {date(data.currentAcademicSession.end_date)}</span>}
        {can(permissions.academicSessionsRead) && <Link to="/academic-sessions">Manage sessions <span aria-hidden="true">→</span></Link>}
      </section>
      {data?.analytics && (
        <>
          <div className="dashboard-section-heading dashboard-analytics-heading">
            <div><span className="eyebrow">CAMPUS PERFORMANCE</span><h3>Financial &amp; attendance summary</h3></div>
            <span className="dashboard-section-note">Across your institution</span>
          </div>
          <div className="phase3-analytics-grid">
            <div className="panel phase3-kpi dashboard-kpi-collected"><span className="eyebrow">FEE COLLECTIONS</span><strong>{Number(data.analytics.fees?.collected || 0).toLocaleString()}</strong><small>Collected to date</small></div>
            <div className="panel phase3-kpi dashboard-kpi-outstanding"><span className="eyebrow">OUTSTANDING</span><strong>{Number(data.analytics.fees?.outstanding || 0).toLocaleString()}</strong><small>Remaining student balances</small></div>
            <div className="panel phase3-kpi dashboard-kpi-attendance"><span className="eyebrow">ATTENDANCE RECORDS</span><strong>{data.analytics.attendanceByStatus.reduce((sum, row) => sum + Number(row.count), 0).toLocaleString()}</strong><small>Recorded attendance entries</small></div>
          </div>
          <div className="dashboard-section-heading dashboard-trends-heading">
            <div><span className="eyebrow">SIX-MONTH TRENDS</span><h3>Activity over time</h3></div>
          </div>
          <div className="dashboard-columns">
            <TrendPanel title="Monthly payments" rows={data.analytics.paymentsByMonth} valueKey="amount" formatter={(value) => Number(value).toLocaleString()} />
            <TrendPanel title="New student records" rows={data.analytics.enrollmentsByMonth} valueKey="count" formatter={(value) => value.toLocaleString()} />
          </div>
        </>
      )}
      <div className="dashboard-section-heading dashboard-activity-heading">
        <div><span className="eyebrow">CAMPUS COMMUNITY</span><h3>People &amp; activity</h3></div>
      </div>
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

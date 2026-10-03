import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ResourceTable from '../components/ResourceTable.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const columns = [
  { key: 'attendance_date', label: 'Date', date: true }, { key: 'course_name', label: 'Course' },
  { key: 'section_name', label: 'Section' }, { key: 'status', label: 'Status', badge: true },
  { key: 'note', label: 'Notes' }
];
const sessionColumns = [
  { key: 'attendance_date', label: 'Date', date: true }, { key: 'course_name', label: 'Course' },
  { key: 'section_name', label: 'Section' }, { key: 'topic', label: 'Topic' }
];

export default function AttendancePage() {
  const { user, can } = useAuth();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const student = user?.role === 'STUDENT';

  useEffect(() => {
    let active = true;
    (student ? api.list('attendance/mine') : api.list('attendance'))
      .then((response) => {
        if (!active) return;
        if (student) {
          setRows(response.data?.records || []);
          setSummary(response.data?.courses || []);
        } else {
          setRows(response.data || []);
        }
      })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student]);

  return (
    <div className="page-content">
      <div className="resource-heading">
        <div><span className="eyebrow">ACADEMIC OPERATIONS / ATTENDANCE</span><h2>{student ? 'My attendance' : 'Attendance sessions'}</h2><p>{student ? 'Your attendance and per-course summary.' : 'Review recorded class sessions. Student-level visibility is enforced by the server.'}</p></div>
        {!student && can('attendance.manage') && <Link className="button button-primary" to="/attendance/mark">Mark attendance</Link>}
      </div>
      {error && <div className="notice-error" role="alert">{error}</div>}
      {student && summary.length > 0 && <section className="panel resource-panel attendance-summary">
        <div className="panel-heading"><div><span className="eyebrow">SUMMARY</span><h3>By course</h3></div></div>
        <div className="table-scroll"><table><thead><tr><th>Course</th><th>Classes</th><th>Attended</th><th>Attendance</th></tr></thead>
          <tbody>{summary.map((row) => <tr key={row.course_code}><td>{row.course_code} · {row.course_name}</td><td>{row.total_classes}</td><td>{row.attended_classes}</td><td>{row.attendance_percentage ?? '—'}%</td></tr>)}</tbody>
        </table></div>
      </section>}
      <section className="panel resource-panel">
        {loading ? <div className="loading-state"><span className="spinner" />Loading attendance…</div> :
          <ResourceTable columns={student ? columns : sessionColumns} rows={rows} resource="attendance record" canUpdate={false} canDelete={false} emptyMessage="No attendance records found" />}
      </section>
    </div>
  );
}

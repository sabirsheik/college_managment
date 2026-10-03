import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const reportTypes = [
  ['enrollment', 'Enrollment'], ['attendance', 'Attendance'], ['exam-performance', 'Exam performance'],
  ['gpa', 'GPA'], ['fees', 'Fees'], ['outstanding-balances', 'Outstanding balances'],
  ['faculty-workload', 'Faculty workload']
];

function label(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AcademicReportsPage() {
  const { user } = useAuth();
  const [type, setType] = useState('enrollment');
  const [filters, setFilters] = useState({ academic_session_id: '', department_id: '', program_id: '', semester: '', section_id: '', from: '', to: '' });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function generate(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.reports(type, filters);
      setRows(Array.isArray(response.data) ? response.data : []);
      setLoaded(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const availableTypes = user?.role === 'FACULTY'
    ? reportTypes.filter(([value]) => ['attendance', 'exam-performance', 'gpa'].includes(value))
    : reportTypes;
  useEffect(() => {
    if (user?.role === 'FACULTY' && type === 'enrollment') setType('attendance');
  }, [user, type]);
  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">ACADEMIC OPERATIONS / ANALYTICS</span><h2>Academic reports</h2><p>Generate a report using the supported report type and filters. Access to report data is enforced by the server.</p></div></div>
      <section className="panel report-panel">
        <form className="report-filters" onSubmit={generate}>
          <label><span>Report type</span><select value={type} onChange={(event) => setType(event.target.value)}>{availableTypes.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
          <label><span>Academic session ID</span><input type="number" min="1" value={filters.academic_session_id} onChange={(event) => setFilters({ ...filters, academic_session_id: event.target.value })} /></label>
          <label><span>Department ID</span><input type="number" min="1" value={filters.department_id} onChange={(event) => setFilters({ ...filters, department_id: event.target.value })} /></label>
          <label><span>Program ID</span><input type="number" min="1" value={filters.program_id} onChange={(event) => setFilters({ ...filters, program_id: event.target.value })} /></label>
          <label><span>Semester</span><input type="number" min="1" value={filters.semester} onChange={(event) => setFilters({ ...filters, semester: event.target.value })} /></label>
          <label><span>Section ID</span><input type="number" min="1" value={filters.section_id} onChange={(event) => setFilters({ ...filters, section_id: event.target.value })} /></label>
          <label><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <button className="button button-primary" disabled={loading}>{loading ? 'Generating…' : 'Generate report'}</button>
        </form>
        {error && <div className="notice-error" role="alert">{error}</div>}
        {loading ? <div className="loading-state"><span className="spinner" />Generating report…</div> :
          loaded && rows.length > 0 ? <div className="table-scroll"><table>
            <thead><tr>{columns.map((column) => <th key={column}>{label(column)}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td key={column}>{row[column] ?? '—'}</td>)}</tr>)}</tbody>
          </table></div> : loaded ? <div className="empty-state"><strong>No report rows returned</strong><p>Try a different report type or broader filters.</p></div> :
            <div className="empty-state"><strong>Choose report parameters</strong><p>Generate an academic report to see results.</p></div>}
      </section>
    </div>
  );
}

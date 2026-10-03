import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const states = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

export default function AttendanceMarkPage() {
  const notify = useToast();
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [date, setDate] = useState(localDate);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.list('course-assignments', { limit: 100 })
      .then((result) => { if (active) setAssignments(result.data || []); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);

  async function loadRoster(event) {
    event.preventDefault();
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.attendanceRoster({ course_assignment_id: assignmentId, date });
      setStudents((result.data || []).map((student) => ({
        ...student,
        status: student.status || 'PRESENT',
        note: student.note || ''
      })));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  function changeStudent(studentId, key, value) {
    setStudents((current) => current.map((student) =>
      student.student_id === studentId ? { ...student, [key]: value } : student
    ));
  }

  async function submitAttendance() {
    setSaving(true);
    setError('');
    try {
      await api.markAttendance({
        course_assignment_id: Number(assignmentId),
        attendance_date: date,
        records: students.map(({ student_id, status, note }) => ({ student_id, status, note }))
      });
      notify('Attendance saved successfully.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="resource-heading">
        <div><span className="eyebrow">ACADEMIC OPERATIONS / ATTENDANCE</span><h2>Mark attendance</h2><p>Choose an assigned course and date. Server authorization scopes the roster and validates each student.</p></div>
        <Link className="button button-secondary" to="/attendance">Attendance records</Link>
      </div>
      <section className="panel attendance-panel">
        <form className="attendance-filters" onSubmit={loadRoster}>
          <label><span>Course assignment</span><select required value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            <option value="">Choose an assignment</option>
            {assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.course_code} · {assignment.course_name} — {assignment.section_name}</option>)}
          </select></label>
          <label><span>Attendance date</span><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <button className="button button-primary" disabled={loading}>{loading ? 'Loading…' : 'Load roster'}</button>
        </form>
        {error && <div className="notice-error inline-error" role="alert">{error}</div>}
        {students.length > 0 && <>
          <div className="table-scroll"><table>
            <thead><tr><th>Student</th><th>Registration</th><th>Attendance status</th><th>Notes</th></tr></thead>
            <tbody>{students.map((student) => <tr key={student.student_id}>
              <td>{student.student_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || '—'}</td>
              <td>{student.registration_number || '—'}</td>
              <td><select aria-label={`Attendance status for ${student.student_name || student.student_id}`} value={student.status} onChange={(event) => changeStudent(student.student_id, 'status', event.target.value)}>
                {states.map((state) => <option key={state} value={state}>{state[0] + state.slice(1).toLowerCase()}</option>)}
              </select></td>
              <td><input aria-label={`Notes for ${student.student_name || student.student_id}`} value={student.note} onChange={(event) => changeStudent(student.student_id, 'note', event.target.value)} /></td>
            </tr>)}</tbody>
          </table></div>
          <div className="attendance-actions"><span>{students.length} students in this assignment</span><button className="button button-primary" disabled={saving} onClick={submitAttendance}>{saving ? 'Saving…' : 'Save attendance'}</button></div>
        </>}
        {!loading && !error && students.length === 0 && <div className="empty-state"><span className="empty-mark">—</span><strong>Select a course assignment and date</strong><p>The roster will appear here for marking.</p></div>}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import ResourceTable from '../components/ResourceTable.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

const gradeColumns = [
  { key: 'student_name', label: 'Student' }, { key: 'course_code', label: 'Course code' },
  { key: 'course_name', label: 'Course' }, { key: 'exam_name', label: 'Exam' },
  { key: 'marks_obtained', label: 'Marks' }, { key: 'percentage', label: 'Percentage' },
  { key: 'letter_grade', label: 'Grade', badge: true }, { key: 'grade_point', label: 'Grade points' }
];
const scaleColumns = [
  { key: 'letter_grade', label: 'Grade' }, { key: 'minimum_percentage', label: 'Minimum %' },
  { key: 'maximum_percentage', label: 'Maximum %' }, { key: 'grade_point', label: 'Grade points' }
];

export default function GradesPage() {
  const { can, user } = useAuth();
  const notify = useToast();
  const [grades, setGrades] = useState([]);
  const [scales, setScales] = useState([]);
  const [gpa, setGpa] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [showScaleForm, setShowScaleForm] = useState(false);
  const [scale, setScale] = useState({ letter_grade: '', minimum_percentage: '', maximum_percentage: '', grade_point: '' });

  useEffect(() => {
    let active = true;
    Promise.all([api.list('grades'), api.list('grades/scale')])
      .then(([gradeResponse, scaleResponse]) => {
        if (!active) return;
        setGrades(gradeResponse.data || []);
        setScales(scaleResponse.data || []);
      })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);

  async function loadGpa(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.gpa(user?.role === 'STUDENT' ? 'me' : (studentId || 'me'));
      setGpa(response.data);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function addScale(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.createGradeScale({
        ...scale,
        minimum_percentage: Number(scale.minimum_percentage),
        maximum_percentage: Number(scale.maximum_percentage),
        grade_point: Number(scale.grade_point)
      });
      setScales((current) => [...current, response.data].sort((a, b) => b.minimum_percentage - a.minimum_percentage));
      setScale({ letter_grade: '', minimum_percentage: '', maximum_percentage: '', grade_point: '' });
      setShowScaleForm(false);
      notify('Grade scale added.');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">ACADEMIC OPERATIONS / ASSESSMENT</span><h2>Grades & GPA</h2><p>Grades reflect exam results; GPA is calculated from published final exam grades.</p></div></div>
      {error && <div className="notice-error" role="alert">{error}</div>}
      <section className="panel gpa-panel">
        <div className="panel-heading"><div><span className="eyebrow">ACADEMIC SUMMARY</span><h3>GPA</h3></div></div>
        <form className="gpa-lookup" onSubmit={loadGpa}>
          {user?.role !== 'STUDENT' && <label><span>Student ID</span><input type="number" min="1" required value={studentId} onChange={(event) => setStudentId(event.target.value)} /></label>}
          <button className="button button-secondary">Load GPA</button>
          {gpa && <div className="gpa-score"><span>CGPA</span><strong>{gpa.cgpa ?? '—'}</strong><small>{gpa.completed_credit_hours ?? 0} completed credit hours</small></div>}
        </form>
        {gpa?.semesters?.map((term) => <div className="gpa-term" key={`${term.academic_session_id}-${term.semester}`}>
          <strong>{term.academic_session_name} · Semester {term.semester}</strong><span>GPA {term.gpa} · {term.credit_hours} credits</span>
          <div className="table-scroll"><table><thead><tr><th>Course</th><th>Grade</th><th>Grade points</th><th>Credits</th></tr></thead><tbody>
            {term.courses?.map((course) => <tr key={course.course_code}><td>{course.course_code} · {course.course_name}</td><td>{course.letter_grade}</td><td>{course.grade_point}</td><td>{course.credit_hours}</td></tr>)}
          </tbody></table></div>
        </div>)}
      </section>
      {can('grades.manage') && <section className="panel resource-panel grade-scale-panel">
        <div className="panel-heading"><div><span className="eyebrow">GRADING POLICY</span><h3>Active grade scale</h3></div><button className="button button-secondary" onClick={() => setShowScaleForm((value) => !value)}>{showScaleForm ? 'Cancel' : 'Add grade band'}</button></div>
        {showScaleForm && <form className="form-grid grade-scale-form" onSubmit={addScale}>
          <label><span>Letter grade</span><input required maxLength="5" value={scale.letter_grade} onChange={(event) => setScale({ ...scale, letter_grade: event.target.value })} /></label>
          <label><span>Minimum percentage</span><input required type="number" min="0" max="100" step="0.01" value={scale.minimum_percentage} onChange={(event) => setScale({ ...scale, minimum_percentage: event.target.value })} /></label>
          <label><span>Maximum percentage</span><input required type="number" min="0" max="100" step="0.01" value={scale.maximum_percentage} onChange={(event) => setScale({ ...scale, maximum_percentage: event.target.value })} /></label>
          <label><span>Grade points</span><input required type="number" min="0" max="4" step="0.01" value={scale.grade_point} onChange={(event) => setScale({ ...scale, grade_point: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary">Save grade band</button></div>
        </form>}
        <ResourceTable columns={scaleColumns} rows={scales} resource="grade scale" canUpdate={false} canDelete={false} emptyMessage="No active grade bands" />
      </section>}
      <section className="panel resource-panel grade-records">
        <div className="panel-heading"><div><span className="eyebrow">PUBLISHED RESULTS</span><h3>Grade records</h3></div></div>
        <ResourceTable columns={gradeColumns} rows={grades} resource="grade" canUpdate={false} canDelete={false} emptyMessage="No published grades found" />
      </section>
    </div>
  );
}

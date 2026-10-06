import { useEffect, useState } from 'react';
import ResourceTable from '../components/ResourceTable.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm, useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

const columns = [
  { key: 'name', label: 'Examination' }, { key: 'course_name', label: 'Course' },
  { key: 'section_name', label: 'Section' }, { key: 'exam_type', label: 'Type' },
  { key: 'exam_date', label: 'Date', date: true }, { key: 'maximum_marks', label: 'Maximum marks' },
  { key: 'is_published', label: 'Published', render: (row) => row.is_published ? 'Yes' : 'Draft' }
];

const initialExam = {
  course_assignment_id: '', name: '', exam_type: 'QUIZ', exam_date: '',
  maximum_marks: '', passing_marks: ''
};

export default function ExamsPage() {
  const { can, user } = useAuth();
  const notify = useToast();
  const confirm = useConfirm();
  const [exams, setExams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [resultRows, setResultRows] = useState([]);
  const [exam, setExam] = useState(initialExam);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);

  async function loadExams() {
    setLoading(true);
    try {
      const response = await api.list('exams', { limit: 100, ...(filterAssignment ? { course_assignment_id: filterAssignment } : {}) });
      setExams(response.data || []);
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    api.list('course-assignments', { limit: 100 }).then((response) => {
      if (active) setAssignments(response.data || []);
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => { loadExams(); }, [filterAssignment]);

  async function createExam(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.create('exams', {
        ...exam,
        course_assignment_id: Number(exam.course_assignment_id),
        maximum_marks: Number(exam.maximum_marks),
        passing_marks: Number(exam.passing_marks)
      });
      setExam(initialExam);
      setCreating(false);
      notify('Examination created.');
      await loadExams();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveResults(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await api.saveExamResults(selected.id, {
        results: resultRows
          .filter((row) => row.student_id !== '' && row.marks_obtained !== '')
          .map((row) => ({ student_id: Number(row.student_id), marks_obtained: Number(row.marks_obtained) }))
      });
      notify('Exam results saved and grades calculated.');
      const rosterResponse = await api.examRoster(selected.id);
      setResultRows((rosterResponse.data?.students || []).map((student) => ({
        ...student,
        marks_obtained: student.marks_obtained ?? ''
      })));
      await loadExams();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }

    async function enterResults(examRecord) {
      setSelected(examRecord);
      setResultRows([]);
      setError('');
      setRosterLoading(true);
      try {
        const response = await api.examRoster(examRecord.id);
        setSelected(response.data?.exam || examRecord);
        setResultRows((response.data?.students || []).map((student) => ({
          ...student,
          marks_obtained: student.marks_obtained ?? ''
        })));
      } catch (cause) {
        setError(cause.message);
        setSelected(null);
      } finally {
        setRosterLoading(false);
      }
    }
  }

  async function publish() {
    if (!selected) return;
    const confirmed = await confirm({
      title: 'Publish exam results?',
      message: 'Once published, these results are locked and cannot be edited.',
      confirmLabel: 'Publish results'
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await api.publishExam(selected.id);
      notify('Exam results published.');
      setSelected((current) => ({ ...current, is_published: true }));
      await loadExams();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  const student = user?.role === 'STUDENT';
  return (
    <div className="page-content">
      <div className="resource-heading">
        <div><span className="eyebrow">ACADEMIC OPERATIONS / ASSESSMENT</span><h2>Examinations</h2><p>Manage exam schedules and results. Students only receive published exams; the server enforces record access.</p></div>
        {can('exams.create') && <button className="button button-primary" onClick={() => setCreating((value) => !value)}>{creating ? 'Close form' : '＋ Create examination'}</button>}
      </div>
      {error && <div className="notice-error" role="alert">{error}</div>}
      {creating && <section className="panel exam-create-panel">
        <div className="panel-heading"><div><span className="eyebrow">NEW EXAM</span><h3>Examination details</h3></div></div>
        <form className="form-grid exam-form" onSubmit={createExam}>
          <label><span>Course assignment</span><select required value={exam.course_assignment_id} onChange={(event) => setExam({ ...exam, course_assignment_id: event.target.value })}><option value="">Select assignment</option>
            {assignments.map((item) => <option key={item.id} value={item.id}>{item.course_code} · {item.course_name} — {item.section_name}</option>)}</select></label>
          <label><span>Examination name</span><input required value={exam.name} onChange={(event) => setExam({ ...exam, name: event.target.value })} /></label>
          <label><span>Type</span><select value={exam.exam_type} onChange={(event) => setExam({ ...exam, exam_type: event.target.value })}>{['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ASSIGNMENT'].map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Date</span><input type="date" required value={exam.exam_date} onChange={(event) => setExam({ ...exam, exam_date: event.target.value })} /></label>
          <label><span>Maximum marks</span><input type="number" min="0.01" step="0.01" required value={exam.maximum_marks} onChange={(event) => setExam({ ...exam, maximum_marks: event.target.value })} /></label>
          <label><span>Passing marks</span><input type="number" min="0" step="0.01" required value={exam.passing_marks} onChange={(event) => setExam({ ...exam, passing_marks: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Create exam'}</button></div>
        </form>
      </section>}
      <section className="panel resource-panel">
        <div className="table-toolbar"><strong>Exams</strong>
          <select className="filter-select" value={filterAssignment} onChange={(event) => setFilterAssignment(event.target.value)} aria-label="Filter course assignment"><option value="">All course assignments</option>
            {assignments.map((item) => <option key={item.id} value={item.id}>{item.course_code} · {item.course_name} — {item.section_name}</option>)}
          </select>
        </div>
        {loading ? <div className="loading-state"><span className="spinner" />Loading examinations…</div> :
          <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{!student && <th>Actions</th>}</tr></thead>
            <tbody>{exams.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : column.date && row[column.key] ? new Date(row[column.key]).toLocaleDateString() : row[column.key] ?? '—'}</td>)}
              {!student && <td className="row-actions">
                {can('grades.manage') && !row.is_published && <button className="text-button" onClick={() => enterResults(row)}>Enter results</button>}
                {can('exams.manage') && !row.is_published && <button className="text-button" onClick={() => { setSelected(row); setResultRows([]); }}>Publish</button>}
              </td>}</tr>)}</tbody>
          </table></div>}
        {!loading && exams.length === 0 && <div className="empty-state"><strong>No examinations found</strong><p>Create an exam for a course assignment to begin.</p></div>}
      </section>
      {selected && <section className="panel result-entry-panel">
        <div className="panel-heading"><div><span className="eyebrow">{selected.is_published ? 'PUBLISHED' : 'RESULTS'}</span><h3>{selected.name}</h3></div><button className="close-button" onClick={() => setSelected(null)} aria-label="Close">×</button></div>
        {rosterLoading && <div className="loading-state"><span className="spinner" />Loading assigned exam roster…</div>}
        {!rosterLoading && !selected.is_published && can('grades.manage') && resultRows.length > 0 && <form onSubmit={saveResults}>
          <p className="workflow-hint">Enter marks for students in this exam’s assigned section (maximum {selected.maximum_marks}). Grades and grade points are calculated by the server.</p>
          {resultRows.map((row, index) => <div className="result-entry-row" key={index}>
            <div className="roster-student"><strong>{row.student_name}</strong><span>{row.registration_number} · ID {row.student_id}</span>{row.letter_grade && <small>Current grade: {row.letter_grade} ({row.grade_point} pts)</small>}</div>
            <label><span>Marks obtained</span><input type="number" min="0" max={selected.maximum_marks} step="0.01" required value={row.marks_obtained} onChange={(event) => setResultRows((current) => current.map((item, i) => i === index ? { ...item, marks_obtained: event.target.value } : item))} /></label>
          </div>)}
          <div className="modal-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save all results'}</button></div>
        </form>}
        {!rosterLoading && !selected.is_published && can('grades.manage') && resultRows.length === 0 && <div className="empty-state"><strong>No active students in the assigned section</strong><p>There are no roster records available for grading.</p></div>}
        {!selected.is_published && can('exams.manage') && <div className="attendance-actions"><span>All active students must have a result before publishing.</span><button className="button button-primary" disabled={saving} onClick={publish}>Publish results</button></div>}
      </section>}
    </div>
  );
}

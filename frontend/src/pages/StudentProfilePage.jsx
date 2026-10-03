import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';

const sections = [
  { title: 'Academic record', fields: [
    ['student_id', 'Student ID'], ['registration_number', 'Registration number'],
    ['department_name', 'Department'], ['program_name', 'Program'],
    ['academic_session_name', 'Academic session'], ['semester', 'Current semester'],
    ['admission_date', 'Admission date'], ['status', 'Enrollment status']
  ] },
  { title: 'Personal information', fields: [
    ['date_of_birth', 'Date of birth'], ['gender', 'Gender'], ['email', 'Email'], ['phone', 'Phone']
  ] },
  { title: 'Address', fields: [
    ['address', 'Street address'], ['city', 'City'], ['state', 'State / province'], ['country', 'Country']
  ] },
  { title: 'Guardian & emergency contact', fields: [
    ['guardian_name', 'Guardian'], ['guardian_phone', 'Guardian phone'], ['emergency_contact', 'Emergency contact']
  ] }
];

function format(value, key) {
  if (value == null || value === '') return '—';
  if (key.includes('date')) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }
  return String(value).replaceAll('_', ' ');
}

export default function StudentProfilePage() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('students', id)
      .then((response) => setStudent(response.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-content"><div className="loading-state"><span className="spinner" />Loading student profile…</div></div>;
  if (error) return <div className="page-content"><div className="notice-error" role="alert">{error}</div><Link className="subtle-link" to="/students">← Back to students</Link></div>;
  if (!student) return null;

  return (
    <div className="page-content">
      <div className="profile-back"><Link to="/students">← All students</Link><span>STUDENT PROFILE</span></div>
      <section className="profile-hero panel">
        <div className="profile-avatar">{student.profile_image
          ? <img src={student.profile_image} alt="" />
          : <>{student.first_name[0]}{student.last_name[0]}</>}</div>
        <div className="profile-identity"><span className="eyebrow">STUDENT RECORD</span><h2>{student.first_name} {student.last_name}</h2><p>{student.registration_number} <span>·</span> {student.student_id}</p></div>
        <span className={`status status-${student.status.toLowerCase()}`}>{student.status}</span>
      </section>
      <div className="profile-grid">
        {sections.map((section) => (
          <section className="panel profile-section" key={section.title}>
            <div className="profile-section-heading"><h3>{section.title}</h3></div>
            <dl>{section.fields.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{format(student[key], key)}</dd></div>
            ))}</dl>
          </section>
        ))}
      </div>
    </div>
  );
}

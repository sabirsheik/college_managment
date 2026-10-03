import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';

const items = [
  ['employee_id', 'Employee ID'],
  ['email', 'Email address'],
  ['phone', 'Phone'],
  ['department_name', 'Department'],
  ['designation', 'Designation'],
  ['qualification', 'Qualification'],
  ['specialization', 'Specialization'],
  ['joining_date', 'Joining date'],
  ['employment_status', 'Employment status']
];

export default function FacultyProfilePage() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('faculty', id)
      .then((response) => setMember(response.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-content"><div className="loading-state"><span className="spinner" />Loading faculty profile…</div></div>;
  if (error) return <div className="page-content"><div className="notice-error" role="alert">{error}</div><Link className="subtle-link" to="/faculty">← Back to faculty</Link></div>;
  if (!member) return null;

  return (
    <div className="page-content">
      <div className="profile-back"><Link to="/faculty">← All faculty</Link><span>FACULTY PROFILE</span></div>
      <section className="profile-hero panel">
        <div className="profile-avatar faculty-avatar">{member.profile_image
          ? <img src={member.profile_image} alt="" />
          : <>{member.first_name[0]}{member.last_name[0]}</>}</div>
        <div className="profile-identity"><span className="eyebrow">FACULTY RECORD</span><h2>{member.first_name} {member.last_name}</h2><p>{member.designation || 'Faculty'} <span>·</span> {member.employee_id}</p></div>
        <span className={`status status-${member.employment_status.toLowerCase()}`}>{member.employment_status.replaceAll('_', ' ')}</span>
      </section>
      <section className="panel profile-section faculty-details">
        <div className="profile-section-heading"><h3>Professional information</h3></div>
        <dl>{items.map(([key, label]) => (
          <div key={key}><dt>{label}</dt><dd>{key === 'joining_date' && member[key]
            ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(member[key]))
            : member[key]?.replaceAll('_', ' ') || '—'}</dd></div>
        ))}</dl>
      </section>
    </div>
  );
}

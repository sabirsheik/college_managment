import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';

const fields = [
  ['email', 'Email address'],
  ['phone', 'Phone'],
  ['role', 'Role'],
  ['is_active', 'Account status'],
  ['last_login_at', 'Last sign in'],
  ['created_at', 'Created']
];

export default function UserProfilePage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('users', id)
      .then((response) => setUser(response.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-content"><div className="loading-state"><span className="spinner" />Loading account…</div></div>;
  if (error) return <div className="page-content"><div className="notice-error" role="alert">{error}</div><Link className="subtle-link" to="/users">← Back to users</Link></div>;
  if (!user) return null;

  return (
    <div className="page-content">
      <div className="profile-back"><Link to="/users">← All users</Link><span>USER ACCOUNT</span></div>
      <section className="profile-hero panel">
        <div className="profile-avatar">{user.first_name[0]}{user.last_name[0]}</div>
        <div className="profile-identity"><span className="eyebrow">CAMPUS ACCOUNT</span><h2>{user.first_name} {user.last_name}</h2><p>{user.email}</p></div>
        <span className={`status ${user.is_active ? 'status-active' : 'status-inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span>
      </section>
      <section className="panel profile-section faculty-details">
        <div className="profile-section-heading"><h3>Account information</h3></div>
        <dl>{fields.map(([key, label]) => {
          const value = key === 'is_active' ? (user[key] ? 'Active' : 'Inactive')
            : user[key] && (key === 'created_at' || key === 'last_login_at')
              ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user[key]))
              : user[key]?.replaceAll('_', ' ') || '—';
          return <div key={key}><dt>{label}</dt><dd>{value}</dd></div>;
        })}</dl>
      </section>
    </div>
  );
}

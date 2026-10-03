import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { request } from '../api/client.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const notify = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      notify('Your password was changed.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">ACCOUNT</span><h2>My profile</h2><p>View your account and keep your sign-in secure.</p></div></div>
      <div className="profile-grid profile-account-grid">
        <section className="panel profile-section"><div className="profile-section-heading"><h3>Account details</h3></div><dl>
          <div><dt>Name</dt><dd>{user?.first_name} {user?.last_name}</dd></div><div><dt>Email</dt><dd>{user?.email}</dd></div><div><dt>Role</dt><dd>{user?.role?.replaceAll('_', ' ')}</dd></div>
        </dl></section>
        <section className="panel profile-section"><div className="profile-section-heading"><h3>Change password</h3></div>
          <form className="password-form" onSubmit={submit}>
            <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label>New password <span className="field-hint">At least 12 characters</span><input type="password" autoComplete="new-password" minLength="12" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
          </form>
        </section>
      </div>
    </div>
  );
}

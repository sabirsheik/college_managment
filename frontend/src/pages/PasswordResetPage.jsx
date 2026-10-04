import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { request } from '../api/client.js';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (token && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        const result = await request('/auth/password-reset/complete', {
          method: 'POST',
          body: JSON.stringify({ token, newPassword: password })
        });
        setMessage(result.message);
        setPassword('');
        setConfirmation('');
      } else {
        const result = await request('/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() })
        });
        setMessage(result.message);
        setEmail('');
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand"><span className="brand-mark">C</span><span><strong>Campus</strong><small>COLLEGE MANAGEMENT</small></span></div>
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>{token ? 'Choose a new password' : 'Reset your password'}</h1>
        <p className="login-subtitle">
          {token ? 'Use a strong password you have not used for this account.' : 'We will send instructions if an active account matches your email.'}
        </p>
        <form className="login-form" onSubmit={submit}>
          {!token ? (
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          ) : (
            <>
              <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={72} required /></label>
              <label>Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={72} required /></label>
            </>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="notice-success" role="status">{message}</div>}
          <button className="button button-primary" disabled={submitting}>{submitting ? 'Please wait…' : token ? 'Update password' : 'Send reset instructions'}</button>
        </form>
        <Link className="subtle-link" to="/login">Return to sign in</Link>
      </section>
    </main>
  );
}

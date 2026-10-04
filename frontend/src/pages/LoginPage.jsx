import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">C</span>
          <span><strong>Campus</strong><small>COLLEGE ADMINISTRATION</small></span>
        </div>
        <span className="eyebrow">SECURE ADMIN PORTAL</span>
        <h1>Welcome back</h1>
        <p className="login-subtitle">Sign in with your college account to continue.</p>
        <form className="login-form" onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link className="subtle-link" to="/reset-password">Forgot your password?</Link>
        <span className="login-footnote">Your account is protected with secure, HttpOnly session cookies.</span>
      </section>
      <aside className="login-aside">
        <div className="login-illustration">C</div>
        <span className="eyebrow">ONE CAMPUS. CLEARER OPERATIONS.</span>
        <h2>Everything your<br />college needs to<br />move forward.</h2>
        <p>Manage academic operations with a secure, connected workspace for your institution.</p>
        <span className="login-aside-footer">COLLEGE MANAGEMENT PLATFORM · PHASE 1</span>
      </aside>
    </main>
  );
}

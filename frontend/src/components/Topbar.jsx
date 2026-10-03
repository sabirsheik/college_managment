import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resourceConfig } from '../constants/resources.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Topbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const title = useMemo(() => {
    if (pathname === '/' || pathname === '/dashboard') return 'Overview';
    if (pathname.startsWith('/students/')) return 'Student profile';
    if (pathname.startsWith('/faculty/')) return 'Faculty profile';
    if (pathname.startsWith('/users/')) return 'User details';
    const key = pathname.slice(1);
    if (key === 'settings') return 'College settings';
    if (key === 'notifications') return 'Notifications';
    if (key === 'audit-logs') return 'Audit log';
    return resourceConfig[key]?.label || 'Campus';
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="topbar">
      <div>
        <span className="breadcrumb">CAMPUS / <span>{title.toUpperCase()}</span></span>
        <h1>{title}</h1>
      </div>
      <div className="topbar-right">
        <span className="today">{new Intl.DateTimeFormat('en', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        }).format(new Date())}</span>
        <Link className="avatar top-avatar" to="/profile" aria-label="Open profile">{user?.first_name?.[0]}{user?.last_name?.[0]}</Link>
        <button className="signout-button" disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </header>
  );
}

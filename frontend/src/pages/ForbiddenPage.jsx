import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return <main className="forbidden-page"><span className="forbidden-code">403</span><h1>Access restricted</h1><p>Your account does not have permission to view this page.</p><Link to="/dashboard" className="button button-primary">Return to overview</Link></main>;
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api/client.js';
import { DashboardHeading, EmptyState } from './DashboardWidgets.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import './phase3.css';

const resultLinks = {
  student: (id) => `/students/${id}`,
  faculty: (id) => `/faculty/${id}`,
  course: (id) => `/courses`,
  department: (id) => `/departments`,
  program: (id) => `/programs`,
  book: () => `/library`
};
const activityTypes = {
  student: 'students', faculty: 'faculty', course: 'courses',
  department: 'departments', program: 'programs', book: 'books'
};

export default function GlobalSearchPage() {
  const { user, can } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState({});
  const [loadingActivity, setLoadingActivity] = useState('');
  const [error, setError] = useState('');

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError('Enter at least two characters to search.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const response = await request(`/search?q=${encodeURIComponent(query.trim())}&limit=50`);
      setResults(response.data || []);
      setActivity({});
    } catch (cause) {
      setResults([]);
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  async function viewActivity(result) {
    const key = `${result.entity_type}-${result.id}`;
    if (activity[key]) {
      setActivity((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setLoadingActivity(key);
    try {
      const entity = activityTypes[result.entity_type];
      const response = await request(`/activity/${entity}/${result.id}?limit=20`);
      setActivity((current) => ({ ...current, [key]: { items: response.data || [] } }));
    } catch (cause) {
      setActivity((current) => ({ ...current, [key]: { error: cause.message } }));
    } finally {
      setLoadingActivity('');
    }
  }

  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Search the records available to your role." />
      <section className="panel p3-panel">
        <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">CAMPUS DIRECTORY</span><h3>Search records</h3></div></div>
        <form className="p3-search-form" role="search" onSubmit={search}>
          <label className="p3-sr-only" htmlFor="global-search">Search terms</label>
          <input id="global-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Students, courses, faculty, books…" maxLength={100} />
          <button className="button button-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        {error && <p className="p3-state p3-state-error" role="alert">{error}</p>}
        {searched && !loading && !error && (results.length ? (
          <ul className="p3-search-results">
            {results.map((result, index) => {
              const getLink = result.entity_type === 'student' && user?.role === 'STUDENT'
                ? () => '/dashboard'
                : resultLinks[result.entity_type];
              return (
                <li key={`${result.entity_type}-${result.id}-${index}`}>
                  <span className="p3-tag">{result.entity_type}</span>
                  <div><strong>{result.title}</strong><span>{result.subtitle}</span></div>
                  {getLink && <Link className="p3-action-link" to={getLink(result.id)}>Open <span aria-hidden="true">→</span></Link>}
                  {can('activity.read') && activityTypes[result.entity_type] && (
                    <button className="p3-text-button" onClick={() => viewActivity(result)} disabled={loadingActivity === `${result.entity_type}-${result.id}`}>
                      {loadingActivity === `${result.entity_type}-${result.id}` ? 'Loading…' : activity[`${result.entity_type}-${result.id}`] ? 'Hide activity' : 'Activity'}
                    </button>
                  )}
                  {activity[`${result.entity_type}-${result.id}`] && (
                    <div className="p3-activity-timeline">
                      {activity[`${result.entity_type}-${result.id}`].error
                        ? <p role="alert">{activity[`${result.entity_type}-${result.id}`].error}</p>
                        : activity[`${result.entity_type}-${result.id}`].items.length
                          ? activity[`${result.entity_type}-${result.id}`].items.map((entry, index) => (
                            <p key={`${entry.created_at}-${index}`}><strong>{entry.action.replaceAll('_', ' ')}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></p>
                          ))
                          : <p>No activity is available for this record.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState>No matching records were found in the records you can access.</EmptyState>)}
      </section>
    </div>
  );
}

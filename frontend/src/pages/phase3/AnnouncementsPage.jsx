import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { request } from '../../api/client.js';
import { DashboardHeading, EmptyState, shortDate } from './DashboardWidgets.jsx';
import './phase3.css';

const targets = ['ALL_STUDENTS', 'ALL_FACULTY', 'DEPARTMENT', 'PROGRAM', 'SECTION', 'ROLE'];

export default function AnnouncementsPage() {
  const { user, can } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [targetType, setTargetType] = useState(targets[0]);
  const [targetId, setTargetId] = useState('');
  const [targetRole, setTargetRole] = useState('STUDENT');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAnnouncements = useCallback(async () => {
    const result = await request('/announcements?limit=50');
    return result.data || [];
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadAnnouncements()
      .then((records) => { if (active) setAnnouncements(records); })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAnnouncements, reload]);

  async function createDraft(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const body = { title: title.trim(), message: message.trim(), targetType };
    if (['DEPARTMENT', 'PROGRAM', 'SECTION'].includes(targetType)) body.targetId = Number(targetId);
    if (targetType === 'ROLE') body.targetRole = targetRole;
    try {
      await request('/announcements', { method: 'POST', body: JSON.stringify(body) });
      setTitle('');
      setMessage('');
      setTargetId('');
      setNotice('Draft created.');
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function publish(id) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await request(`/announcements/${id}/publish`, { method: 'POST' });
      setNotice('Announcement published to its selected audience.');
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Important campus updates, delivered to the right audience." />
      {error && <div className="notice-error" role="alert">{error}</div>}
      {notice && <div className="notice-success" role="status">{notice}</div>}
      {can('announcements.create') && (
        <section className="panel p3-panel p3-form-panel">
          <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">COMMUNICATIONS</span><h3>Create an announcement</h3></div></div>
          <form className="p3-announcement-form" onSubmit={createDraft}>
            <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required /></label>
            <label>Audience
              <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                {targets.map((target) => <option key={target} value={target}>{target.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            {['DEPARTMENT', 'PROGRAM', 'SECTION'].includes(targetType) && (
              <label>Audience record ID<input type="number" min="1" step="1" value={targetId} onChange={(event) => setTargetId(event.target.value)} required /></label>
            )}
            {targetType === 'ROLE' && (
              <label>Role
                <select value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>
                  {['STUDENT', 'FACULTY', 'ACCOUNTANT', 'LIBRARIAN', 'ADMIN'].map((role) => <option key={role}>{role}</option>)}
                </select>
              </label>
            )}
            <label className="p3-form-wide">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={4} required /></label>
            <button className="button button-primary" type="submit">Save draft</button>
          </form>
        </section>
      )}
      <section className="panel p3-panel">
        <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">CAMPUS BULLETIN</span><h3>Announcements</h3></div></div>
        {loading ? <p className="p3-state" role="status">Loading announcements…</p>
          : error && !announcements.length ? <p className="p3-state p3-state-error" role="alert">Unable to load announcements.</p>
            : announcements.length ? (
              <div className="p3-announcement-list">
                {announcements.map((item) => (
                  <article className="p3-announcement" key={item.id}>
                    <div className="p3-announcement-meta">
                      <span className="p3-tag">{item.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
                      <span>{item.target_type.replaceAll('_', ' ')}</span>
                      <time dateTime={item.published_at || item.created_at}>{shortDate(item.published_at || item.created_at)}</time>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.message}</p>
                    {item.status === 'DRAFT' && can('announcements.publish') && (
                      <button className="button button-secondary" disabled={busyId === item.id} onClick={() => publish(item.id)}>
                        {busyId === item.id ? 'Publishing…' : 'Publish'}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : <EmptyState>There are no announcements available for your account.</EmptyState>}
      </section>
    </div>
  );
}

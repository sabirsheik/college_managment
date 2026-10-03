import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function NotificationsPage() {
  const notify = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await api.list('notifications');
      setItems(response.data);
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      await load();
      notify('Notification marked as read.');
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      await load();
      notify('All notifications marked as read.');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">CAMPUS UPDATES</span><h2>Notifications</h2><p>Important information and updates for your account.</p></div><button className="button button-secondary" onClick={markAll} disabled={!items.some((item) => !item.is_read)}>Mark all as read</button></div>
      {error && <div className="notice-error" role="alert">{error}</div>}
      <section className="panel notification-panel">
        {loading ? <div className="loading-state"><span className="spinner" />Loading notifications…</div>
          : items.length ? items.map((item) => (
            <article className={`notification-item ${item.is_read ? 'is-read' : ''}`} key={item.id}>
              <span className={`notification-mark notification-${item.type.toLowerCase()}`}>•</span>
              <div className="notification-content"><div><strong>{item.title}</strong><span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.created_at))}</span></div><p>{item.message}</p></div>
              {!item.is_read && <button className="text-button" onClick={() => markRead(item.id)}>Mark read</button>}
            </article>
          )) : <div className="empty-state"><span className="empty-mark">✓</span><strong>You’re all caught up</strong><p>New notifications will appear here.</p></div>}
      </section>
    </div>
  );
}

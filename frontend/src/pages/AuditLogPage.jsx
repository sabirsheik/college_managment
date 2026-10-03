import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.list('audit-logs', { page, limit: 20 })
      .then((response) => { setRows(response.data); setMeta(response.meta); })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">GOVERNANCE</span><h2>Audit log</h2><p>Administrative actions recorded for accountability.</p></div></div>
      <section className="panel resource-panel">
        <div className="table-toolbar"><div><strong>Recorded events</strong><span className="record-count">{meta?.total ?? '—'} events</span></div><span className="private-label">ADMINISTRATOR ACCESS</span></div>
        {error && <div className="notice-error inline-error" role="alert">{error}</div>}
        {loading ? <div className="loading-state"><span className="spinner" />Loading audit records…</div> : rows.length
          ? <div className="table-scroll"><table><thead><tr><th>Action</th><th>Entity</th><th>Record</th><th>Actor</th><th>Time</th></tr></thead><tbody>{rows.map((row) => (
            <tr key={row.id}><td><span className="audit-action">{row.action}</span></td><td>{row.entity_type}</td><td>{row.entity_id || '—'}</td><td>{row.actor_email || 'System'}</td><td>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at))}</td></tr>
          ))}</tbody></table></div> : <div className="empty-state"><span className="empty-mark">—</span><strong>No audit events</strong><p>Administrative actions will be listed here.</p></div>}
        <div className="pagination"><span>Page {meta?.page || page} of {Math.max(meta?.totalPages || 0, 1)}</span><div><button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-secondary" disabled={page >= (meta?.totalPages || 0) || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </div>
  );
}

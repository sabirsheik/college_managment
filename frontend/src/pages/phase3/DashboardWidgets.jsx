import { useEffect, useState } from 'react';

export function rowsOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.courses)) return value.courses;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function shortDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

export function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DataPanel({ title, eyebrow = 'PORTAL', description, load, emptyMessage, children }) {
  const [state, setState] = useState({ loading: true, refreshing: false, error: '', data: null, lastUpdated: null });

  useEffect(() => {
    let active = true;
    let inFlight = false;

    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      setState((current) => ({ ...current, refreshing: true }));
      try {
        const response = await load();
        if (active) {
          setState({
            loading: false,
            refreshing: false,
            error: '',
            data: response?.data ?? null,
            lastUpdated: new Date()
          });
        }
      } catch (error) {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            error: error?.message || 'Unable to load this information.'
          }));
        }
      } finally {
        inFlight = false;
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refresh();
    }

    void refresh();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [load]);

  return (
    <section className="panel p3-panel" aria-labelledby={`p3-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="panel-heading p3-panel-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3 id={`p3-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{title}</h3>
          {description && <p className="p3-panel-description">{description}</p>}
        </div>
        <span className="p3-panel-updated" role="status" aria-live="polite">
          {state.refreshing && state.lastUpdated
            ? 'Updating…'
            : state.lastUpdated
              ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(state.lastUpdated)}`
              : ''}
        </span>
      </div>
      {state.loading ? (
        <div className="p3-state" role="status" aria-live="polite">Loading {title.toLowerCase()}…</div>
      ) : state.error && !state.lastUpdated ? (
        <div className="p3-state p3-state-error" role="alert">
          <strong>{title} unavailable</strong>
          <span>{state.error}</span>
        </div>
      ) : (
        <>
          {state.error && (
            <div className="p3-state p3-state-error" role="alert">
              <strong>Could not refresh {title.toLowerCase()}.</strong>
              <span>{state.error} Showing the last successfully loaded data.</span>
            </div>
          )}
          {children(state.data, emptyMessage)}
        </>
      )}
    </section>
  );
}

export function EmptyState({ children }) {
  return <p className="p3-empty">{children}</p>;
}

export function RecordTable({ title, rows, columns, emptyMessage = 'No records to show yet.' }) {
  const records = rowsOf(rows);
  if (!records.length) return <EmptyState>{emptyMessage}</EmptyState>;
  return (
    <div className="p3-table-wrap">
      <table className="p3-table">
        <caption className="p3-sr-only">{title}</caption>
        <thead>
          <tr>{columns.map((column) => <th scope="col" key={column.label}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id ?? record.receipt_number ?? `${title}-${index}`}>
              {columns.map((column) => (
                <td key={column.label}>{column.render ? column.render(record) : displayValue(record[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Metric({ label, value, hint }) {
  return (
    <div className="p3-metric">
      <span className="p3-metric-label">{label}</span>
      <strong>{value ?? '—'}</strong>
      {hint && <span className="p3-metric-hint">{hint}</span>}
    </div>
  );
}

export function DashboardHeading({ user, subtitle }) {
  const firstName = user?.first_name || user?.name?.split(' ')[0] || 'there';
  return (
    <header className="welcome-row p3-welcome">
      <div>
        <span className="eyebrow">CAMPUS PORTAL</span>
        <h2>Welcome back, {firstName}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

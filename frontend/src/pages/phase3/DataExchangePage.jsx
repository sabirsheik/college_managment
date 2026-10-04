import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { DashboardHeading } from './DashboardWidgets.jsx';
import './phase3.css';

const reports = ['students', 'attendance', 'exam-results', 'fees', 'payments'];
const importEntities = ['students', 'faculty', 'courses'];

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DataExchangePage() {
  const { user, can } = useAuth();
  const allowedReports = user?.role === 'ACCOUNTANT'
    ? ['fees', 'payments']
    : user?.role === 'FACULTY'
      ? ['attendance', 'exam-results']
      : reports;
  const [report, setReport] = useState(allowedReports[0]);
  const [entity, setEntity] = useState(importEntities[0]);
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({ academic_session_id: '', department_id: '', program_id: '', semester: '', section_id: '', from: '', to: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function importFile(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await api.importCsv(entity, await file.text());
      setResult(response.data);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportReport() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const blob = await api.exportCsv(report, filters);
      saveBlob(blob, `${report}-${new Date().toISOString().slice(0, 10)}.csv`);
      setResult({ message: 'Export downloaded.' });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Move authorized records in and out using validated CSV files." />
      {error && <div className="notice-error" role="alert">{error}</div>}
      {result && <div className={result.failed ? 'notice-error' : 'notice-success'} role="status">
        {result.message || `Imported ${result.imported} of ${result.total} records (${result.failed} failed).`}
        {result.errors?.length > 0 && <ul>{result.errors.slice(0, 20).map((item) => <li key={item.row}>Row {item.row}: {item.message}</li>)}</ul>}
      </div>}
      <div className="p3-grid p3-grid-wide">
        {can('imports.run') && (
          <section className="panel p3-panel">
            <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">VALIDATED UPLOAD</span><h3>Import records</h3></div></div>
            <form className="p3-exchange-form" onSubmit={importFile}>
              <label>Record type<select value={entity} onChange={(event) => setEntity(event.target.value)}>{importEntities.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>
              <p>Maximum 1,000 rows and 2 MB. Header names must match the API field names. Invalid rows are returned with row-specific messages.</p>
              <button className="button button-primary" disabled={busy || !file}>{busy ? 'Processing…' : 'Import CSV'}</button>
            </form>
          </section>
        )}
        <section className="panel p3-panel">
          <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">FILTERED DOWNLOAD</span><h3>Export report</h3></div></div>
          <div className="p3-exchange-form">
            <label>Report<select value={report} onChange={(event) => setReport(event.target.value)}>{allowedReports.map((name) => <option key={name}>{name}</option>)}</select></label>
            <div className="p3-filter-grid">
              {[
                ['academic_session_id', 'Academic session ID'],
                ['department_id', 'Department ID'],
                ['program_id', 'Program ID'],
                ['semester', 'Semester'],
                ['section_id', 'Section ID']
              ].map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="1" value={filters[name]} onChange={updateFilter} /></label>)}
              <label>From<input name="from" type="date" value={filters.from} onChange={updateFilter} /></label>
              <label>To<input name="to" type="date" value={filters.to} onChange={updateFilter} /></label>
            </div>
            <button className="button button-primary" onClick={exportReport} disabled={busy}>{busy ? 'Preparing…' : 'Download CSV'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

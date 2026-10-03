import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ResourceForm from '../components/ResourceForm.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { permissionFor, resourceConfig } from '../constants/resources.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

export default function ResourcePage() {
  const { resource } = useParams();
  const config = resourceConfig[resource];
  const navigate = useNavigate();
  const { can } = useAuth();
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [sort, setSort] = useState(config.sortFields?.[0] || 'created_at');
  const [page, setPage] = useState(1);
  const [formRecord, setFormRecord] = useState(undefined);
  const [resetRecord, setResetRecord] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    const sources = [...new Set((config.filters || []).map((filter) => filter.optionsSource).filter(Boolean))];
    Promise.all(sources.map(async (source) => [source, await api.list(source)]))
      .then((entries) => {
        if (active) setFilterOptions(Object.fromEntries(entries.map(([source, result]) => [source, result.data])));
      })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.list(resource, {
        page,
        limit: 20,
        q: debouncedSearch,
        sort,
        order: 'asc',
        ...filters
      });
      setRows(response.data);
      setMeta(response.meta);
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, [resource, page, debouncedSearch, sort, filters]);

  useEffect(() => { load(); }, [load]);

  async function save(data) {
    const creating = !formRecord;
    if (creating) await api.create(resource, data);
    else await api.update(resource, formRecord.id, data);
    setFormRecord(undefined);
    notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${creating ? 'created' : 'updated'} successfully.`);
    if (page !== 1) setPage(1);
    else await load();
  }

  async function remove(row) {
    const label = row.name || row.title || row.code || row.student_id ||
      row.registration_number || `${row.first_name || ''} ${row.last_name || ''}`.trim() || `#${row.id}`;
    const action = resource === 'users' ? 'Deactivate' : 'Delete';
    if (!window.confirm(`${action} ${config.singular} "${label}"?`)) return;
    try {
      await api.remove(resource, row.id);
      notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${resource === 'users' ? 'deactivated' : 'deleted'} successfully.`);
      await load();
    } catch (cause) {
      setError(cause.message);
      notify(cause.message, 'error');
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (!resetRecord) return;
    setResetting(true);
    setResetError('');
    try {
      await api.resetPassword(resetRecord.id, newPassword);
      setResetRecord(null);
      setNewPassword('');
      notify('Password reset successfully.');
    } catch (cause) {
      setResetError(cause.message);
    } finally {
      setResetting(false);
    }
  }

  function changeFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  const canCreate = can(permissionFor(resource, 'create'));
  const canUpdate = can(permissionFor(resource, 'update'));
  const canDelete = can(permissionFor(resource, 'delete'));

  return (
    <div className="page-content">
      <div className="resource-heading">
        <div><span className="eyebrow">ACADEMIC OPERATIONS / RECORDS</span><h2>{config.label}</h2><p>Review and manage {config.label.toLowerCase()} across your college.</p></div>
        {canCreate && <button className="button button-primary" onClick={() => setFormRecord(null)}>＋ Add {config.singular}</button>}
      </div>
      <section className="panel resource-panel">
        <div className="table-toolbar">
          <div><strong>All {config.label.toLowerCase()}</strong><span className="record-count">{meta.total.toLocaleString()} total records</span></div>
          <div className="table-controls">
            {config.filters?.map((filter) => (
              <select key={filter.key} className="filter-select" value={filters[filter.key] || ''} onChange={(event) => changeFilter(filter.key, event.target.value)} aria-label={filter.label}>
                <option value="">{filter.label}</option>
                {filter.optionsSource
                  ? (filterOptions[filter.optionsSource] || []).map((option) => <option key={option.id} value={option[filter.optionValue]}>{option[filter.optionLabel]}</option>)
                  : filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ))}
            <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.label.toLowerCase()}…`} aria-label={`Search ${config.label.toLowerCase()}`} /></label>
            <label className="sort-select"><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort records">
              {config.sortFields.map((field) => <option key={field} value={field}>{field.replaceAll('_', ' ')}</option>)}
            </select></label>
          </div>
        </div>
        {error && <div className="notice-error inline-error" role="alert">{error}</div>}
        {loading
          ? <div className="loading-state"><span className="spinner" />Loading {config.label.toLowerCase()}…</div>
          : <ResourceTable
            columns={config.columns}
            rows={rows}
            resource={config.singular}
            onEdit={(row) => setFormRecord(row)}
            onDelete={remove}
            onView={config.detailPath ? (row) => navigate(config.detailPath(row)) : undefined}
            onReset={(row) => { setResetRecord(row); setResetError(''); }}
            canReset={resource === 'users' && can('users.reset-password')}
            canUpdate={canUpdate}
            canDelete={canDelete}
            deleteLabel={resource === 'users' ? 'Deactivate' : 'Delete'}
          />}
        <div className="pagination">
          <span>Showing {meta.total ? (meta.page - 1) * meta.limit + 1 : 0}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total.toLocaleString()}</span>
          <div>
            <button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="page-indicator">Page {meta.page} of {Math.max(meta.totalPages, 1)}</span>
            <button className="button button-secondary" disabled={page >= meta.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </section>
      {formRecord !== undefined && <ResourceForm
        key={`${resource}-${formRecord?.id ?? 'new'}`}
        config={config}
        record={formRecord}
        onClose={() => setFormRecord(undefined)}
        onSave={save}
      />}
      {resetRecord && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setResetRecord(null);
      }}>
        <section className="modal reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="modal-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2 id="reset-title">Reset user password</h2></div><button className="close-button" onClick={() => setResetRecord(null)} aria-label="Close">×</button></div>
          <form onSubmit={resetPassword}>
            <p className="reset-user">{resetRecord.first_name} {resetRecord.last_name} · {resetRecord.email}</p>
            <label className="password-field">Temporary password<input type="password" minLength="12" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            {resetError && <div className="form-error" role="alert">{resetError}</div>}
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setResetRecord(null)}>Cancel</button><button className="button button-primary" disabled={resetting}>{resetting ? 'Resetting…' : 'Reset password'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

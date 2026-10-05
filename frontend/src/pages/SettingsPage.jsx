import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { permissions } from '../constants/permissions.js';
import { api } from '../services/api.js';
import Icon from '../components/Icon.jsx';

const fields = [
  ['college_name', 'College name', true],
  ['logo_url', 'Logo URL'],
  ['email', 'Contact email', false, 'email'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['academic_year', 'Academic year'],
  ['timezone', 'Timezone', true],
  ['currency', 'Currency code', true],
  ['address', 'Street address', false, 'textarea'],
  ['city', 'City'],
  ['state', 'State / province'],
  ['country', 'Country']
];

export default function SettingsPage() {
  const { can } = useAuth();
  const canUpdate = can(permissions.collegeSettingsUpdate);
  const notify = useToast();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings()
      .then((response) => setValues(response.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await api.updateSettings(Object.fromEntries(fields.map(([key]) => [key, values[key] || null])));
      setValues(response.data);
      notify('College settings saved.');
    } catch (cause) {
      setError(cause.message);
      notify(cause.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="resource-heading"><div><span className="eyebrow">INSTITUTION PROFILE</span><h2>College settings</h2><p>Manage the institutional information used across Campus.</p></div></div>
      <form className="panel settings-panel" onSubmit={submit}>
        <div className="settings-section-heading"><span className="settings-icon"><Icon name="building" size={20} /></span><div><h3>College identity</h3><p>Contact and academic details for your institution.</p></div></div>
        {loading ? <div className="loading-state"><span className="spinner" />Loading settings…</div> : <>
          {error && <div className="notice-error" role="alert">{error}</div>}
          <div className="form-grid settings-grid">
            {fields.map(([key, label, required, type]) => (
              <label className={type === 'textarea' ? 'field-wide' : ''} key={key}>
                <span>{label}{required && <b className="required"> *</b>}</span>
                {type === 'textarea'
                  ? <textarea rows="3" required={required} disabled={!canUpdate} value={values[key] || ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />
                  : <input type={type || 'text'} required={required} disabled={!canUpdate} value={values[key] || ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />}
              </label>
            ))}
          </div>
          <div className="settings-actions"><span>{canUpdate ? 'Changes are saved to the college profile immediately.' : 'You have read-only access to institutional settings.'}</span>{canUpdate && <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>}</div>
        </>}
      </form>
    </div>
  );
}

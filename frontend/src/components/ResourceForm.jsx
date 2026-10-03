import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

function initialValue(field, record) {
  if (record && record[field.key] != null) return String(record[field.key]);
  if (field.defaultValue !== undefined) return String(field.defaultValue);
  if (field.key === 'status') return field.options?.[0]?.[0] || 'ACTIVE';
  if (field.key === 'is_current') return 'false';
  return '';
}

export default function ResourceForm({ config, record, onClose, onSave }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(config.fields.map((field) => [field.key, initialValue(field, record)]))
  );
  const [options, setOptions] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const sources = [...new Set(config.fields.map((field) => field.option).filter(Boolean))];
    Promise.all(sources.map(async (source) => [source, await api.list(source)]))
      .then((entries) => { if (active) setOptions(Object.fromEntries(entries.map(([source, result]) => [source, result.data]))); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [config]);

  function change(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const visibleFields = config.fields.filter((field) =>
      (!field.createOnly || !record) && (!field.editOnly || record) &&
      (!field.updateOnly || record)
    );
    const data = Object.fromEntries(visibleFields.map((field) => {
      const value = values[field.key];
      if (value === '' && !field.required) return [field.key, null];
      if (field.type === 'number') return [field.key, Number(value)];
      if (field.type === 'boolean') return [field.key, value === 'true'];
      if (field.option || field.key.endsWith('_id')) return [field.key, Number(value)];
      return [field.key, value];
    }));
    try {
      await onSave(data);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{record ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h2 id="form-title">{record ? 'Edit' : 'Add'} {config.singular}</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close form">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {config.fields.filter((field) =>
              (!field.createOnly || !record) && (!field.editOnly || record) &&
              (!field.updateOnly || record)
            ).map((field) => (
              <label key={field.key} className={field.wide ? 'field-wide' : ''}>
                <span>{field.label}{field.required ? <b className="required"> *</b> : ''}</span>
                {field.option || field.options ? (
                  <select
                    value={values[field.key]}
                    required={field.required}
                    onChange={(event) => change(field.key, event.target.value)}
                  >
                    {!field.required && <option value="">None</option>}
                    {field.option
                      ? (options[field.option] || []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {field.optionLabel ? option[field.optionLabel] : option.name || option.title || option.code || `${option.first_name || ''} ${option.last_name || ''}`.trim()}
                          {option.student_number && field.optionLabel !== 'student_id' ? ` · ${option.student_number}` : ''}
                        </option>
                      ))
                      : field.options.map((option) => <option key={option[0]} value={option[0]}>{option[1]}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type === 'boolean' ? 'text' : field.type || 'text'}
                    value={values[field.key]}
                    required={field.required}
                    min={field.min ?? (field.key === 'enrollment_year' ? 1900 : field.key === 'credits' ? 1 : undefined)}
                    max={field.max ?? (field.key === 'enrollment_year' ? 2200 : field.key === 'credits' ? 30 : undefined)}
                    minLength={field.minLength}
                    step={field.step}
                    onChange={(event) => change(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
            <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : record ? 'Save changes' : `Add ${config.singular}`}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

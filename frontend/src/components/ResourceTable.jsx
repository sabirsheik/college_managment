export default function ResourceTable({
  columns, rows, resource, onEdit, onDelete, onView,
  onReset, canReset = false, canUpdate = true, canDelete = true, deleteAllowed,
  emptyMessage,
  deleteLabel = 'Delete'
}) {
  if (rows.length === 0) {
    return <div className="empty-state"><span className="empty-mark">—</span><strong>{emptyMessage || 'No records yet'}</strong><p>{emptyMessage ? 'Try changing your search or filters.' : `Add your first ${resource} to get started.`}</p></div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => {
                const value = column.render ? column.render(row) : row[column.key];
                return <td key={column.key}>
                  {column.badge
                    ? <span className={`status status-${String(value).toLowerCase()}`}>{value}</span>
                    : column.date && value
                      ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
                      : value ?? '—'}
                </td>;
              })}
              <td className="row-actions">
                {onView && <button className="text-button" onClick={() => onView(row)}>Profile</button>}
                {canUpdate && <button className="text-button" onClick={() => onEdit(row)} aria-label={`Edit ${resource} ${row.id}`}>Edit</button>}
                {canReset && <button className="text-button" onClick={() => onReset(row)}>Reset password</button>}
                {canDelete && (!deleteAllowed || deleteAllowed(row)) && <button className="text-button danger-text" onClick={() => onDelete(row)} aria-label={`${deleteLabel} ${resource} ${row.id}`}>{deleteLabel}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

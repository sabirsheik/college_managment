import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { DashboardHeading, DataPanel, EmptyState, RecordTable, rowsOf, shortDate } from './DashboardWidgets.jsx';
import './phase3.css';

export default function LibrarianDashboard({ user: suppliedUser }) {
  const { user: currentUser } = useAuth();
  const user = suppliedUser || currentUser;
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loanForm, setLoanForm] = useState({ member_id: '', copy_id: '', due_date: '' });
  const [members, setMembers] = useState([]);
  const [copies, setCopies] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBookSearch = useCallback(
    () => api.list('library/search', { q: appliedQuery || undefined, limit: 8 }).then((result) => ({ ...result, refresh })),
    [appliedQuery, refresh]
  );
  const loadAvailability = useCallback(
    () => api.list('library/availability', { q: appliedQuery || undefined, limit: 8 }).then((result) => ({ ...result, refresh })),
    [appliedQuery, refresh]
  );
  const loadOpenLoans = useCallback(async () => {
    const [active, overdue] = await Promise.all([
      api.list('library/loans', { status: 'ACTIVE', limit: 8 }),
      api.list('library/loans', { status: 'OVERDUE', limit: 8 })
    ]);
    return { data: [...rowsOf(active), ...rowsOf(overdue)], refresh };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => Promise.all([
      api.list('library/members', { active: true, q: memberSearch || undefined, limit: 100 }),
      api.list('library/copies', { status: 'AVAILABLE', available: true, q: copySearch || undefined, limit: 100 })
    ]).then(([memberResult, copyResult]) => {
      if (active) {
        setMembers(rowsOf(memberResult));
        setCopies(rowsOf(copyResult));
      }
    }).catch((cause) => {
      if (active) setError(cause.message);
    }), 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [refresh, memberSearch, copySearch]);

  function submitSearch(event) {
    event.preventDefault();
    setAppliedQuery(query.trim());
  }

  async function issueCopy(event) {
    event.preventDefault();
    setBusyId('issue');
    setError('');
    setMessage('');
    try {
      await api.create('library/loans', {
        member_id: Number(loanForm.member_id),
        copy_id: Number(loanForm.copy_id),
        ...(loanForm.due_date ? { due_date: loanForm.due_date } : {})
      });
      setLoanForm({ member_id: '', copy_id: '', due_date: '' });
      setMessage('Copy issued successfully.');
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusyId(null);
    }
  }

  async function updateLoan(id, action) {
    setBusyId(id);
    setError('');
    setMessage('');
    try {
      await api.create(`library/loans/${id}/${action}`, {});
      setMessage(action === 'return' ? 'Copy returned successfully.' : 'Loan renewed successfully.');
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="Search the collection and review current circulation activity." />
      {error && <div className="notice-error" role="alert">{error}</div>}
      {message && <div className="notice-success" role="status">{message}</div>}
      {can('library.loans.create') && (
        <section className="panel p3-panel p3-form-panel">
          <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">CIRCULATION</span><h3>Issue a library copy</h3></div></div>
          <form className="p3-loan-form" onSubmit={issueCopy}>
            <label>Find member<input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Name, member code, email" /></label>
            <label>Member<select value={loanForm.member_id} onChange={(event) => setLoanForm((current) => ({ ...current, member_id: event.target.value }))} required>
              <option value="">Choose a member</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {member.member_code}</option>)}
            </select></label>
            <label>Find copy<input type="search" value={copySearch} onChange={(event) => setCopySearch(event.target.value)} placeholder="Book title or barcode" /></label>
            <label>Available copy<select value={loanForm.copy_id} onChange={(event) => setLoanForm((current) => ({ ...current, copy_id: event.target.value }))} required>
              <option value="">Choose a copy</option>
              {copies.map((copy) => <option key={copy.id} value={copy.id}>{copy.book_title} · {copy.barcode}</option>)}
            </select></label>
            <label>Due date (optional)<input type="date" value={loanForm.due_date} onChange={(event) => setLoanForm((current) => ({ ...current, due_date: event.target.value }))} /></label>
            <button className="button button-primary" disabled={busyId === 'issue'}>{busyId === 'issue' ? 'Issuing…' : 'Issue copy'}</button>
          </form>
        </section>
      )}
      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Book catalogue" eyebrow="DISCOVERY" load={loadBookSearch}>
          {(data) => (
            <>
              <form className="p3-search-form" onSubmit={submitSearch} role="search">
                <label className="p3-sr-only" htmlFor="p3-book-search">Search by title, author, ISBN, or barcode</label>
                <input
                  id="p3-book-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Title, author, ISBN, or barcode"
                  maxLength={100}
                />
                <button className="button button-primary" type="submit">Search</button>
              </form>
              <RecordTable
                title="Book search results"
                rows={rowsOf(data)}
                emptyMessage={appliedQuery ? `No books matched “${appliedQuery}”.` : 'No books are available in the catalogue.'}
                columns={[
                  { label: 'Book', render: (row) => <><strong>{row.title}</strong><span className="p3-cell-sub">{row.author}</span></> },
                  { label: 'Category', render: (row) => row.category_name || '—' },
                  { label: 'ISBN', render: (row) => row.isbn || '—' },
                  { label: 'Available', render: (row) => `${row.available_copies ?? '—'} / ${row.total_copies ?? '—'}` }
                ]}
              />
            </>
          )}
        </DataPanel>
        <DataPanel title="Collection availability" eyebrow="INVENTORY" load={loadAvailability}>
          {(data) => (
            <RecordTable
              title="Book availability"
              rows={rowsOf(data)}
              emptyMessage={appliedQuery ? `No availability records matched “${appliedQuery}”.` : 'No availability data is available.'}
              columns={[
                { label: 'Book', render: (row) => <><strong>{row.title}</strong><span className="p3-cell-sub">{row.author}</span></> },
                { label: 'Category', render: (row) => row.category_name || '—' },
                { label: 'Available copies', render: (row) => row.available_copies ?? '—' },
                { label: 'Total copies', render: (row) => row.total_copies ?? '—' }
              ]}
            />
          )}
        </DataPanel>
      </div>
      <div className="p3-grid">
        <DataPanel title="Active issues" eyebrow="CIRCULATION" description="Open loans, including overdue items." load={loadOpenLoans}>
          {(data) => (
            <RecordTable
              title="Active and overdue library issues"
              rows={rowsOf(data)}
              emptyMessage="There are no active or overdue loans."
              columns={[
                { label: 'Book', render: (row) => <strong>{row.book_title || '—'}</strong> },
                { label: 'Member', render: (row) => <><strong>{row.full_name || '—'}</strong><span className="p3-cell-sub">{row.member_code}</span></> },
                { label: 'Issued', render: (row) => shortDate(row.issued_at) },
                { label: 'Due', render: (row) => shortDate(row.due_date) },
                { label: 'Status', render: (row) => <span className="p3-tag">{row.status}</span> },
                ...(can('library.loans.update') ? [{
                  label: 'Actions',
                  render: (row) => row.returned_at ? '—' : (
                    <div className="p3-loan-actions">
                      <button className="p3-text-button" disabled={busyId === row.id} onClick={() => updateLoan(row.id, 'return')}>Return</button>
                      {row.status === 'ACTIVE' && <button className="p3-text-button" disabled={busyId === row.id} onClick={() => updateLoan(row.id, 'renew')}>Renew</button>}
                    </div>
                  )
                }] : [])
              ]}
            />
          )}
        </DataPanel>
      </div>
      <footer className="dashboard-footer">Library portal · Search, availability, and issue details come from library services.</footer>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { DashboardHeading, DataPanel, EmptyState, Metric, money, RecordTable, rowsOf, shortDate } from './DashboardWidgets.jsx';
import './phase3.css';

const loadFeeReport = () => api.reports('fees');
const loadOutstandingReport = () => api.reports('outstanding-balances');
const loadRecentPayments = () => api.list('payments', { limit: 8 });

function totalOf(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

export default function AccountantDashboard({ user }) {
  return (
    <div className="page-content p3-dashboard">
      <DashboardHeading user={user} subtitle="A clear view of collections, balances, and recent payments." />
      <div className="p3-grid">
        <DataPanel title="Financial summary" eyebrow="FEE REPORT" load={loadFeeReport}>
          {(data) => {
            const rows = rowsOf(data);
            if (!rows.length) return <EmptyState>No fee summary data is available for the current report scope.</EmptyState>;
            return (
              <>
                <div className="p3-metric-row p3-finance-metrics">
                  <Metric label="Billed" value={money(totalOf(rows, 'billed'))} hint="Sum of report buckets" />
                  <Metric label="Collected" value={money(totalOf(rows, 'collected'))} hint="Payments recorded in report" />
                  <Metric label="Outstanding" value={money(totalOf(rows, 'outstanding'))} hint="Remaining fee balances" />
                </div>
                <RecordTable
                  title="Financial summary by term and fee status"
                  rows={rows}
                  columns={[
                    { label: 'Term', render: (row) => `Session ${row.academic_session_id ?? '—'} · Semester ${row.semester ?? '—'}` },
                    { label: 'Fee status', render: (row) => row.status || '—' },
                    { label: 'Fee records', render: (row) => row.fee_count ?? '—' },
                    { label: 'Billed', render: (row) => money(row.billed) },
                    { label: 'Collected', render: (row) => money(row.collected) },
                    { label: 'Outstanding', render: (row) => money(row.outstanding) }
                  ]}
                />
              </>
            );
          }}
        </DataPanel>
      </div>
      <div className="p3-grid p3-grid-wide">
        <DataPanel title="Outstanding balances" eyebrow="FOLLOW-UP" load={loadOutstandingReport}>
          {(data) => (
            <RecordTable
              title="Outstanding balance summary"
              rows={rowsOf(data)}
              emptyMessage="No outstanding balances were returned by the report."
              columns={[
                { label: 'Term', render: (row) => `Session ${row.academic_session_id ?? '—'} · Semester ${row.semester ?? '—'}` },
                { label: 'Fee status', render: (row) => row.status || '—' },
                { label: 'Fee records', render: (row) => row.fee_count ?? '—' },
                { label: 'Outstanding', render: (row) => money(row.outstanding) }
              ]}
            />
          )}
        </DataPanel>
        <DataPanel title="Recent payments" eyebrow="CASH FLOW" load={loadRecentPayments}>
          {(data) => (
            <>
              <RecordTable
                title="Recent payments"
                rows={rowsOf(data)}
                emptyMessage="No payments have been recorded yet."
                columns={[
                  { label: 'Student', render: (row) => row.student_name || row.registration_number || '—' },
                  { label: 'Receipt', render: (row) => row.receipt_number || '—' },
                  { label: 'Date', render: (row) => shortDate(row.payment_date) },
                  { label: 'Amount', render: (row) => money(row.amount) }
                ]}
              />
              <div className="p3-panel-footer"><Link className="p3-action-link" to="/payments">Open payments <span aria-hidden="true">→</span></Link></div>
            </>
          )}
        </DataPanel>
      </div>
      <footer className="dashboard-footer">Finance portal · Financial figures reflect the authorized server report results.</footer>
    </div>
  );
}

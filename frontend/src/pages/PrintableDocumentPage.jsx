import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

function money(value, currency = 'USD') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function date(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

export default function PrintableDocumentPage({ type }) {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const invoice = type === 'invoice';

  useEffect(() => {
    let active = true;
    const load = invoice ? api.get('invoices', id) : api.get('receipts', id);
    load.then((response) => {
      if (active) setDocument(response.data?.invoice || response.data?.receipt || response.data);
    }).catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, invoice]);

  if (loading) return <div className="page-content"><div className="loading-state"><span className="spinner" />Loading {invoice ? 'invoice' : 'receipt'}…</div></div>;
  if (error) return <div className="page-content"><div className="notice-error" role="alert">{error}</div></div>;
  if (!document) return <div className="page-content"><div className="empty-state"><strong>Document unavailable</strong><p>The requested document could not be found.</p></div></div>;

  const lineItems = document.items || document.fee_items || [];
  const student = document.student || {};
  const studentName = student.name || document.student_name ||
    `${document.first_name || ''} ${document.last_name || ''}`.trim() || '—';
  const documentDate = document.issued_at || document.payment_date;
  const invoiceAmount = document.remaining_amount ?? document.total_amount;
  return (
    <div className="page-content">
      <div className="resource-heading no-print">
        <div><span className="eyebrow">FINANCE / {invoice ? 'INVOICE' : 'PAYMENT RECEIPT'}</span><h2>{invoice ? 'Invoice' : 'Payment receipt'}</h2><p>Print a copy for your records. Record access is enforced by the server.</p></div>
        <button className="button button-primary" onClick={() => window.print()}>Print {invoice ? 'invoice' : 'receipt'}</button>
      </div>
      <article className="print-document">
        <header className="print-document-header">
          <div><span className="eyebrow">{document.college_name || 'CAMPUS · COLLEGE MANAGEMENT'}</span><h1>{invoice ? 'Invoice' : 'Payment receipt'}</h1></div>
          <div className="print-document-number"><strong>{document.invoice_number || document.receipt_number || document.reference_number || `#${document.id}`}</strong><span>{invoice ? 'Invoice number' : 'Receipt number'}</span></div>
        </header>
        <div className="print-document-meta">
          <div><span>Student</span><strong>{studentName}</strong><small>{student.registration_number || document.registration_number || ''}</small></div>
          <div><span>{invoice ? 'Issue date' : 'Payment date'}</span><strong>{date(documentDate)}</strong></div>
          <div><span>{invoice ? 'Due date' : 'Payment method'}</span><strong>{invoice ? date(document.due_date) : (document.payment_method || '—')}</strong></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead>
            <tbody>{(lineItems.length ? lineItems : [{
              description: document.fee_type || (invoice ? 'Fees' : 'Payment'),
              amount: invoice ? document.total_amount : document.amount
            }]).map((item, index) => <tr key={item.id || index}>
              <td>{item.description || item.fee_type || item.name || '—'}</td>
              <td>{item.quantity || 1}</td>
              <td>{money(item.amount ?? item.total_amount, document.currency || 'USD')}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="print-total"><span>{invoice ? 'Balance due' : 'Amount paid'}</span><strong>{money(invoice ? invoiceAmount : document.amount, document.currency || 'USD')}</strong></div>
        <footer className="print-document-footer">{invoice ? `Status: ${document.invoice_status || document.status || '—'}` : `Payment method: ${document.payment_method || '—'}`}<p>{document.college_name || 'College management system'}{document.address ? ` · ${document.address}` : ''}</p></footer>
      </article>
    </div>
  );
}

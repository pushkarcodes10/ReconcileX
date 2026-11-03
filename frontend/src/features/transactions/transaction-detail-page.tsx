import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '../../api/endpoints/transactions';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDateTime } from '../../shared/lib/date';
import {
  ArrowLeftIcon,
  ReceiptIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
} from '../../shared/components/icons';

export const TransactionDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();

  const { data: txn, isLoading, error, refetch } = useQuery({
    queryKey: ['transaction', orgId, id],
    queryFn: () => transactionsApi.getById(orgId!, id!),
    enabled: !!orgId && !!id,
  });

  if (isLoading) return <LoadingState message="Loading transaction details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!txn) return <p>Transaction record not found.</p>;

  return (
    <div style={{ maxWidth: '880px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/transactions`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Transactions
        </Link>
      </div>

      {/* Header Card (Reference 1 & 4) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--rx-radius-md)',
                  backgroundColor: 'var(--rx-dark)',
                  color: 'var(--rx-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptIcon size={18} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Transaction: {txn.externalId}
              </h1>
            </div>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.4rem', fontSize: '0.85rem' }}>
              System ID: <code>{txn.id}</code>
            </div>
          </div>
          <div>
            <StatusBadge status={txn.status} />
          </div>
        </div>
      </div>

      {/* Hero Financial Amount Card (Reference 2 Bento Accent) */}
      <div
        className="rx-card"
        style={{
          padding: '1.5rem 1.75rem',
          backgroundColor: 'var(--rx-dark)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', color: '#D4D8CF', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Reconciled Amount
          </span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--rx-lime)', fontFamily: 'var(--rx-font-mono)', lineHeight: 1.1, marginTop: '0.25rem' }}>
            {formatAmountMinor(txn.amountMinor, txn.currency)}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
          <div style={{ color: '#D4D8CF' }}>Raw minor units:</div>
          <code style={{ fontSize: '1.1rem', color: '#FFFFFF', fontWeight: 700 }}>
            {txn.amountMinor} {txn.currency}
          </code>
        </div>
      </div>

      {/* Structured Details Table (Reference 4) */}
      <section className="rx-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 700 }}>
          Transaction Record Details
        </h3>

        <div className="rx-table-container">
          <table className="rx-table">
            <tbody>
              <tr>
                <td style={{ width: '240px', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Transaction Date</td>
                <td>{formatDateTime(txn.transactionDate)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Reference / Memo</td>
                <td>{txn.reference || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>External Transaction ID</td>
                <td><code className="rx-col-code">{txn.externalTxnId || '—'}</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Merchant / Order ID</td>
                <td><code className="rx-col-code">{txn.merchantOrOrderId || '—'}</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Transaction Type</td>
                <td>{txn.txnType || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Originating Data Source</td>
                <td>
                  <Link
                    to={`/orgs/${orgId}/data-sources/${txn.dataSourceId}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--rx-text-primary)', fontWeight: 600 }}
                  >
                    <DatabaseIcon size={14} /> <code>{txn.dataSourceId}</code> &rarr;
                  </Link>
                </td>
              </tr>
              {txn.importId && (
                <tr>
                  <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Import Batch ID</td>
                  <td>
                    <Link
                      to={`/orgs/${orgId}/imports/${txn.importId}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--rx-text-primary)', fontWeight: 600 }}
                    >
                      <FileSpreadsheetIcon size={14} /> <code>{txn.importId}</code> &rarr;
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Raw Payload / Metadata */}
      {txn.metadata && Object.keys(txn.metadata).length > 0 && (
        <section className="rx-card" style={{ padding: '1.75rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>
            Additional Ingested Metadata
          </h4>
          <pre
            style={{
              backgroundColor: 'var(--rx-surface-subtle)',
              border: '1px solid var(--rx-border)',
              padding: '1rem',
              borderRadius: 'var(--rx-radius-md)',
              overflowX: 'auto',
              fontSize: '0.8125rem',
              margin: 0,
            }}
          >
            {JSON.stringify(txn.metadata, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

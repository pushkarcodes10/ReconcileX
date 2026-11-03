import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '../../api/endpoints/transactions';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDateTime } from '../../shared/lib/date';

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
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/transactions`}>&larr; Back to Transactions</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Transaction: {txn.externalId}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            ID: <code>{txn.id}</code> | Status: <StatusBadge status={txn.status} />
          </div>
        </div>
      </div>

      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Transaction Record Details</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: '220px' }}><strong>Formatted Amount:</strong></td>
              <td style={{ padding: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {formatAmountMinor(txn.amountMinor, txn.currency)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Raw Amount (Minor Units):</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{txn.amountMinor}</code> {txn.currency}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Transaction Date:</strong></td>
              <td style={{ padding: '0.5rem' }}>{formatDateTime(txn.transactionDate)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Reference:</strong></td>
              <td style={{ padding: '0.5rem' }}>{txn.reference || '—'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>External Transaction ID:</strong></td>
              <td style={{ padding: '0.5rem' }}>{txn.externalTxnId || '—'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Merchant / Order ID:</strong></td>
              <td style={{ padding: '0.5rem' }}>{txn.merchantOrOrderId || '—'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Transaction Type:</strong></td>
              <td style={{ padding: '0.5rem' }}>{txn.txnType || '—'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Data Source ID:</strong></td>
              <td style={{ padding: '0.5rem' }}>
                <Link to={`/orgs/${orgId}/data-sources/${txn.dataSourceId}`}>
                  <code>{txn.dataSourceId}</code>
                </Link>
              </td>
            </tr>
            {txn.importId && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}><strong>Import Batch ID:</strong></td>
                <td style={{ padding: '0.5rem' }}>
                  <Link to={`/orgs/${orgId}/imports/${txn.importId}`}>
                    <code>{txn.importId}</code>
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Raw Payload / Metadata */}
      {txn.metadata && Object.keys(txn.metadata).length > 0 && (
        <section style={{ border: '1px solid #eee', padding: '1rem' }}>
          <h4>Additional Ingested Metadata</h4>
          <pre style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', overflowX: 'auto', fontSize: '0.85rem' }}>
            {JSON.stringify(txn.metadata, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

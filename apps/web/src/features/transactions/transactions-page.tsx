import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '../../api/endpoints/transactions';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatAmountMinor, toAmountMinor } from '../../shared/lib/amount';
import { formatDate } from '../../shared/lib/date';
import { TransactionStatus } from '../../api/types';

export const TransactionsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sourceId, setSourceId] = useState(searchParams.get('sourceId') || '');
  const [status, setStatus] = useState<TransactionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Data sources query for filter
  const { data: dataSources } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  // 2. Transactions query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', orgId, page, limit, sourceId, status, dateFrom, dateTo, amountInput, searchTerm],
    queryFn: () =>
      transactionsApi.list(orgId!, {
        page,
        limit,
        sourceId: sourceId || undefined,
        status: (status as TransactionStatus) || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        amount: amountInput ? toAmountMinor(amountInput) : undefined,
        q: searchTerm.trim() || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Transactions Explorer</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Read-only financial transaction records across all ingested data sources.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div
        style={{
          border: '1px solid #eee',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Data Source</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.4rem' }}
          >
            <option value="">All Sources</option>
            {dataSources?.items.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.4rem' }}
          >
            <option value="">All Statuses</option>
            <option value="IMPORTED">IMPORTED</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="UNMATCHED">UNMATCHED</option>
            <option value="MATCHED">MATCHED</option>
            <option value="POTENTIAL_MATCH">POTENTIAL_MATCH</option>
            <option value="EXCEPTION">EXCEPTION</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Amount</label>
          <input
            type="number"
            step="0.01"
            placeholder="e.g. 150.00"
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Search (ID/Ref)</label>
          <input
            type="text"
            placeholder="Search external ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <LoadingState message="Loading transactions..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Transactions Found"
          description="No transactions match the selected filters."
        />
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>External ID</th>
                <th style={{ padding: '0.6rem' }}>Date</th>
                <th style={{ padding: '0.6rem' }}>Amount</th>
                <th style={{ padding: '0.6rem' }}>Status</th>
                <th style={{ padding: '0.6rem' }}>Reference</th>
                <th style={{ padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((txn) => (
                <tr key={txn.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem' }}>
                    <code>{txn.externalId}</code>
                  </td>
                  <td style={{ padding: '0.6rem' }}>{formatDate(txn.transactionDate)}</td>
                  <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>
                    {formatAmountMinor(txn.amountMinor, txn.currency)}
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <StatusBadge status={txn.status} />
                  </td>
                  <td style={{ padding: '0.6rem', color: '#666' }}>{txn.reference || '—'}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <Link to={`/orgs/${orgId}/transactions/${txn.id}`}>View Details &rarr;</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { exceptionsApi } from '../../api/endpoints/exceptions';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDateTime } from '../../shared/lib/date';
import { ExceptionStatus } from '../../api/types';

export const ExceptionsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExceptionStatus | ''>(
    (searchParams.get('status') as ExceptionStatus) || ''
  );
  const [runId] = useState(searchParams.get('runId') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exceptions', orgId, page, status, runId, searchTerm],
    queryFn: () =>
      exceptionsApi.list(orgId!, {
        page,
        limit: 15,
        status: (status as ExceptionStatus) || undefined,
        runId: runId || undefined,
        q: searchTerm.trim() || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Exceptions Management</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Investigate, assign, collaborate, and resolve discrepancies flagged during reconciliation.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <label>
          Status:{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </label>

        <label>
          Search (Transaction ID / Reference):{' '}
          <input
            type="text"
            placeholder="Search external ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.3rem' }}
          />
        </label>
      </div>

      {isLoading ? (
        <LoadingState message="Loading exceptions list..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Exceptions Found"
          description="There are currently no reconciliation exceptions matching the selected filters."
        />
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>Exception ID</th>
                <th style={{ padding: '0.6rem' }}>Status</th>
                <th style={{ padding: '0.6rem' }}>Transaction External ID</th>
                <th style={{ padding: '0.6rem' }}>Amount</th>
                <th style={{ padding: '0.6rem' }}>Assignee</th>
                <th style={{ padding: '0.6rem' }}>Created At</th>
                <th style={{ padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ex) => (
                <tr key={ex.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem' }}>
                    <code>{ex.id.slice(0, 8)}...</code>
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <StatusBadge status={ex.status} />
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <code>{ex.transaction?.externalId || ex.transactionId.slice(0, 8)}</code>
                  </td>
                  <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>
                    {formatAmountMinor(ex.transaction?.amountMinor, ex.transaction?.currency)}
                  </td>
                  <td style={{ padding: '0.6rem', color: ex.assigneeName ? '#333' : '#888' }}>
                    {ex.assigneeName || 'Unassigned'}
                  </td>
                  <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(ex.createdAt)}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <Link to={`/orgs/${orgId}/exceptions/${ex.id}`}>Open Review &rarr;</Link>
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

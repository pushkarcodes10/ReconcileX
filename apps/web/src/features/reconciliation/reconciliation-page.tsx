import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reconciliationApi } from '../../api/endpoints/reconciliation';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDate, formatDateTime } from '../../shared/lib/date';
import { ReconciliationRunStatus } from '../../api/types';

export const ReconciliationPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { permissions } = useOrg();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReconciliationRunStatus | ''>('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reconciliation-runs', orgId, page, status],
    queryFn: () =>
      reconciliationApi.listRuns(orgId!, {
        page,
        limit: 15,
        status: (status as ReconciliationRunStatus) || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Reconciliation Runs</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Pairwise reconciliation history, exact and potential matching results.
          </p>
        </div>
        {permissions.canRunReconciliation && (
          <Link to={`/orgs/${orgId}/reconciliation/new`}>
            <button style={{ padding: '0.5rem 1rem' }}>+ Start Reconciliation Run</button>
          </Link>
        )}
      </div>

      {/* Filter by Status */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label>
          Status Filter:{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <LoadingState message="Loading reconciliation runs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Reconciliation Runs Found"
          description="Initiate a pairwise reconciliation run to compare two sources."
          action={
            permissions.canRunReconciliation ? (
              <Link to={`/orgs/${orgId}/reconciliation/new`}>
                <button>Start First Run</button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>Run ID</th>
                <th style={{ padding: '0.6rem' }}>Status</th>
                <th style={{ padding: '0.6rem' }}>Date Range</th>
                <th style={{ padding: '0.6rem' }}>Exact Matches</th>
                <th style={{ padding: '0.6rem' }}>Potential</th>
                <th style={{ padding: '0.6rem' }}>Unmatched</th>
                <th style={{ padding: '0.6rem' }}>Created At</th>
                <th style={{ padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <tr key={run.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem' }}>
                    <code>{run.id.slice(0, 8)}...</code>
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <StatusBadge status={run.status} />
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    {formatDate(run.dateFrom)} to {formatDate(run.dateTo)}
                  </td>
                  <td style={{ padding: '0.6rem', color: 'green', fontWeight: 'bold' }}>
                    {run.exactMatchesCount}
                  </td>
                  <td style={{ padding: '0.6rem', color: 'orange', fontWeight: 'bold' }}>
                    {run.potentialMatchesCount}
                  </td>
                  <td style={{ padding: '0.6rem', color: 'red', fontWeight: 'bold' }}>
                    {run.unmatchedCount}
                  </td>
                  <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(run.createdAt)}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <Link to={`/orgs/${orgId}/reconciliation/${run.id}`}>View Details &rarr;</Link>
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

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
import {
  GitCompareIcon,
  PlusIcon,
  ArrowRightIcon,
} from '../../shared/components/icons';

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

  // Compute aggregate statistics for the loaded runs (Reference 2 Bento Summary)
  const totalRuns = data?.total ?? 0;
  const exactTotal = data?.items?.reduce((acc, r) => acc + (r.exactMatchesCount ?? 0), 0) ?? 0;
  const potentialTotal = data?.items?.reduce((acc, r) => acc + (r.potentialMatchesCount ?? 0), 0) ?? 0;
  const unmatchedTotal = data?.items?.reduce((acc, r) => acc + (r.unmatchedCount ?? 0), 0) ?? 0;

  const statusFilters: { label: string; value: ReconciliationRunStatus | '' }[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Processing', value: 'PROCESSING' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Reconciliation Runs
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Pairwise reconciliation history, exact and potential matching results.
          </p>
        </div>
        {permissions.canRunReconciliation && (
          <Link to={`/orgs/${orgId}/reconciliation/new`} className="rx-btn rx-btn-lime">
            <PlusIcon size={16} /> Start Reconciliation Run
          </Link>
        )}
      </div>

      {/* Overview Statistics Cards (Reference 2 Bento) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Total Runs Executed</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>{totalRuns}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Historical pairwise jobs</div>
        </div>

        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Exact Match Volume</div>
          <div className="rx-bento-val" style={{ color: '#0F290D' }}>{exactTotal}</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>100% confidence verified</div>
        </div>

        <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#383204' }}>Potential Matches</div>
          <div className="rx-bento-val" style={{ color: '#383204' }}>{potentialTotal}</div>
          <div style={{ fontSize: '0.75rem', color: '#595009' }}>Requires operator confirmation</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Unmatched Exceptions</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-danger)' }}>{unmatchedTotal}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Queued in exceptions workflow</div>
        </div>
      </div>

      {/* Filter Toolbar (Reference 4) */}
      <div className="rx-card" style={{ padding: '1rem 1.25rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rx-text-secondary)', marginRight: '0.5rem' }}>
            Filter by Status:
          </span>
          {statusFilters.map((pill) => (
            <button
              key={pill.label}
              onClick={() => {
                setStatus(pill.value);
                setPage(1);
              }}
              className={`rx-filter-pill ${status === pill.value ? 'active' : ''}`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Runs History Table (Reference 4) */}
      {isLoading ? (
        <LoadingState message="Loading reconciliation runs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Reconciliation Runs Found"
          description="Initiate a pairwise reconciliation run to compare two sources."
          icon={<GitCompareIcon size={24} />}
          action={
            permissions.canRunReconciliation ? (
              <Link to={`/orgs/${orgId}/reconciliation/new`} className="rx-btn rx-btn-lime">
                Start First Run
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Status</th>
                <th>Reconciliation Window</th>
                <th>Exact Matches</th>
                <th>Potential</th>
                <th>Unmatched</th>
                <th>Initiated At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <tr key={run.id}>
                  <td>
                    <code className="rx-col-code">{run.id.slice(0, 8)}...</code>
                  </td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {formatDate(run.dateFrom)} to {formatDate(run.dateTo)}
                  </td>
                  <td>
                    <span style={{ color: 'var(--rx-success)', fontWeight: 700 }}>
                      {run.exactMatchesCount}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--rx-warning)', fontWeight: 700 }}>
                      {run.potentialMatchesCount}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--rx-danger)', fontWeight: 700 }}>
                      {run.unmatchedCount}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {formatDateTime(run.createdAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/orgs/${orgId}/reconciliation/${run.id}`}
                      className="rx-btn rx-btn-secondary rx-btn-sm"
                      style={{ display: 'inline-flex' }}
                    >
                      View Details <ArrowRightIcon size={13} />
                    </Link>
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

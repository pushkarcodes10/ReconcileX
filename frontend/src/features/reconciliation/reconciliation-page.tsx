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
  LayersIcon,
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

  // Compute aggregate statistics for the loaded runs
  const totalRuns = data?.total ?? 0;
  const exactTotal =
    data?.items?.reduce(
      (acc, r) => acc + (r.fullyMatchedCount ?? r.exactMatchesCount ?? r.exactMatchCount ?? 0),
      0
    ) ?? 0;
  const potentialTotal =
    data?.items?.reduce(
      (acc, r) => acc + (r.potentialMatchesCount ?? r.potentialMatchCount ?? 0),
      0
    ) ?? 0;
  const discrepancyTotal =
    data?.items?.reduce((acc, r) => acc + (r.discrepancyCount ?? 0), 0) ?? 0;
  const unmatchedTotal =
    data?.items?.reduce((acc, r) => acc + (r.unmatchedCount ?? 0), 0) ?? 0;

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
            Native multi-source reconciliation history, transitive matching, and discrepancy investigation.
          </p>
        </div>
        {permissions.canRunReconciliation && (
          <Link to={`/orgs/${orgId}/reconciliation/new`} className="rx-btn rx-btn-lime">
            <PlusIcon size={16} /> Start Reconciliation Run
          </Link>
        )}
      </div>

      {/* Overview Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Total Runs Executed</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>{totalRuns}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Unified & pairwise jobs</div>
        </div>

        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Fully Matched Volume</div>
          <div className="rx-bento-val" style={{ color: '#0F290D' }}>{exactTotal}</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>Cross-source verified</div>
        </div>

        <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#383204' }}>Potential Matches</div>
          <div className="rx-bento-val" style={{ color: '#383204' }}>{potentialTotal}</div>
          <div style={{ fontSize: '0.75rem', color: '#595009' }}>Requires operator review</div>
        </div>

        <div className="rx-bento-card rx-bento-rose" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#7F1D1D' }}>Discrepancies</div>
          <div className="rx-bento-val" style={{ color: '#991B1B' }}>{discrepancyTotal}</div>
          <div style={{ fontSize: '0.75rem', color: '#991B1B' }}>Amount/Date/Missing exceptions</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Unmatched Records</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-danger)' }}>{unmatchedTotal}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Queued in exceptions workflow</div>
        </div>
      </div>

      {/* Filter Toolbar */}
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

      {/* Runs History Table */}
      {isLoading ? (
        <LoadingState message="Loading reconciliation runs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Reconciliation Runs Found"
          description="Initiate a multi-source reconciliation run to evaluate transactions."
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
                <th>Mode</th>
                <th>Status</th>
                <th>Participating Sources</th>
                <th>Date Window</th>
                <th>Full Matches</th>
                <th>Potential</th>
                <th>Discrepancies</th>
                <th>Unmatched</th>
                <th>Initiated At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => {
                const is3Way = run.reconciliationType === 'THREE_SOURCE' || !!run.sourceCId || !!run.sourceC;
                return (
                  <tr key={run.id}>
                    <td>
                      <code className="rx-col-code">{run.id.slice(0, 8)}...</code>
                    </td>
                    <td>
                      {is3Way ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            backgroundColor: '#EAF7EE',
                            color: '#166534',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <LayersIcon size={12} /> 3-Way
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            backgroundColor: 'var(--rx-surface-muted)',
                            color: 'var(--rx-text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Pairwise
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={run.status} />
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}>
                        {run.sourceAName || 'Source A'} vs {run.sourceBName || 'Source B'}
                      </div>
                      {is3Way && (
                        <div style={{ color: 'var(--rx-text-secondary)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                          vs {run.sourceCName || 'Source C (Bank)'}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                      {formatDate(run.dateFrom)} to {formatDate(run.dateTo)}
                    </td>
                    <td>
                      <span style={{ color: 'var(--rx-success)', fontWeight: 700 }}>
                        {run.fullyMatchedCount ?? run.exactMatchesCount ?? run.exactMatchCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--rx-warning)', fontWeight: 700 }}>
                        {run.potentialMatchesCount ?? run.potentialMatchCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: (run.discrepancyCount ?? 0) > 0 ? 'var(--rx-danger)' : 'var(--rx-text-muted)',
                          fontWeight: (run.discrepancyCount ?? 0) > 0 ? 700 : 500,
                        }}
                      >
                        {run.discrepancyCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--rx-danger)', fontWeight: 700 }}>
                        {run.unmatchedCount ?? 0}
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
                );
              })}
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

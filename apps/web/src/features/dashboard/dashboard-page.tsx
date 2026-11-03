import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../api/endpoints/dashboard';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatDateTime } from '../../shared/lib/date';
import {
  RefreshIcon,
  CalendarIcon,
  ArrowRightIcon,
  AlertOctagonIcon,
  GitCompareIcon,
  UserIcon,
} from '../../shared/components/icons';

export const DashboardPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. Dashboard Summary Query
  const summaryQuery = useQuery({
    queryKey: ['dashboard', orgId, 'summary'],
    queryFn: () => dashboardApi.getSummary(orgId!),
    enabled: !!orgId,
  });

  // 2. Reconciliation Overview Query (with optional date range)
  const reconciliationQuery = useQuery({
    queryKey: ['dashboard', orgId, 'reconciliation', startDate, endDate],
    queryFn: () =>
      dashboardApi.getReconciliation(orgId!, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: !!orgId,
  });

  // 3. Exceptions Overview Query
  const exceptionsQuery = useQuery({
    queryKey: ['dashboard', orgId, 'exceptions'],
    queryFn: () => dashboardApi.getExceptions(orgId!),
    enabled: !!orgId,
  });

  // 4. Activity Query
  const activityQuery = useQuery({
    queryKey: ['dashboard', orgId, 'activity'],
    queryFn: () => dashboardApi.getActivity(orgId!, { limit: 10 }),
    enabled: !!orgId,
  });

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
  };

  if (!orgId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page Title & Actions Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Organization Dashboard
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            High-level metrics, reconciliation health, and exception status.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={handleRefreshAll} className="rx-btn rx-btn-secondary rx-btn-sm">
            <RefreshIcon size={14} /> Refresh Dashboard
          </button>
          <Link to={`/orgs/${orgId}/reconciliation/new`} className="rx-btn rx-btn-lime rx-btn-sm">
            + Start Run
          </Link>
        </div>
      </div>

      {/* 1. Global Metrics Summary - Reference 2 Bento Layout */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Summary Overview</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            REAL-TIME DATA
          </span>
        </div>

        {summaryQuery.isLoading ? (
          <LoadingState message="Loading summary metrics..." />
        ) : summaryQuery.isError ? (
          <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
        ) : summaryQuery.data ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Total Transactions (Bento Dark Card) */}
            <div className="rx-bento-card rx-bento-dark">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: '#D4D8CF' }}>Total Transactions</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 'var(--rx-radius-sm)', backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem', color: '#FFF' }}>
                  All Sources
                </span>
              </div>
              <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>
                {summaryQuery.data.totalTransactions}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>
                Ingested financial records across internal & bank feeds
              </div>
            </div>

            {/* Matched Transactions (Bento Sage Green Card) */}
            <div className="rx-bento-card rx-bento-sage">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: '#1A2917' }}>Matched Transactions</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 'var(--rx-radius-sm)', backgroundColor: 'rgba(0,0,0,0.08)', fontSize: '0.7rem', fontWeight: 700 }}>
                  Reconciled
                </span>
              </div>
              <div className="rx-bento-val" style={{ color: '#0F290D' }}>
                {summaryQuery.data.totalMatchedTransactions}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#2B4228', fontWeight: 500 }}>
                Exact match confidence verified
              </div>
            </div>

            {/* Potential Matches (Bento Pale Yellow Card) */}
            <div className="rx-bento-card rx-bento-yellow">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: '#383204' }}>Potential Matches</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 'var(--rx-radius-sm)', backgroundColor: 'rgba(0,0,0,0.08)', fontSize: '0.7rem', fontWeight: 700 }}>
                  Review
                </span>
              </div>
              <div className="rx-bento-val" style={{ color: '#383204' }}>
                {summaryQuery.data.totalPotentialMatches}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#595009', fontWeight: 500 }}>
                Awaiting analyst confirmation
              </div>
            </div>

            {/* Unmatched Transactions (Bento Muted Blue Card) */}
            <div className="rx-bento-card rx-bento-blue">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: '#13283E' }}>Unmatched Transactions</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 'var(--rx-radius-sm)', backgroundColor: 'rgba(0,0,0,0.08)', fontSize: '0.7rem', fontWeight: 700 }}>
                  Discrepancy
                </span>
              </div>
              <div className="rx-bento-val" style={{ color: '#0E2238' }}>
                {summaryQuery.data.totalUnmatchedTransactions}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1E3C5C', fontWeight: 500 }}>
                Exceptions queued for investigation
              </div>
            </div>

            {/* Reconciliation Runs Metric */}
            <div className="rx-bento-card rx-bento-white">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: 'var(--rx-text-secondary)' }}>Reconciliation Runs</span>
                <GitCompareIcon size={16} style={{ color: 'var(--rx-text-muted)' }} />
              </div>
              <div className="rx-bento-val" style={{ color: 'var(--rx-text-primary)' }}>
                {summaryQuery.data.totalReconciliationRuns}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--rx-success)', fontWeight: 600 }}>Completed: {summaryQuery.data.completedRuns}</span>
                <span>•</span>
                <span style={{ color: 'var(--rx-warning)', fontWeight: 600 }}>Running: {summaryQuery.data.runningRuns}</span>
                <span>•</span>
                <span style={{ color: 'var(--rx-danger)', fontWeight: 600 }}>Failed: {summaryQuery.data.failedRuns}</span>
              </div>
            </div>

            {/* Open Exceptions Metric */}
            <div className="rx-bento-card rx-bento-white">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-bento-label" style={{ color: 'var(--rx-text-secondary)' }}>Open Exceptions</span>
                <AlertOctagonIcon size={16} style={{ color: 'var(--rx-danger)' }} />
              </div>
              <div className="rx-bento-val" style={{ color: 'var(--rx-danger)' }}>
                {summaryQuery.data.totalOpenExceptions}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span>Review: <strong>{summaryQuery.data.totalExceptionsUnderReview}</strong></span>
                <span>•</span>
                <span>Escalated: <strong>{summaryQuery.data.totalEscalatedExceptions}</strong></span>
                <span>•</span>
                <span>Resolved: <strong>{summaryQuery.data.totalResolvedExceptions}</strong></span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* 2. Reconciliation Overview with Date Filtering - Reference 4 Table */}
      <section className="rx-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Reconciliation Overview</h2>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.85rem' }}>
              Pairwise match distribution and recent execution history.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--rx-surface-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
              <CalendarIcon size={14} style={{ color: 'var(--rx-text-muted)' }} />
              <label style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--rx-surface-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
              <CalendarIcon size={14} style={{ color: 'var(--rx-text-muted)' }} />
              <label style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none' }}
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="rx-btn rx-btn-ghost rx-btn-sm"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {reconciliationQuery.isLoading ? (
          <LoadingState message="Loading reconciliation metrics..." />
        ) : reconciliationQuery.isError ? (
          <ErrorState error={reconciliationQuery.error} onRetry={() => reconciliationQuery.refetch()} />
        ) : reconciliationQuery.data ? (
          <div>
            {/* Match Counts Pill Bar */}
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                padding: '0.85rem 1.25rem',
                backgroundColor: 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-md)',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                fontSize: '0.85rem',
                border: '1px solid var(--rx-border)',
              }}
            >
              <div>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Total Runs: </span>
                <strong style={{ color: 'var(--rx-text-primary)' }}>{reconciliationQuery.data.totalRuns}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Exact Matches: </span>
                <strong style={{ color: 'var(--rx-success)' }}>{reconciliationQuery.data.matchCounts?.exact ?? 0}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Potential: </span>
                <strong style={{ color: 'var(--rx-warning)' }}>{reconciliationQuery.data.matchCounts?.potential ?? 0}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Confirmed: </span>
                <strong style={{ color: '#0369A1' }}>{reconciliationQuery.data.matchCounts?.confirmed ?? 0}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Rejected: </span>
                <strong style={{ color: 'var(--rx-danger)' }}>{reconciliationQuery.data.matchCounts?.rejected ?? 0}</strong>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Recent Reconciliation Runs</h3>
            {reconciliationQuery.data.recentRuns && reconciliationQuery.data.recentRuns.length > 0 ? (
              <div className="rx-table-container">
                <table className="rx-table">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Status</th>
                      <th>Date Range</th>
                      <th>Matches Breakdown</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationQuery.data.recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <code className="rx-col-code">{run.id.slice(0, 8)}...</code>
                        </td>
                        <td>
                          <StatusBadge status={run.status} />
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {run.dateFrom?.slice(0, 10)} to {run.dateTo?.slice(0, 10)}
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--rx-success)', fontWeight: 600 }}>Exact: {run.exactMatchesCount ?? 0}</span>
                          {' '}|{' '}
                          <span style={{ color: 'var(--rx-warning)', fontWeight: 600 }}>Potential: {run.potentialMatchesCount ?? 0}</span>
                          {' '}|{' '}
                          <span style={{ color: 'var(--rx-danger)', fontWeight: 600 }}>Unmatched: {run.unmatchedCount ?? 0}</span>
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
              </div>
            ) : (
              <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>No recent reconciliation runs recorded.</p>
            )}
          </div>
        ) : null}
      </section>

      {/* 3. Lower Grid: Exceptions Breakdown + Activity Feed (Reference 1 3-column composition) */}
      <div className="rx-split-2">
        {/* Exceptions Breakdown Card */}
        <section className="rx-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Exceptions Breakdown</h2>
            <Link to={`/orgs/${orgId}/exceptions`} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--rx-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Open Queue <ArrowRightIcon size={12} />
            </Link>
          </div>

          {exceptionsQuery.isLoading ? (
            <LoadingState message="Loading exceptions overview..." />
          ) : exceptionsQuery.isError ? (
            <ErrorState error={exceptionsQuery.error} onRetry={() => exceptionsQuery.refetch()} />
          ) : exceptionsQuery.data ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Unassigned</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--rx-text-primary)' }}>
                    {exceptionsQuery.data.unassignedCount ?? 0}
                  </div>
                </div>

                {exceptionsQuery.data.byStatus &&
                  Object.entries(exceptionsQuery.data.byStatus).map(([status, count]) => (
                    <div key={status} style={{ padding: '0.75rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{status}</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--rx-text-primary)' }}>
                        {count}
                      </div>
                    </div>
                  ))}
              </div>

              {exceptionsQuery.data.byAssignee && exceptionsQuery.data.byAssignee.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rx-text-secondary)', marginBottom: '0.5rem' }}>
                    Workload by Assignee
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {exceptionsQuery.data.byAssignee.map((item) => (
                      <li
                        key={item.assigneeId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--rx-surface-subtle)',
                          borderRadius: 'var(--rx-radius-md)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <UserIcon size={14} style={{ color: 'var(--rx-text-muted)' }} />
                          <span style={{ fontWeight: 600 }}>{item.assigneeName}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--rx-text-primary)' }}>
                          {item.count} open
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Recent Audit Activity Panel (Reference 1 Activities Panel) */}
        <section className="rx-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Recent Audit Activity</h2>
            <Link to={`/orgs/${orgId}/audit`} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--rx-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Full Trail <ArrowRightIcon size={12} />
            </Link>
          </div>

          {activityQuery.isLoading ? (
            <LoadingState message="Loading activity feed..." />
          ) : activityQuery.isError ? (
            <ErrorState error={activityQuery.error} onRetry={() => activityQuery.refetch()} />
          ) : activityQuery.data && activityQuery.data.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {activityQuery.data.items.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--rx-surface-subtle)',
                    borderRadius: 'var(--rx-radius-md)',
                    border: '1px solid var(--rx-border-subtle)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--rx-text-primary)' }}>
                      {log.action}
                    </div>
                    <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.15rem', fontSize: '0.75rem' }}>
                      on <code style={{ backgroundColor: 'var(--rx-surface-muted)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{log.entityType}</code>
                      {log.actor && <span> by <strong>{log.actor.name || log.actor.email}</strong></span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>No recent activity logged.</p>
          )}
        </section>
      </div>
    </div>
  );
};

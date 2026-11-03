import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../api/endpoints/dashboard';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatDateTime } from '../../shared/lib/date';

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Organization Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            High-level metrics, reconciliation health, and exception status.
          </p>
        </div>
        <button onClick={handleRefreshAll} style={{ padding: '0.5rem 1rem' }}>
          Refresh Dashboard
        </button>
      </div>

      {/* 1. Global Metrics Summary */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Summary Overview</h2>
        {summaryQuery.isLoading ? (
          <LoadingState message="Loading summary metrics..." />
        ) : summaryQuery.isError ? (
          <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
        ) : summaryQuery.data ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Total Transactions</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{summaryQuery.data.totalTransactions}</div>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Matched Transactions</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'green' }}>
                {summaryQuery.data.totalMatchedTransactions}
              </div>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Potential Matches</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'orange' }}>
                {summaryQuery.data.totalPotentialMatches}
              </div>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Unmatched Transactions</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'red' }}>
                {summaryQuery.data.totalUnmatchedTransactions}
              </div>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Reconciliation Runs</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
                {summaryQuery.data.totalReconciliationRuns}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                Completed: {summaryQuery.data.completedRuns} | Running: {summaryQuery.data.runningRuns} | Failed:{' '}
                {summaryQuery.data.failedRuns}
              </div>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Open Exceptions</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#c00' }}>
                {summaryQuery.data.totalOpenExceptions}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                Review: {summaryQuery.data.totalExceptionsUnderReview} | Escalated:{' '}
                {summaryQuery.data.totalEscalatedExceptions} | Resolved: {summaryQuery.data.totalResolvedExceptions}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* 2. Reconciliation Overview with Date Filtering */}
      <section style={{ marginBottom: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Reconciliation Overview</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label>
              From:{' '}
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              To:{' '}
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
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
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
              <div>
                <strong>Total Runs:</strong> {reconciliationQuery.data.totalRuns}
              </div>
              <div>
                <strong>Exact Matches:</strong> {reconciliationQuery.data.matchCounts?.exact ?? 0}
              </div>
              <div>
                <strong>Potential:</strong> {reconciliationQuery.data.matchCounts?.potential ?? 0}
              </div>
              <div>
                <strong>Confirmed:</strong> {reconciliationQuery.data.matchCounts?.confirmed ?? 0}
              </div>
              <div>
                <strong>Rejected:</strong> {reconciliationQuery.data.matchCounts?.rejected ?? 0}
              </div>
            </div>

            <h3>Recent Reconciliation Runs</h3>
            {reconciliationQuery.data.recentRuns && reconciliationQuery.data.recentRuns.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.5rem' }}>Run ID</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Date Range</th>
                    <th style={{ padding: '0.5rem' }}>Matches</th>
                    <th style={{ padding: '0.5rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationQuery.data.recentRuns.map((run) => (
                    <tr key={run.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <code>{run.id.slice(0, 8)}...</code>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <StatusBadge status={run.status} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {run.dateFrom?.slice(0, 10)} to {run.dateTo?.slice(0, 10)}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        Exact: {run.exactMatchesCount ?? 0} | Potential: {run.potentialMatchesCount ?? 0} | Unmatched:{' '}
                        {run.unmatchedCount ?? 0}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <Link to={`/orgs/${orgId}/reconciliation/${run.id}`}>View Details &rarr;</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#666' }}>No recent reconciliation runs recorded.</p>
            )}
          </div>
        ) : null}
      </section>

      {/* 3. Exceptions Breakdown */}
      <section style={{ marginBottom: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <h2>Exceptions Breakdown</h2>
        {exceptionsQuery.isLoading ? (
          <LoadingState message="Loading exceptions overview..." />
        ) : exceptionsQuery.isError ? (
          <ErrorState error={exceptionsQuery.error} onRetry={() => exceptionsQuery.refetch()} />
        ) : exceptionsQuery.data ? (
          <div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
              <div>
                <strong>Unassigned:</strong> {exceptionsQuery.data.unassignedCount ?? 0}
              </div>
              {exceptionsQuery.data.byStatus &&
                Object.entries(exceptionsQuery.data.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <strong>{status}:</strong> {count}
                  </div>
                ))}
            </div>

            {exceptionsQuery.data.byAssignee && exceptionsQuery.data.byAssignee.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4>Workload by Assignee</h4>
                <ul>
                  {exceptionsQuery.data.byAssignee.map((item) => (
                    <li key={item.assigneeId}>
                      {item.assigneeName}: <strong>{item.count}</strong> open exceptions
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <Link to={`/orgs/${orgId}/exceptions`}>Open Exceptions Management &rarr;</Link>
            </div>
          </div>
        ) : null}
      </section>

      {/* 4. Recent Activity Feed */}
      <section style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <h2>Recent Audit Activity</h2>
        {activityQuery.isLoading ? (
          <LoadingState message="Loading activity feed..." />
        ) : activityQuery.isError ? (
          <ErrorState error={activityQuery.error} onRetry={() => activityQuery.refetch()} />
        ) : activityQuery.data && activityQuery.data.items.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {activityQuery.data.items.map((log) => (
              <li key={log.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#666', marginRight: '0.75rem' }}>
                  {formatDateTime(log.createdAt)}
                </span>
                <strong>{log.action}</strong> on <code>{log.entityType}</code>
                {log.actor && (
                  <span style={{ marginLeft: '0.5rem', color: '#555' }}>
                    by {log.actor.name || log.actor.email}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#666' }}>No recent activity logged.</p>
        )}
      </section>
    </div>
  );
};

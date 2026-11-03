import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationApi } from '../../api/endpoints/reconciliation';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDate, formatDateTime } from '../../shared/lib/date';
import { ApiError } from '../../api/errors';

export const ReconciliationDetailPage: React.FC = () => {
  const { orgId, runId } = useParams<{ orgId: string; runId: string }>();
  const { permissions } = useOrg();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'exact' | 'potential' | 'unmatched'>('exact');
  const [matchesPage, setMatchesPage] = useState(1);
  const [unmatchedPage, setUnmatchedPage] = useState(1);
  const [rejectingMatchId, setRejectingMatchId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Run Header & Counters with Polling if PROCESSING
  const { data: run, isLoading: runLoading, error: runError, refetch } = useQuery({
    queryKey: ['reconciliation-run', orgId, runId],
    queryFn: () => reconciliationApi.getRunById(orgId!, runId!),
    enabled: !!orgId && !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  // 2. Fetch Exact Matches
  const { data: exactMatches, isLoading: exactLoading } = useQuery({
    queryKey: ['reconciliation-matches', orgId, runId, 'EXACT', matchesPage],
    queryFn: () =>
      reconciliationApi.getMatches(orgId!, runId!, {
        classification: 'EXACT',
        page: matchesPage,
        limit: 15,
      }),
    enabled: !!orgId && !!runId && activeTab === 'exact',
  });

  // 3. Fetch Potential Matches
  const { data: potentialMatches, isLoading: potentialLoading } = useQuery({
    queryKey: ['reconciliation-matches', orgId, runId, 'POTENTIAL', matchesPage],
    queryFn: () =>
      reconciliationApi.getMatches(orgId!, runId!, {
        classification: 'POTENTIAL',
        page: matchesPage,
        limit: 15,
      }),
    enabled: !!orgId && !!runId && activeTab === 'potential',
  });

  // 4. Fetch Unmatched Transactions
  const { data: unmatchedData, isLoading: unmatchedLoading } = useQuery({
    queryKey: ['reconciliation-unmatched', orgId, runId, unmatchedPage],
    queryFn: () =>
      reconciliationApi.getUnmatched(orgId!, runId!, {
        page: unmatchedPage,
        limit: 15,
      }),
    enabled: !!orgId && !!runId && activeTab === 'unmatched',
  });

  // Confirm Potential Match Mutation
  const confirmMutation = useMutation({
    mutationFn: (matchId: string) => reconciliationApi.confirmMatch(orgId!, matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-matches', orgId, runId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-run', orgId, runId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to confirm match.');
    },
  });

  // Reject Potential Match Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ matchId, reason }: { matchId: string; reason?: string }) =>
      reconciliationApi.rejectMatch(orgId!, matchId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-matches', orgId, runId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-run', orgId, runId] });
      queryClient.invalidateQueries({ queryKey: ['exceptions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      setRejectingMatchId(null);
      setRejectReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to reject match.');
    },
  });

  if (runLoading) return <LoadingState message="Loading reconciliation run..." />;
  if (runError) return <ErrorState error={runError} onRetry={() => refetch()} />;
  if (!run) return <p>Reconciliation run not found.</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/reconciliation`}>&larr; Back to Reconciliation Runs</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Reconciliation Run #{run.id.slice(0, 8)}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            Date Range: {formatDate(run.dateFrom)} to {formatDate(run.dateTo)} | Status:{' '}
            <StatusBadge status={run.status} /> | Initiated: {formatDateTime(run.createdAt)}
          </div>
        </div>
      </div>

      {actionError && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Counters Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Exact Matches</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'green' }}>
            {run.exactMatchesCount}
          </div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Potential Matches</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'orange' }}>
            {run.potentialMatchesCount}
          </div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Unmatched (Exceptions)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'red' }}>
            {run.unmatchedCount}
          </div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Source A Volume</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{run.totalTransactionsA}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Source B Volume</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{run.totalTransactionsB}</div>
        </div>
      </div>

      {/* Match Results Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1.5rem' }}>
        <button
          onClick={() => {
            setActiveTab('exact');
            setMatchesPage(1);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderBottom: activeTab === 'exact' ? '3px solid black' : 'none',
            fontWeight: activeTab === 'exact' ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Exact Matches ({run.exactMatchesCount})
        </button>
        <button
          onClick={() => {
            setActiveTab('potential');
            setMatchesPage(1);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderBottom: activeTab === 'potential' ? '3px solid black' : 'none',
            fontWeight: activeTab === 'potential' ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Potential Matches ({run.potentialMatchesCount})
        </button>
        <button
          onClick={() => {
            setActiveTab('unmatched');
            setUnmatchedPage(1);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderBottom: activeTab === 'unmatched' ? '3px solid black' : 'none',
            fontWeight: activeTab === 'unmatched' ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Unmatched Transactions ({run.unmatchedCount})
        </button>
      </div>

      {/* Reject Modal / Input Dialog */}
      {rejectingMatchId && (
        <div style={{ border: '1px solid #c00', padding: '1rem', marginBottom: '1.5rem', backgroundColor: '#fff5f5' }}>
          <h4>Reject Potential Match</h4>
          <p style={{ fontSize: '0.9rem' }}>
            Provide an optional reason for rejection. Rejecting this match will automatically flag the transaction as an OPEN exception.
          </p>
          <textarea
            maxLength={1000}
            rows={3}
            placeholder="Reason for rejecting this match (optional, max 1000 characters)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() =>
                rejectMutation.mutate({ matchId: rejectingMatchId, reason: rejectReason.trim() || undefined })
              }
              disabled={rejectMutation.isPending}
              style={{ color: 'red' }}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
            <button onClick={() => setRejectingMatchId(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tab Content: Exact Matches */}
      {activeTab === 'exact' && (
        <div>
          {exactLoading ? (
            <LoadingState message="Loading exact matches..." />
          ) : !exactMatches || exactMatches.items.length === 0 ? (
            <EmptyState title="No Exact Matches" description="No exact matches found for this run." />
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.6rem' }}>Score</th>
                    <th style={{ padding: '0.6rem' }}>Transaction A (External ID / Amount)</th>
                    <th style={{ padding: '0.6rem' }}>Transaction B (External ID / Amount)</th>
                    <th style={{ padding: '0.6rem' }}>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {exactMatches.items.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold', color: 'green' }}>{m.score}%</td>
                      <td style={{ padding: '0.6rem' }}>
                        <code>{m.transactionA?.externalId}</code> ({formatAmountMinor(m.transactionA?.amountMinor, m.transactionA?.currency)})
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <code>{m.transactionB?.externalId}</code> ({formatAmountMinor(m.transactionB?.amountMinor, m.transactionB?.currency)})
                      </td>
                      <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{m.reasons?.join(', ') || 'Exact match'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={matchesPage}
                totalPages={exactMatches.totalPages}
                total={exactMatches.total}
                limit={exactMatches.limit}
                onPageChange={setMatchesPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Potential Matches */}
      {activeTab === 'potential' && (
        <div>
          {potentialLoading ? (
            <LoadingState message="Loading potential matches..." />
          ) : !potentialMatches || potentialMatches.items.length === 0 ? (
            <EmptyState title="No Potential Matches" description="No potential matches requiring manual review." />
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.6rem' }}>Score</th>
                    <th style={{ padding: '0.6rem' }}>Status</th>
                    <th style={{ padding: '0.6rem' }}>Transaction A</th>
                    <th style={{ padding: '0.6rem' }}>Transaction B</th>
                    <th style={{ padding: '0.6rem' }}>Explainability Reasons</th>
                    <th style={{ padding: '0.6rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {potentialMatches.items.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold', color: 'orange' }}>{m.score}%</td>
                      <td style={{ padding: '0.6rem' }}>
                        <StatusBadge status={m.status} />
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <code>{m.transactionA?.externalId}</code> (
                        {formatAmountMinor(m.transactionA?.amountMinor, m.transactionA?.currency)})
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <code>{m.transactionB?.externalId}</code> (
                        {formatAmountMinor(m.transactionB?.amountMinor, m.transactionB?.currency)})
                      </td>
                      <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{m.reasons?.join(', ') || '—'}</td>
                      <td style={{ padding: '0.6rem' }}>
                        {m.status === 'PENDING' && permissions.canConfirmRejectMatches ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => confirmMutation.mutate(m.id)}
                              disabled={confirmMutation.isPending}
                              style={{ color: 'green' }}
                            >
                              Confirm
                            </button>
                            <button onClick={() => setRejectingMatchId(m.id)} style={{ color: 'red' }}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#888', fontSize: '0.85rem' }}>
                            {m.status !== 'PENDING' ? m.status : 'Read-only'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={matchesPage}
                totalPages={potentialMatches.totalPages}
                total={potentialMatches.total}
                limit={potentialMatches.limit}
                onPageChange={setMatchesPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Unmatched Transactions */}
      {activeTab === 'unmatched' && (
        <div>
          {unmatchedLoading ? (
            <LoadingState message="Loading unmatched transactions..." />
          ) : !unmatchedData || unmatchedData.items.length === 0 ? (
            <EmptyState title="No Unmatched Transactions" description="All transactions in this run were matched." />
          ) : (
            <div>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Unmatched transactions automatically generate OPEN exceptions requiring operator assignment and review.
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.6rem' }}>External ID</th>
                    <th style={{ padding: '0.6rem' }}>Amount</th>
                    <th style={{ padding: '0.6rem' }}>Date</th>
                    <th style={{ padding: '0.6rem' }}>Status</th>
                    <th style={{ padding: '0.6rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedData.items.map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.6rem' }}><code>{txn.externalId}</code></td>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>
                        {formatAmountMinor(txn.amountMinor, txn.currency)}
                      </td>
                      <td style={{ padding: '0.6rem' }}>{formatDate(txn.transactionDate)}</td>
                      <td style={{ padding: '0.6rem' }}><StatusBadge status={txn.status} /></td>
                      <td style={{ padding: '0.6rem' }}>
                        <Link to={`/orgs/${orgId}/exceptions?runId=${runId}&q=${txn.externalId}`}>
                          View Exception &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={unmatchedPage}
                totalPages={unmatchedData.totalPages}
                total={unmatchedData.total}
                limit={unmatchedData.limit}
                onPageChange={setUnmatchedPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

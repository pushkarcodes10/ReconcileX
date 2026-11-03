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
import {
  ArrowLeftIcon,
  GitCompareIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  AlertOctagonIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
} from '../../shared/components/icons';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/reconciliation`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Reconciliation Runs
        </Link>
      </div>

      {/* Header (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <GitCompareIcon size={20} style={{ color: 'var(--rx-text-primary)' }} />
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Reconciliation Run #{run.id.slice(0, 8)}
              </h1>
            </div>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.4rem', fontSize: '0.85rem' }}>
              Reconciliation Window: <strong>{formatDate(run.dateFrom)}</strong> to{' '}
              <strong>{formatDate(run.dateTo)}</strong> | Initiated: {formatDateTime(run.createdAt)}
            </div>
          </div>
          <div>
            <StatusBadge status={run.status} />
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--rx-danger-bg)',
            border: '1px solid var(--rx-danger-border)',
            borderRadius: 'var(--rx-radius-md)',
            color: 'var(--rx-danger)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
          <div><strong>Error:</strong> {actionError}</div>
        </div>
      )}

      {/* Counters Breakdown (Reference 2 Bento Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Exact Matches</div>
          <div className="rx-bento-val" style={{ color: '#0F290D' }}>{run.exactMatchesCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>100% confidence parity</div>
        </div>

        <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#383204' }}>Potential Matches</div>
          <div className="rx-bento-val" style={{ color: '#383204' }}>{run.potentialMatchesCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#595009' }}>Requiring human sign-off</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Unmatched (Exceptions)</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-danger)' }}>{run.unmatchedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Auto-flagged to queue</div>
        </div>

        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Source A Volume</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>{run.totalTransactionsA}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Records evaluated</div>
        </div>

        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Source B Volume</div>
          <div className="rx-bento-val" style={{ color: '#FFFFFF' }}>{run.totalTransactionsB}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Records evaluated</div>
        </div>
      </div>

      {/* Styled Tabs (Reference 4) */}
      <div className="rx-tabs">
        <button
          onClick={() => {
            setActiveTab('exact');
            setMatchesPage(1);
          }}
          className={`rx-tab-btn ${activeTab === 'exact' ? 'active' : ''}`}
        >
          <CheckCircleIcon size={16} />
          <span>Exact Matches</span>
          <span className="rx-tab-counter">{run.exactMatchesCount}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('potential');
            setMatchesPage(1);
          }}
          className={`rx-tab-btn ${activeTab === 'potential' ? 'active' : ''}`}
        >
          <AlertCircleIcon size={16} />
          <span>Potential Matches (Review)</span>
          <span className="rx-tab-counter">{run.potentialMatchesCount}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('unmatched');
            setUnmatchedPage(1);
          }}
          className={`rx-tab-btn ${activeTab === 'unmatched' ? 'active' : ''}`}
        >
          <AlertOctagonIcon size={16} />
          <span>Unmatched Transactions</span>
          <span className="rx-tab-counter">{run.unmatchedCount}</span>
        </button>
      </div>

      {/* Reject Potential Match Modal Dialog */}
      {rejectingMatchId && (
        <div className="rx-modal-overlay">
          <div className="rx-modal-card rx-animate-fade-in" style={{ border: '1px solid var(--rx-danger-border)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--rx-danger)', fontSize: '1.2rem', fontWeight: 800 }}>
              Reject Potential Match
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', marginBottom: '1rem' }}>
              Provide an optional reason for rejection. Rejecting this match will automatically flag the transaction as an OPEN exception in the review queue.
            </p>
            <textarea
              maxLength={1000}
              rows={3}
              placeholder="Reason for rejecting this match (optional, max 1000 characters)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rx-textarea"
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectingMatchId(null)} className="rx-btn rx-btn-secondary">
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({ matchId: rejectingMatchId, reason: rejectReason.trim() || undefined })
                }
                disabled={rejectMutation.isPending}
                className="rx-btn rx-btn-danger"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Exact Matches (Reference 4) */}
      {activeTab === 'exact' && (
        <div>
          {exactLoading ? (
            <LoadingState message="Loading exact matches..." />
          ) : !exactMatches || exactMatches.items.length === 0 ? (
            <EmptyState title="No Exact Matches" description="No exact matches found for this reconciliation run." />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Confidence</th>
                    <th>Transaction A (Ledger)</th>
                    <th>Transaction B (Settlement)</th>
                    <th>Matching Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {exactMatches.items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--rx-radius-full)',
                            backgroundColor: '#EAF7EE',
                            color: 'var(--rx-success)',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                          }}
                        >
                          {m.score}%
                        </span>
                      </td>
                      <td>
                        <div>
                          <code className="rx-col-code" style={{ fontWeight: 600 }}>{m.transactionA?.externalId}</code>
                          <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.15rem' }}>
                            Amount: <strong>{formatAmountMinor(m.transactionA?.amountMinor, m.transactionA?.currency)}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <code className="rx-col-code" style={{ fontWeight: 600 }}>{m.transactionB?.externalId}</code>
                          <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.15rem' }}>
                            Amount: <strong>{formatAmountMinor(m.transactionB?.amountMinor, m.transactionB?.currency)}</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {m.reasons?.join(', ') || 'Exact reference and amount parity'}
                      </td>
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

      {/* Tab Content: Potential Matches (Reference 4 + Side-by-side comparison) */}
      {activeTab === 'potential' && (
        <div>
          {potentialLoading ? (
            <LoadingState message="Loading potential matches..." />
          ) : !potentialMatches || potentialMatches.items.length === 0 ? (
            <EmptyState title="No Potential Matches" description="No potential matches requiring manual operator review." />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Transaction A (Source A)</th>
                    <th>Transaction B (Source B)</th>
                    <th>Explainability Reasons</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {potentialMatches.items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--rx-radius-full)',
                            backgroundColor: '#FEF9E6',
                            color: '#A16207',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                          }}
                        >
                          {m.score}%
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={m.status} />
                      </td>
                      <td>
                        <div>
                          <code className="rx-col-code">{m.transactionA?.externalId}</code>
                          <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)' }}>
                            {formatAmountMinor(m.transactionA?.amountMinor, m.transactionA?.currency)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <code className="rx-col-code">{m.transactionB?.externalId}</code>
                          <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)' }}>
                            {formatAmountMinor(m.transactionB?.amountMinor, m.transactionB?.currency)}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {m.reasons?.join(', ') || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.status === 'PENDING' && permissions.canConfirmRejectMatches ? (
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => confirmMutation.mutate(m.id)}
                              disabled={confirmMutation.isPending}
                              className="rx-btn rx-btn-success rx-btn-sm"
                            >
                              <CheckIcon size={12} /> Confirm
                            </button>
                            <button
                              onClick={() => setRejectingMatchId(m.id)}
                              className="rx-btn rx-btn-danger rx-btn-sm"
                            >
                              <XIcon size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--rx-text-muted)', fontSize: '0.8125rem' }}>
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

      {/* Tab Content: Unmatched Transactions (Reference 4) */}
      {activeTab === 'unmatched' && (
        <div>
          {unmatchedLoading ? (
            <LoadingState message="Loading unmatched transactions..." />
          ) : !unmatchedData || unmatchedData.items.length === 0 ? (
            <EmptyState title="No Unmatched Transactions" description="All transactions in this reconciliation run were matched." />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>External ID</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Transaction Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedData.items.map((txn) => (
                    <tr key={txn.id}>
                      <td><code className="rx-col-code">{txn.externalId}</code></td>
                      <td className="rx-col-amount" style={{ color: 'var(--rx-text-primary)' }}>
                        {formatAmountMinor(txn.amountMinor, txn.currency)}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {formatDate(txn.transactionDate)}
                      </td>
                      <td><StatusBadge status={txn.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/orgs/${orgId}/exceptions?runId=${runId}&q=${txn.externalId}`}
                          className="rx-btn rx-btn-secondary rx-btn-sm"
                          style={{ display: 'inline-flex' }}
                        >
                          View Exception <ArrowRightIcon size={13} />
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

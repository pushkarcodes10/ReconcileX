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
import { formatReasons } from '../../shared/lib/format-reasons';
import { ApiError } from '../../api/errors';
import { MatchRecord } from '../../api/types';
import {
  ArrowLeftIcon,
  GitCompareIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  AlertOctagonIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
  LayersIcon,
} from '../../shared/components/icons';

type ThreeWayTab = 'all' | 'fully_matched' | 'partially_matched' | 'discrepancy' | 'potential' | 'unmatched';
type TwoWayTab = 'exact' | 'potential' | 'unmatched';

export const ReconciliationDetailPage: React.FC = () => {
  const { orgId, runId } = useParams<{ orgId: string; runId: string }>();
  const { permissions } = useOrg();
  const queryClient = useQueryClient();

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

  const isThreeSource =
    run?.reconciliationType === 'THREE_SOURCE' || !!run?.sourceCId || !!run?.sourceC;

  const [active3WayTab, setActive3WayTab] = useState<ThreeWayTab>('all');
  const [active2WayTab, setActive2WayTab] = useState<TwoWayTab>('exact');
  const [matchesPage, setMatchesPage] = useState(1);
  const [unmatchedPage, setUnmatchedPage] = useState(1);
  const [rejectingMatchId, setRejectingMatchId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 2. Fetch Matches according to selected tab
  const getClassificationForQuery = (): any => {
    if (isThreeSource) {
      if (active3WayTab === 'fully_matched') return 'FULLY_MATCHED';
      if (active3WayTab === 'partially_matched') return 'PARTIALLY_MATCHED';
      if (active3WayTab === 'discrepancy') return undefined; // Filter in UI for discrepancies (amount/date/reference)
      if (active3WayTab === 'potential') return 'POTENTIAL_MATCH';
      return undefined; // 'all'
    } else {
      if (active2WayTab === 'exact') return 'EXACT';
      if (active2WayTab === 'potential') return 'POTENTIAL';
      return undefined;
    }
  };

  const isMatchesTab = isThreeSource
    ? active3WayTab !== 'unmatched'
    : active2WayTab !== 'unmatched';

  const classificationQuery = getClassificationForQuery();

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: [
      'reconciliation-matches',
      orgId,
      runId,
      isThreeSource ? active3WayTab : active2WayTab,
      classificationQuery,
      matchesPage,
    ],
    queryFn: () =>
      reconciliationApi.getMatches(orgId!, runId!, {
        classification: classificationQuery,
        page: matchesPage,
        limit: 15,
      }),
    enabled: !!orgId && !!runId && isMatchesTab,
  });

  // 3. Fetch Unmatched Transactions
  const { data: unmatchedData, isLoading: unmatchedLoading } = useQuery({
    queryKey: ['reconciliation-unmatched', orgId, runId, unmatchedPage],
    queryFn: () =>
      reconciliationApi.getUnmatched(orgId!, runId!, {
        page: unmatchedPage,
        limit: 15,
      }),
    enabled: !!orgId && !!runId && !isMatchesTab,
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

  // Filter discrepancy items client-side if tab is 'discrepancy'
  const displayedMatches =
    isThreeSource && active3WayTab === 'discrepancy'
      ? matchesData?.items.filter(
          (m) =>
            m.classification === 'AMOUNT_MISMATCH' ||
            m.classification === 'DATE_MISMATCH' ||
            m.classification === 'REFERENCE_MISMATCH' ||
            (m.discrepancyDetails && m.discrepancyDetails.length > 0)
        ) || []
      : matchesData?.items || [];

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

      {/* Header */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <GitCompareIcon size={20} style={{ color: 'var(--rx-text-primary)' }} />
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Reconciliation Run #{run.id.slice(0, 8)}
              </h1>
              {isThreeSource ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    backgroundColor: '#EAF7EE',
                    color: '#166534',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <LayersIcon size={13} /> Native Three-Source (3-Way)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    backgroundColor: 'var(--rx-surface-muted)',
                    color: 'var(--rx-text-secondary)',
                  }}
                >
                  Pairwise (2-Way)
                </span>
              )}
            </div>

            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
              <strong>Participating Feeds: </strong>
              <span style={{ color: 'var(--rx-text-primary)', fontWeight: 600 }}>
                {run.sourceAName || 'Source A'}
              </span>{' '}
              vs{' '}
              <span style={{ color: 'var(--rx-text-primary)', fontWeight: 600 }}>
                {run.sourceBName || 'Source B'}
              </span>
              {isThreeSource && (
                <>
                  {' '}vs{' '}
                  <span style={{ color: 'var(--rx-text-primary)', fontWeight: 600 }}>
                    {run.sourceCName || 'Source C (Bank Statement)'}
                  </span>
                </>
              )}
            </div>

            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
              Window: <strong>{formatDate(run.dateFrom)}</strong> to{' '}
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

      {/* Bento Counters Breakdown */}
      {isThreeSource ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: '#1A2917' }}>Fully Matched</div>
            <div className="rx-bento-val" style={{ color: '#0F290D' }}>
              {run.fullyMatchedCount ?? run.exactMatchesCount ?? run.exactMatchCount ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>All 3 sources confirmed</div>
          </div>

          <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: '#383204' }}>Partially Matched</div>
            <div className="rx-bento-val" style={{ color: '#383204' }}>
              {run.partiallyMatchedCount ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#595009' }}>2 matched, 1 missing</div>
          </div>

          <div className="rx-bento-card rx-bento-rose" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: '#7F1D1D' }}>Discrepancies</div>
            <div className="rx-bento-val" style={{ color: '#991B1B' }}>
              {run.discrepancyCount ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#991B1B' }}>Amount/Date variance</div>
          </div>

          <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: '#A16207' }}>Potential Matches</div>
            <div className="rx-bento-val" style={{ color: '#A16207' }}>
              {run.potentialMatchesCount ?? run.potentialMatchCount ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Review candidates</div>
          </div>

          <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Unmatched</div>
            <div className="rx-bento-val" style={{ color: 'var(--rx-danger)' }}>
              {run.unmatchedCount ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Flagged to queue</div>
          </div>

          <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
            <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Source Breakdown</div>
            <div style={{ fontSize: '0.85rem', color: '#FFFFFF', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div>A: <strong style={{ color: 'var(--rx-lime)' }}>{run.totalTransactionsA ?? run.totalSourceA ?? 0}</strong></div>
              <div>B: <strong style={{ color: '#FFFFFF' }}>{run.totalTransactionsB ?? run.totalSourceB ?? 0}</strong></div>
              <div>C: <strong style={{ color: 'var(--rx-lime)' }}>{run.totalTransactionsC ?? run.totalSourceC ?? 0}</strong></div>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Styled Tabs */}
      {isThreeSource ? (
        <div className="rx-tabs">
          <button
            onClick={() => {
              setActive3WayTab('all');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'all' ? 'active' : ''}`}
          >
            <GitCompareIcon size={16} />
            <span>All Match Groups</span>
          </button>

          <button
            onClick={() => {
              setActive3WayTab('fully_matched');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'fully_matched' ? 'active' : ''}`}
          >
            <CheckCircleIcon size={16} />
            <span>Fully Matched</span>
            <span className="rx-tab-counter">
              {run.fullyMatchedCount ?? run.exactMatchesCount ?? 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActive3WayTab('partially_matched');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'partially_matched' ? 'active' : ''}`}
          >
            <AlertCircleIcon size={16} />
            <span>Partially Matched</span>
            <span className="rx-tab-counter">{run.partiallyMatchedCount ?? 0}</span>
          </button>

          <button
            onClick={() => {
              setActive3WayTab('discrepancy');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'discrepancy' ? 'active' : ''}`}
          >
            <AlertOctagonIcon size={16} />
            <span>Discrepancies</span>
            <span className="rx-tab-counter">{run.discrepancyCount ?? 0}</span>
          </button>

          <button
            onClick={() => {
              setActive3WayTab('potential');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'potential' ? 'active' : ''}`}
          >
            <AlertCircleIcon size={16} />
            <span>Potential Matches</span>
            <span className="rx-tab-counter">{run.potentialMatchesCount ?? 0}</span>
          </button>

          <button
            onClick={() => {
              setActive3WayTab('unmatched');
              setUnmatchedPage(1);
            }}
            className={`rx-tab-btn ${active3WayTab === 'unmatched' ? 'active' : ''}`}
          >
            <AlertOctagonIcon size={16} />
            <span>Unmatched Transactions</span>
            <span className="rx-tab-counter">{run.unmatchedCount ?? 0}</span>
          </button>
        </div>
      ) : (
        <div className="rx-tabs">
          <button
            onClick={() => {
              setActive2WayTab('exact');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active2WayTab === 'exact' ? 'active' : ''}`}
          >
            <CheckCircleIcon size={16} />
            <span>Exact Matches</span>
            <span className="rx-tab-counter">{run.exactMatchesCount}</span>
          </button>

          <button
            onClick={() => {
              setActive2WayTab('potential');
              setMatchesPage(1);
            }}
            className={`rx-tab-btn ${active2WayTab === 'potential' ? 'active' : ''}`}
          >
            <AlertCircleIcon size={16} />
            <span>Potential Matches (Review)</span>
            <span className="rx-tab-counter">{run.potentialMatchesCount}</span>
          </button>

          <button
            onClick={() => {
              setActive2WayTab('unmatched');
              setUnmatchedPage(1);
            }}
            className={`rx-tab-btn ${active2WayTab === 'unmatched' ? 'active' : ''}`}
          >
            <AlertOctagonIcon size={16} />
            <span>Unmatched Transactions</span>
            <span className="rx-tab-counter">{run.unmatchedCount}</span>
          </button>
        </div>
      )}

      {/* Reject Match Modal Dialog */}
      {rejectingMatchId && (
        <div className="rx-modal-overlay">
          <div className="rx-modal-card rx-animate-fade-in" style={{ border: '1px solid var(--rx-danger-border)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--rx-danger)', fontSize: '1.2rem', fontWeight: 800 }}>
              Reject Suggested Match
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', marginBottom: '1rem' }}>
              Provide an optional reason for rejection. Rejecting this match releases participating records and automatically generates OPEN exceptions for investigation.
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

      {/* THREE-SOURCE MATCH EXPLORER VIEW */}
      {isThreeSource && isMatchesTab && (
        <div>
          {matchesLoading ? (
            <LoadingState message="Loading three-source matches..." />
          ) : displayedMatches.length === 0 ? (
            <EmptyState
              title="No Match Records Found"
              description="No transaction groups match the current tab filter."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {displayedMatches.map((m) => (
                <ThreeSourceMatchCard
                  key={m.id}
                  match={m}
                  run={run}
                  permissions={permissions}
                  onConfirm={(id) => confirmMutation.mutate(id)}
                  onReject={(id) => setRejectingMatchId(id)}
                  isConfirming={confirmMutation.isPending}
                />
              ))}

              <Pagination
                page={matchesPage}
                totalPages={matchesData?.totalPages || 1}
                total={matchesData?.total || 0}
                limit={matchesData?.limit || 15}
                onPageChange={setMatchesPage}
              />
            </div>
          )}
        </div>
      )}

      {/* TWO-SOURCE MATCH VIEW */}
      {!isThreeSource && isMatchesTab && (
        <div>
          {matchesLoading ? (
            <LoadingState message="Loading matches..." />
          ) : !matchesData || matchesData.items.length === 0 ? (
            <EmptyState title="No Matches Found" description="No matches found for this view." />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Transaction A (Ledger)</th>
                    <th>Transaction B (Gateway)</th>
                    <th>Matching Rule / Reasons</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesData.items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--rx-radius-full)',
                            backgroundColor: m.score >= 90 ? '#EAF7EE' : '#FEF9E6',
                            color: m.score >= 90 ? 'var(--rx-success)' : '#A16207',
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
                        {formatReasons(m.reasons) || 'Parity verified'}
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
                            {m.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={matchesPage}
                totalPages={matchesData.totalPages}
                total={matchesData.total}
                limit={matchesData.limit}
                onPageChange={setMatchesPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Unmatched Transactions */}
      {!isMatchesTab && (
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

// -----------------------------------------------------------------------------------------
// Subcomponent: ThreeSourceMatchCard (Match Explorer 3-way Comparative Inspection)
// -----------------------------------------------------------------------------------------
interface ThreeSourceMatchCardProps {
  match: MatchRecord;
  run: any;
  permissions: any;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  isConfirming: boolean;
}

const ThreeSourceMatchCard: React.FC<ThreeSourceMatchCardProps> = ({
  match,
  run,
  permissions,
  onConfirm,
  onReject,
  isConfirming,
}) => {
  const { classification, score, status, transactionA, transactionB, transactionC, discrepancyDetails, reasons } = match;

  const isAmountMismatch =
    classification === 'AMOUNT_MISMATCH' ||
    discrepancyDetails?.some((d) => d.type === 'AMOUNT' || d.type === 'AMOUNT_MISMATCH');

  const isMissingSource =
    classification === 'PARTIALLY_MATCHED' ||
    discrepancyDetails?.some((d) => d.type === 'MISSING_SOURCE') ||
    !transactionC;

  const isDateMismatch =
    classification === 'DATE_MISMATCH' ||
    discrepancyDetails?.some((d) => d.type === 'DATE' || d.type === 'DATE_MISMATCH');

  // Badge styling according to classification
  const getClassificationBadge = () => {
    switch (classification) {
      case 'FULLY_MATCHED':
        return (
          <span style={{ backgroundColor: '#EAF7EE', color: '#166534', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ● FULLY MATCHED
          </span>
        );
      case 'PARTIALLY_MATCHED':
        return (
          <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ▲ PARTIALLY MATCHED (1 MISSING)
          </span>
        );
      case 'AMOUNT_MISMATCH':
        return (
          <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✖ AMOUNT MISMATCH
          </span>
        );
      case 'DATE_MISMATCH':
        return (
          <span style={{ backgroundColor: '#FFEDD5', color: '#9A3412', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⏱ DATE DELAY EXCEEDED
          </span>
        );
      case 'POTENTIAL_MATCH':
      default:
        return (
          <span style={{ backgroundColor: '#FEF9E6', color: '#A16207', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ? POTENTIAL MATCH
          </span>
        );
    }
  };

  return (
    <div
      className="rx-card"
      style={{
        padding: '1.5rem',
        backgroundColor: '#FFFFFF',
        border: isAmountMismatch
          ? '1px solid #FCA5A5'
          : isMissingSource
          ? '1px solid #FDE68A'
          : '1px solid var(--rx-border)',
      }}
    >
      {/* Top Banner: Match ID, Classification, Score, Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--rx-border-subtle)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--rx-text-primary)' }}>
            Group #{match.id.slice(0, 8)}
          </span>
          {getClassificationBadge()}
          <span
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              backgroundColor: score >= 90 ? '#EAF7EE' : score >= 70 ? '#FEF9E6' : '#FEE2E2',
              color: score >= 90 ? 'var(--rx-success)' : score >= 70 ? '#A16207' : 'var(--rx-danger)',
              fontWeight: 800,
              fontSize: '0.75rem',
            }}
          >
            {score}% Confidence
          </span>
          <StatusBadge status={status} />
        </div>

        {status === 'PENDING' && permissions.canConfirmRejectMatches && (
          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
            <button
              onClick={() => onConfirm(match.id)}
              disabled={isConfirming}
              className="rx-btn rx-btn-success rx-btn-sm"
            >
              <CheckIcon size={13} /> Confirm Match
            </button>
            <button
              onClick={() => onReject(match.id)}
              className="rx-btn rx-btn-danger rx-btn-sm"
            >
              <XIcon size={13} /> Reject Match
            </button>
          </div>
        )}
      </div>

      {/* Discrepancy Callout if exists */}
      {discrepancyDetails && discrepancyDetails.length > 0 && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 1rem',
            backgroundColor: isAmountMismatch ? '#FEF2F2' : '#FFFBEB',
            borderRadius: 'var(--rx-radius-md)',
            border: isAmountMismatch ? '1px solid #FCA5A5' : '1px solid #FDE68A',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 700, color: isAmountMismatch ? '#991B1B' : '#92400E', marginBottom: '0.3rem' }}>
            Discrepancy Detected:
          </div>
          {discrepancyDetails.map((disc, idx) => (
            <div key={idx} style={{ color: isAmountMismatch ? '#7F1D1D' : '#78350F' }}>
              • {disc.message || disc.description || `${disc.type} mismatch on ${disc.field}`}
              {disc.difference !== undefined && (
                <span> (Difference: <strong>{formatAmountMinor(disc.difference, 'INR')}</strong>)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3-Source Comparative Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table className="rx-table" style={{ fontSize: '0.85rem', width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--rx-surface-subtle)' }}>
              <th style={{ width: '160px' }}>Attribute</th>
              <th style={{ width: '28%' }}>
                Source A: {run.sourceAName || 'Internal Orders'}
              </th>
              <th style={{ width: '28%' }}>
                Source B: {run.sourceBName || 'Payment Gateway'}
              </th>
              <th style={{ width: '28%' }}>
                Source C: {run.sourceCName || 'Bank Statement'}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: External ID */}
            <tr>
              <td style={{ fontWeight: 700, color: 'var(--rx-text-secondary)' }}>External ID</td>
              <td>
                <code className="rx-col-code" style={{ fontWeight: 700 }}>
                  {transactionA?.externalId || '—'}
                </code>
              </td>
              <td>
                <code className="rx-col-code" style={{ fontWeight: 700 }}>
                  {transactionB?.externalId || '—'}
                </code>
              </td>
              <td>
                {transactionC ? (
                  <code className="rx-col-code" style={{ fontWeight: 700 }}>
                    {transactionC.externalId}
                  </code>
                ) : (
                  <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.78rem' }}>
                    ✕ Record Missing in Bank Feed
                  </span>
                )}
              </td>
            </tr>

            {/* Row 2: Amount */}
            <tr style={{ backgroundColor: isAmountMismatch ? '#FEF2F2' : undefined }}>
              <td style={{ fontWeight: 700, color: 'var(--rx-text-secondary)' }}>Amount</td>
              <td>
                <strong style={{ color: 'var(--rx-text-primary)' }}>
                  {transactionA ? formatAmountMinor(transactionA.amountMinor, transactionA.currency) : '—'}
                </strong>
              </td>
              <td>
                <strong style={{ color: 'var(--rx-text-primary)' }}>
                  {transactionB ? formatAmountMinor(transactionB.amountMinor, transactionB.currency) : '—'}
                </strong>
              </td>
              <td>
                {transactionC ? (
                  <strong
                    style={{
                      color: isAmountMismatch ? '#DC2626' : 'var(--rx-text-primary)',
                      textDecoration: isAmountMismatch ? 'underline' : 'none',
                    }}
                  >
                    {formatAmountMinor(transactionC.amountMinor, transactionC.currency)}
                  </strong>
                ) : (
                  <span style={{ color: 'var(--rx-text-muted)' }}>—</span>
                )}
              </td>
            </tr>

            {/* Row 3: Transaction Date */}
            <tr style={{ backgroundColor: isDateMismatch ? '#FFF7ED' : undefined }}>
              <td style={{ fontWeight: 700, color: 'var(--rx-text-secondary)' }}>Date</td>
              <td style={{ color: 'var(--rx-text-secondary)' }}>
                {transactionA ? formatDate(transactionA.transactionDate) : '—'}
              </td>
              <td style={{ color: 'var(--rx-text-secondary)' }}>
                {transactionB ? formatDate(transactionB.transactionDate) : '—'}
              </td>
              <td style={{ color: isDateMismatch ? '#C2410C' : 'var(--rx-text-secondary)' }}>
                {transactionC ? formatDate(transactionC.transactionDate) : '—'}
              </td>
            </tr>

            {/* Row 4: Reference / Link Identifier */}
            <tr>
              <td style={{ fontWeight: 700, color: 'var(--rx-text-secondary)' }}>Reference / Link</td>
              <td style={{ color: 'var(--rx-text-secondary)', fontSize: '0.8rem' }}>
                Ref: {transactionA?.reference || transactionA?.externalId || '—'}
              </td>
              <td style={{ color: 'var(--rx-text-secondary)', fontSize: '0.8rem' }}>
                Ref: {transactionB?.reference || '—'}
              </td>
              <td style={{ color: 'var(--rx-text-secondary)', fontSize: '0.8rem' }}>
                {transactionC ? `ExtTxn: ${transactionC.externalTxnId || transactionC.reference || '—'}` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Explainability Breakdown (Reference 5 & Reasons) */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--rx-border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--rx-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          Deterministic Match Explainability
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
          {Array.isArray(reasons) ? (
            <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <div>{formatReasons(reasons) || 'Cross-source reference link and monetary parity verified.'}</div>
          )}
        </div>
      </div>
    </div>
  );
};
